import { config } from "./config.ts";
import { consolidate, getOrCreateUser, runTurn, type Deps, type TurnResult } from "./handler.ts";
import { dueEvent, dueReminders, withinServiceWindow, type DueEvent } from "./scheduler.ts";
import { localParts } from "./time.ts";
import { transcribe } from "./transcribe.ts";
import type { Reminder, TurnInput, User } from "./types.ts";
import { downloadMedia, type InboundMessage, type Sender } from "./whatsapp.ts";

export interface AppDeps extends Deps {
  sender: Sender;
  /** Se puede sustituir en tests/simulador. */
  fetchMedia?: typeof downloadMedia;
  transcribeAudio?: typeof transcribe;
  log?: (msg: string) => void;
}

// Procesa en orden los mensajes de una misma persona (evita carreras si manda 3 seguidos).
const queues = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(key, next.catch(() => {}));
  return next;
}

/** Entrega la respuesta: plantilla fuera de la ventana de 24 h; dentro, con botones si los hay. */
async function deliver(deps: AppDeps, to: string, turn: TurnResult, inWindow = true) {
  if (!inWindow) return deps.sender.sendTemplate(to, turn.reply);
  if (turn.quickReplies.length > 0) return deps.sender.sendButtons(to, turn.reply, turn.quickReplies);
  return deps.sender.sendText(to, turn.reply);
}

// Las notas de voz normales pesan unos cientos de KB; esto evita pagar por audios enormes.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function handleInbound(deps: AppDeps, msg: InboundMessage): Promise<void> {
  if (!(await deps.store.claimInboundMessage(msg.id))) return; // reintento de Meta: ya lo procesamos
  await serialize(msg.from, async () => {
    const user = await getOrCreateUser(deps.store, msg.from, msg.profileName);
    const fetchMedia = deps.fetchMedia ?? downloadMedia;
    const transcribeAudio = deps.transcribeAudio ?? transcribe;

    let input: TurnInput;
    let historyText: string;
    if (msg.type === "text") {
      // Control de privacidad: borrar todo lo que Ancla sabe de ella (pide confirmación).
      const cmd = msg.text.trim().toLowerCase();
      if (cmd === "/olvidar") {
        await deps.sender.sendText(
          msg.from,
          "Si quieres que me olvide de todo lo que sé de ti (tus rutinas, la gente que me has contado, tus notas, recordatorios, pendientes y nuestro historial), escribe /olvidar todo. No se puede deshacer. Si no, aquí seguimos igual.",
        );
        return;
      }
      if (cmd === "/olvidar todo") {
        await deps.store.wipeUserData(user.id);
        await deps.sender.sendText(msg.from, "Listo, borré todo lo que sabía de ti. Cuando quieras empezamos de cero.");
        return;
      }
      input = { type: "message", text: msg.text };
      historyText = msg.text;
    } else if (msg.type === "audio") {
      const media = await fetchMedia(msg.mediaId);
      if (media.data.byteLength > MAX_AUDIO_BYTES) {
        await deps.sender.sendText(msg.from, "Ese audio es muy largo para mí. ¿Me lo mandas en partes más cortas?");
        return;
      }
      let text: string | null;
      try {
        text = await transcribeAudio(media.data, media.mimeType);
      } catch (err) {
        deps.log?.(`transcripción falló: ${(err as Error).message}`);
        await deps.sender.sendText(msg.from, "No logré escuchar ese audio. ¿Me lo mandas otra vez o me lo escribes?");
        return;
      }
      if (text === null) {
        await deps.sender.sendText(msg.from, "Todavía no puedo escuchar audios 🙈 ¿Me lo mandas escrito, aunque sea desordenado?");
        return;
      }
      if (!text) {
        await deps.sender.sendText(msg.from, "No alcancé a entender nada en ese audio. ¿Me lo repites o me lo escribes?");
        return;
      }
      input = { type: "message", text: `(audio transcrito) ${text}` };
      historyText = `(audio) ${text}`;
    } else if (msg.type === "image") {
      const media = await fetchMedia(msg.mediaId);
      if (!IMAGE_TYPES.has(media.mimeType)) {
        await deps.sender.sendText(msg.from, "No pude abrir esa imagen. ¿Me mandas una foto normal (JPG o PNG)?");
        return;
      }
      input = {
        type: "message",
        text: msg.caption,
        image: { mediaType: media.mimeType, base64: media.data.toString("base64") },
      };
      historyText = `(foto) ${msg.caption}`.trim();
    } else {
      await deps.sender.sendText(msg.from, "Por ahora entiendo texto, audios y fotos. ¿Me lo cuentas por ahí?");
      return;
    }

    const turn = await runTurn(deps, user, input, historyText);
    await deliver(deps, msg.from, turn);
    deps.log?.(`respuesta enviada (${turn.reply.length} caracteres, ${turn.quickReplies.length} botones)`);
  });
}

/** Revisa a todas las personas y manda los mensajes proactivos que toquen. Llamar cada ~10 min. */
export async function runTick(deps: AppDeps, now = deps.now?.() ?? new Date()): Promise<number> {
  const users = await deps.store.listUsers();
  let sent = 0;
  for (const user of users) {
    const pending = await deps.store.listPendingReminders(user.id);
    const ev = dueEvent(user, now, pending);
    if (!ev) continue;
    const reminders = ev === "reminder" ? dueReminders(pending, now) : [];
    try {
      await serialize(user.phone, () => sendProactive(deps, user, ev, now, reminders));
      sent++;
    } catch (err) {
      deps.log?.(`tick ${user.phone} ${ev}: ${(err as Error).message}`);
    }
  }
  return sent;
}

async function sendProactive(deps: AppDeps, user: User, ev: DueEvent, now: Date, reminders: Reminder[]) {
  // Marcar primero para no mandar duplicados si algo falla a medias.
  const today = localParts(now, user.timezone).date;
  const mark: Partial<User> | null =
    ev === "morning" ? { lastMorningDate: today } : ev === "evening" ? { lastEveningDate: today } : ev === "checkin" ? { checkinAt: null } : null;
  let fresh = mark ? await deps.store.updateUser(user.id, mark) : user;
  const turnDeps = { ...deps, now: () => now };

  // Cada noche, antes del cierre, ordena lo aprendido en rutinas, perfil y voz.
  if (ev === "evening") {
    try {
      if (await consolidate(turnDeps, fresh, now)) fresh = (await deps.store.getUserByPhone(user.phone)) ?? fresh;
    } catch (err) {
      deps.log?.(`memoria ${user.phone}: ${(err as Error).message}`);
    }
  }

  const inWindow = withinServiceWindow(fresh, now);
  if (!inWindow && !config.whatsappTemplateName) {
    deps.log?.(`tick ${user.phone} ${ev}: fuera de la ventana de 24 h y sin plantilla; se omite`);
    return;
  }
  const input: TurnInput = ev === "reminder" ? { type: "event", name: "reminder", reminders } : { type: "event", name: ev };
  const turn = await runTurn(turnDeps, fresh, input);
  // Si el cerebro falla antes de llegar aquí, el recordatorio sigue pendiente y se reintenta en el próximo tick.
  if (ev === "reminder") await deps.store.setReminderStatus(reminders.map((r) => r.id), "sent");
  await deliver(deps, user.phone, turn, inWindow);
}
