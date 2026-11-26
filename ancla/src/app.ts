import { config } from "./config.ts";
import { OutOfCreditsError } from "./brain.ts";
import { consolidate, findOrCreateUser, runTurn, type Deps, type TurnResult } from "./handler.ts";
import { chooseMode } from "./modes.ts";
import { MAX_VOICE_CHARS, speechText, synthesize, ttsConfigured, voiceInstructions } from "./tts.ts";
import { helpText, matchCommand, privacyText, welcomeText, WELCOME_BUTTONS } from "./onboarding.ts";
import { dueEvent, dueReminders, withinServiceWindow, type DueEvent } from "./scheduler.ts";
import { localParts } from "./time.ts";
import { voiceCostUsd } from "./pricing.ts";
import { transcribe } from "./transcribe.ts";
import type { PendingInbound } from "./store/index.ts";
import type { Reminder, TurnInput, User } from "./types.ts";
import { downloadMedia, type InboundMessage, type Sender } from "./whatsapp.ts";

export interface AppDeps extends Deps {
  sender: Sender;
  /** Se puede sustituir en tests/simulador. */
  fetchMedia?: typeof downloadMedia;
  transcribeAudio?: typeof transcribe;
  synthesizeSpeech?: typeof synthesize;
  /** Espera entre la nota de voz y sus botones (WhatsApp entrega el audio más lento que el texto). */
  voiceButtonsDelayMs?: number;
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
async function deliver(
  deps: AppDeps,
  to: string,
  turn: TurnResult,
  inWindow = true,
  voice?: { instructions: string },
): Promise<"voz" | "texto"> {
  if (!inWindow) {
    await deps.sender.sendTemplate(to, turn.reply);
    return "texto";
  }
  // Respuesta en nota de voz (si hay servicio y cabe); cualquier fallo cae a texto para no dejarla sin respuesta.
  if (voice && turn.reply.length <= MAX_VOICE_CHARS) {
    let spoke = false;
    try {
      const audio = await (deps.synthesizeSpeech ?? synthesize)(speechText(turn.reply), voice.instructions);
      if (audio) {
        await deps.sender.sendVoice(to, audio);
        spoke = true;
      }
    } catch (err) {
      deps.log?.(`voz falló, se envía texto: ${(err as Error).message}`);
    }
    if (spoke) {
      // Los botones no se pueden pegar a un audio: van en un mensaje de texto corto aparte.
      // Se espera un poco para que no le lleguen antes que el audio.
      if (turn.quickReplies.length > 0) {
        await new Promise((r) => setTimeout(r, deps.voiceButtonsDelayMs ?? 4000));
        await deps.sender.sendButtons(to, "Toca una opción si te sirve:", turn.quickReplies);
      }
      return "voz";
    }
  }
  if (turn.quickReplies.length > 0) await deps.sender.sendButtons(to, turn.reply, turn.quickReplies);
  else await deps.sender.sendText(to, turn.reply);
  return "texto";
}

// Las notas de voz normales pesan unos cientos de KB; esto evita pagar por audios enormes.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Un mensaje que falla se reintenta en las siguientes revisiones del reloj; después de esto, se avisa y se suelta.
export const MAX_INBOUND_ATTEMPTS = 3;
// Un mensaje sin terminar se da por "a medias" después de esto (más que lo que tarda un turno lento).
export const STUCK_AFTER_MS = 3 * 60_000;
// Más viejo que esto ya no tiene sentido contestarlo como si nada: se pide que lo repita.
const STALE_AFTER_MS = 12 * 60 * 60_000;

// Sin saldo en Anthropic: a quién ya se le avisó que Ancla está en pausa (para avisar una sola vez).
const pauseNoticeAt = new Map<string, number>();
const PAUSE_NOTICE_EVERY_MS = 12 * 60 * 60_000;

// Mensajes que este servidor está procesando ahora (para no tomarlos dos veces y para apagarse con calma).
const inFlight = new Set<string>();
export const inFlightCount = () => inFlight.size;

export async function handleInbound(deps: AppDeps, msg: InboundMessage): Promise<void> {
  if (!(await deps.store.claimInboundMessage(msg))) return; // reintento de Meta: ya lo procesamos
  await processInbound(deps, { msg, attempts: 1, receivedAt: (deps.now?.() ?? new Date()).toISOString() });
}

/**
 * Procesa un mensaje guardado como pendiente y lo cierra al terminar. Si algo falla queda pendiente,
 * y la revisión del reloj (o el arranque del servidor) lo retoma: así no se pierde si el servidor
 * se reinicia a mitad de camino.
 */
async function processInbound(deps: AppDeps, p: PendingInbound, retry = false): Promise<void> {
  const { msg } = p;
  inFlight.add(msg.id);
  try {
    await serialize(msg.from, async () => {
      if (p.reply) {
        // El cerebro ya había contestado; solo faltó enviarlo.
        await deliver(deps, msg.from, p.reply);
      } else {
        // En un reintento, la hora "de ahora" es la hora en que llegó el mensaje ("en 15 minutos" cuenta desde ahí).
        const turnDeps = retry ? { ...deps, now: () => new Date(p.receivedAt) } : deps;
        await respond(turnDeps, msg, async (reply) => {
          p.reply = reply;
          await deps.store.updatePendingInbound(p);
        });
      }
    });
    await deps.store.finishInbound(msg.id, "done");
    pauseNoticeAt.delete(msg.from);
    if (retry) deps.log?.(`mensaje recuperado (intento ${p.attempts})`);
  } catch (err) {
    if (err instanceof OutOfCreditsError) {
      // No es culpa del mensaje: no cuenta como intento y espera (hasta 12 h) a que vuelva el saldo.
      deps.log?.("SIN SALDO en Anthropic: el mensaje queda guardado hasta que se recargue (console.anthropic.com → Billing)");
      const back = { ...p, attempts: Math.max(0, p.attempts - 1) };
      await deps.store.updatePendingInbound(back).catch(() => {});
      const last = pauseNoticeAt.get(msg.from) ?? 0;
      const now = (deps.now?.() ?? new Date()).getTime();
      if (now - last > PAUSE_NOTICE_EVERY_MS) {
        pauseNoticeAt.set(msg.from, now);
        await deps.sender
          .sendText(msg.from, "Estoy en una pausa técnica cortita 🙈 Guardé tu mensaje y te respondo apenas vuelva, no tienes que repetirlo.")
          .catch(() => {});
      }
      return;
    }
    deps.log?.(`mensaje falló (intento ${p.attempts} de ${MAX_INBOUND_ATTEMPTS}): ${(err as Error).message}`);
    if (p.attempts >= MAX_INBOUND_ATTEMPTS) {
      await giveUp(deps, p);
    } else if (!retry && !p.reply) {
      // Que no se quede esperando en silencio: el reloj lo reintenta en unos minutos.
      await deps.sender
        .sendText(msg.from, "Uy, se me trabó algo con tu mensaje. Lo vuelvo a intentar en unos minutos, no tienes que repetirlo.")
        .catch(() => {});
    }
  } finally {
    inFlight.delete(msg.id);
  }
}

/** Después de varios intentos (o si es muy viejo): se cierra y se le pide que lo repita, sin culpa. */
async function giveUp(deps: AppDeps, p: PendingInbound) {
  await deps.store.finishInbound(p.msg.id, "failed").catch(() => {});
  await deps.sender
    .sendText(p.msg.from, "Perdón, no logré procesar uno de tus mensajes de hace un rato. Si todavía te sirve, ¿me lo mandas otra vez?")
    .catch(() => {});
  deps.log?.("mensaje abandonado tras varios intentos; se pidió repetirlo");
}

/** Retoma los mensajes que quedaron a medias (servidor reiniciado, error de un servicio…). Devuelve cuántos tomó. */
export async function recoverInbound(deps: AppDeps, now = deps.now?.() ?? new Date()): Promise<number> {
  const stuck = await deps.store.listStuckInbound(new Date(now.getTime() - STUCK_AFTER_MS).toISOString(), 20);
  let taken = 0;
  for (const p of stuck) {
    if (inFlight.has(p.msg.id)) continue; // este mismo servidor lo está procesando
    taken++;
    if (now.getTime() - Date.parse(p.receivedAt) > STALE_AFTER_MS || p.attempts >= MAX_INBOUND_ATTEMPTS) {
      await giveUp(deps, p);
      continue;
    }
    const next = { ...p, attempts: p.attempts + 1 };
    // Se anota el intento antes de empezar: si este también se cae, no se reintenta para siempre.
    await deps.store.updatePendingInbound(next);
    await processInbound(deps, next, true);
  }
  return taken;
}

/** Arma la respuesta a un mensaje y la entrega. `onReply` guarda la respuesta antes de enviarla. */
async function respond(deps: AppDeps, msg: InboundMessage, onReply: (r: { reply: string; quickReplies: string[] }) => Promise<void>) {
  const { user, created } = await findOrCreateUser(deps.store, msg.from, msg.profileName);
  // Bienvenida solo a números nuevos y solo si su primer mensaje no es un comando.
  const firstContact = created && !(msg.type === "text" && matchCommand(msg.text));
  if (firstContact) {
    const welcome = welcomeText();
    await deps.sender.sendButtons(msg.from, welcome, WELCOME_BUTTONS);
    await deps.store.addMessage({ userId: user.id, role: "assistant", text: welcome });
  }
  const fetchMedia = deps.fetchMedia ?? downloadMedia;
  const transcribeAudio = deps.transcribeAudio ?? transcribe;

  let input: TurnInput;
  let historyText: string;
  if (msg.type === "text") {
    const cmd = matchCommand(msg.text);
    if (cmd === "help") {
      await deps.sender.sendText(msg.from, helpText());
      return;
    }
    if (cmd === "privacy") {
      await deps.sender.sendText(msg.from, privacyText());
      return;
    }
    // Control de privacidad: borrar todo lo que Ancla sabe de ella (pide confirmación).
    if (cmd === "forget") {
      await deps.sender.sendText(
        msg.from,
        "Si quieres que me olvide de todo lo que sé de ti (tus rutinas, la gente que me has contado, tus notas, recordatorios, pendientes y nuestro historial), escribe /olvidar todo. No se puede deshacer. Si no, aquí seguimos igual.",
      );
      return;
    }
    if (cmd === "forget-all") {
      await deps.store.wipeUserData(user.id);
      await deps.sender.sendText(msg.from, "Listo, borré todo lo que sabía de ti. Cuando quieras empezamos de cero.");
      return;
    }
    input = { type: "message", text: msg.text, ...(firstContact && { firstContact: true }) };
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
    input = { type: "message", text: `(audio transcrito) ${text}`, ...(firstContact && { firstContact: true }) };
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
      ...(firstContact && { firstContact: true }),
      image: { mediaType: media.mimeType, base64: media.data.toString("base64") },
    };
    historyText = `(foto) ${msg.caption}`.trim();
  } else {
    await deps.sender.sendText(msg.from, "Por ahora entiendo texto, audios y fotos. ¿Me lo cuentas por ahí?");
    return;
  }

  const mode = chooseMode(input);
  // Si te hablan por voz (y no es un plan largo), se responde por voz.
  const canSpeak = Boolean(deps.synthesizeSpeech) || ttsConfigured();
  const voice = msg.type === "audio" && canSpeak && mode !== "deep";
  if (voice && input.type === "message") input = { ...input, voiceReply: true };
  // El modo profundo tarda más: se avisa para que no parezca que Ancla se quedó callada.
  if (mode === "deep") await deps.sender.sendText(msg.from, "Dame un momentito, esto lo quiero pensar bien.");
  const turn = await runTurn(deps, user, input, historyText, mode);
  await onReply(turn);
  const sentAs = await deliver(deps, msg.from, turn, true, voice ? { instructions: voiceInstructions(user) } : undefined);
  if (sentAs === "voz") {
    const chars = speechText(turn.reply).length;
    deps.store
      .addUsage({ userId: user.id, kind: "voice", model: "tts", inputTokens: chars, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: voiceCostUsd(chars) })
      .catch(() => {});
  }
  deps.log?.(`respuesta enviada (${turn.reply.length} caracteres, ${turn.quickReplies.length} botones${sentAs === "voz" ? ", voz" : ""})`);
}

/** Revisa a todas las personas y manda los mensajes proactivos que toquen. Llamar cada ~10 min. */
export async function runTick(deps: AppDeps, now = deps.now?.() ?? new Date()): Promise<number> {
  // Primero, lo que la gente escribió y quedó sin respuesta.
  try {
    const recovered = await recoverInbound(deps, now);
    if (recovered > 0) deps.log?.(`tick: ${recovered} mensaje(s) a medias retomado(s)`);
  } catch (err) {
    deps.log?.(`recuperar mensajes falló: ${(err as Error).message}`);
  }
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
    ev === "morning"
      ? { lastMorningDate: today }
      : ev === "evening"
        ? { lastEveningDate: today }
        : ev === "checkin"
          ? { checkinAt: null }
          : ev === "companion_end"
            ? { companion: null, checkinAt: null }
            : null;
  const session = user.companion ?? null;
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
  const input: TurnInput =
    ev === "reminder"
      ? { type: "event", name: "reminder", reminders }
      : ev === "companion_end"
        ? { type: "event", name: "companion_end", session: session! }
        : { type: "event", name: ev };
  let turn: TurnResult;
  try {
    turn = await runTurn(turnDeps, fresh, input);
  } catch (err) {
    // Sin saldo: se deshace la marca para que el buenos días, el cierre o el check-in salgan cuando vuelva.
    if (err instanceof OutOfCreditsError && mark) {
      const undo: Partial<User> = {};
      for (const k of Object.keys(mark) as (keyof User)[]) (undo as Record<string, unknown>)[k] = user[k] ?? null;
      await deps.store.updateUser(user.id, undo).catch(() => {});
    }
    throw err;
  }
  // Si el cerebro falla antes de llegar aquí, el recordatorio sigue pendiente y se reintenta en el próximo tick.
  if (ev === "reminder") await deps.store.setReminderStatus(reminders.map((r) => r.id), "sent");
  await deliver(deps, user.phone, turn, inWindow);
}
