import type { Brain } from "./brain.ts";
import { config } from "./config.ts";
import { countryFromPhone } from "./dialect.ts";
import type { Store } from "./store/index.ts";
import { isValidTime, isValidTimeZone, localMidnightIso } from "./time.ts";
import type { BrainOutput, Item, TurnInput, User } from "./types.ts";

const HISTORY_LIMIT = 20;
const MAX_NOTES = 40;
const MAX_ROUTINES = 30;

export interface Deps {
  store: Store;
  brain: Brain;
  now?: () => Date;
}

export async function getOrCreateUser(store: Store, phone: string, profileName = ""): Promise<User> {
  const existing = await store.getUserByPhone(phone);
  if (existing) return existing;
  return store.createUser(phone, {
    name: profileName,
    timezone: countryFromPhone(phone)?.timezone ?? config.defaultTimezone,
    morningTime: config.defaultMorningTime,
    eveningTime: config.defaultEveningTime,
  });
}

/**
 * Un turno completo: arma contexto → pregunta al cerebro → aplica cambios → guarda historial.
 * Devuelve el texto a enviar por WhatsApp (el envío lo hace quien llama).
 */
export async function runTurn(deps: Deps, user: User, input: TurnInput, userText?: string): Promise<string> {
  const now = deps.now?.() ?? new Date();
  const { store } = deps;

  const [items, history, doneToday] = await Promise.all([
    store.listActiveItems(user.id),
    store.recentMessages(user.id, HISTORY_LIMIT),
    store.countDoneSince(user.id, localMidnightIso(now, user.timezone)),
  ]);

  const out = await deps.brain.think({ user, items, history, input, now, doneToday });
  await applyOutput(store, user, items, out, now, input);

  if (input.type === "message") {
    await store.addMessage({ userId: user.id, role: "user", text: userText ?? input.text });
  }
  await store.addMessage({ userId: user.id, role: "assistant", text: out.reply });
  return out.reply;
}

export async function applyOutput(
  store: Store,
  user: User,
  items: Item[],
  out: BrainOutput,
  now: Date,
  input: TurnInput,
): Promise<void> {
  const nowIso = now.toISOString();
  const byRef = (ref: string): Item | undefined => {
    const m = /^t(\d+)$/.exec(ref.trim());
    return m ? items[Number(m[1]) - 1] : undefined;
  };

  // Pendientes nuevos
  const created = await store.addItems(
    out.new_items.map((n) => ({
      userId: user.id,
      kind: n.kind,
      title: n.title,
      firstStep: n.first_step,
      due: n.due || null,
      estimateMinutes: n.estimate_minutes || null,
    })),
  );

  // Cambios de estado (completado gana sobre empezado si vienen los dos)
  const completed = new Set(out.completed_item_refs.map(byRef).filter(Boolean).map((i) => i!.id));
  const dropped = new Set(out.dropped_item_refs.map(byRef).filter(Boolean).map((i) => i!.id));
  for (const ref of out.started_item_refs) {
    const it = byRef(ref);
    if (it && it.status === "open" && !completed.has(it.id) && !dropped.has(it.id)) {
      await store.updateItem(it.id, { status: "started", startedAt: nowIso });
    }
  }
  for (const id of completed) {
    const it = items.find((i) => i.id === id)!;
    await store.updateItem(id, { status: "done", doneAt: nowIso, startedAt: it.startedAt ?? nowIso });
  }
  for (const id of dropped) if (!completed.has(id)) await store.updateItem(id, { status: "dropped" });

  // Perfil de la persona
  const patch: Partial<User> = {};
  if (input.type === "message") patch.lastInboundAt = nowIso;

  const focusRef = out.focus_item_ref;
  if (focusRef.startsWith("new:")) {
    const it = created[Number(focusRef.slice(4))];
    if (it) patch.focusItemId = it.id;
  } else if (focusRef) {
    const it = byRef(focusRef);
    if (it) patch.focusItemId = it.id;
  }
  const finishedFocus = user.focusItemId && (completed.has(user.focusItemId) || dropped.has(user.focusItemId));
  if (finishedFocus && patch.focusItemId === undefined) patch.focusItemId = null;

  if (out.energy !== "no_change") patch.energy = out.energy;

  if (out.checkin_in_minutes > 0) {
    patch.checkinAt = new Date(now.getTime() + out.checkin_in_minutes * 60_000).toISOString();
  } else if (input.type === "event" && input.name === "checkin") {
    patch.checkinAt = null;
  }

  if (out.new_notes.length) {
    const merged = [...user.notes, ...out.new_notes.filter((n) => !user.notes.includes(n))];
    patch.notes = merged.slice(-MAX_NOTES);
  }

  if (out.voice) patch.voice = out.voice;
  if (out.new_routines.length) {
    const merged = [...user.routines, ...out.new_routines.filter((r) => !user.routines.includes(r))];
    patch.routines = merged.slice(-MAX_ROUTINES);
  }

  const s = out.settings;
  if (s.name) patch.name = s.name;
  if (s.timezone && isValidTimeZone(s.timezone)) patch.timezone = s.timezone;
  if (isValidTime(s.morning_time)) patch.morningTime = s.morning_time;
  if (isValidTime(s.evening_time)) patch.eveningTime = s.evening_time;
  if (s.proactive !== "no_change") patch.proactive = s.proactive === "on";

  if (Object.keys(patch).length) await store.updateUser(user.id, patch);
}
