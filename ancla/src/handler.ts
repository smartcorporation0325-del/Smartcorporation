import type { Brain } from "./brain.ts";
import { config } from "./config.ts";
import { countryFromPhone } from "./dialect.ts";
import type { Store } from "./store/index.ts";
import { isValidTime, isValidTimeZone, localMidnightIso, localToIso } from "./time.ts";
import type { BrainOutput, Item, Reminder, TurnInput, User } from "./types.ts";

const HISTORY_LIMIT = 40;
const MAX_NOTES = 40;
const MAX_ROUTINES = 30;
const MAX_PEOPLE = 40;
const MAX_PENDING_REMINDERS = 40;
const REMINDER_HORIZON_DAYS = 60;
const OBSERVATION_DAYS_IN_CONTEXT = 7;
const OBSERVATION_DAYS_TO_CONSOLIDATE = 14;
const DAY_MS = 86_400_000;

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

  const since = new Date(now.getTime() - OBSERVATION_DAYS_IN_CONTEXT * DAY_MS).toISOString();
  const [items, history, doneToday, reminders, observations] = await Promise.all([
    store.listActiveItems(user.id),
    store.recentMessages(user.id, HISTORY_LIMIT),
    store.countDoneSince(user.id, localMidnightIso(now, user.timezone)),
    store.listPendingReminders(user.id),
    store.listObservationsSince(user.id, since, 40),
  ]);

  const out = await deps.brain.think({ user, items, history, input, now, doneToday, reminders, observations });
  await applyOutput(store, user, items, reminders, out, now, input);

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
  reminders: Reminder[],
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

  // Recordatorios: cancelar los que ya no hacen falta y crear los nuevos
  const cancelIds = out.cancel_reminder_refs
    .map((ref) => {
      const m = /^r(\d+)$/.exec(ref.trim());
      return m ? reminders[Number(m[1]) - 1]?.id : undefined;
    })
    .filter((id): id is string => Boolean(id));
  if (cancelIds.length) await store.setReminderStatus(cancelIds, "cancelled");

  const horizon = now.getTime() + REMINDER_HORIZON_DAYS * DAY_MS;
  let room = MAX_PENDING_REMINDERS - (reminders.length - cancelIds.length);
  const newReminders: Parameters<Store["addReminders"]>[0] = [];
  for (const r of out.reminders) {
    const iso = localToIso(r.when, user.timezone);
    if (!iso || room <= 0) continue;
    const t = Date.parse(iso);
    if (t <= now.getTime() || t > horizon) continue; // pasado o demasiado lejano
    const same = (x: { remindAt: string; text: string }) => x.remindAt === iso && x.text === r.text;
    if (reminders.some(same) || newReminders.some(same)) continue;
    newReminders.push({ userId: user.id, remindAt: iso, text: r.text, quote: r.quote, saidAt: nowIso });
    room--;
  }
  if (newReminders.length) await store.addReminders(newReminders);

  // Lo que estaba haciendo y cómo estaba (se analiza de noche)
  if (input.type === "message" && (out.observation.activity || out.observation.note)) {
    await store.addObservation({ userId: user.id, at: nowIso, ...out.observation });
  }

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
  if (out.profile) patch.profile = out.profile;
  if (out.people.length) {
    const people = [...user.people];
    for (const p of out.people) {
      const i = people.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase());
      if (i >= 0) people[i] = { name: people[i].name, relation: p.relation || people[i].relation, note: p.note || people[i].note };
      else people.push(p);
    }
    patch.people = people.slice(-MAX_PEOPLE);
  }
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

/**
 * Memoria nocturna: convierte las observaciones de los últimos días en rutinas, perfil y voz.
 * Devuelve true si hubo algo que analizar.
 */
export async function consolidate(deps: Deps, user: User, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - OBSERVATION_DAYS_TO_CONSOLIDATE * DAY_MS).toISOString();
  const observations = await deps.store.listObservationsSince(user.id, since, 150);
  if (observations.length < 3) return false; // todavía no hay material para sacar patrones

  const out = await deps.brain.consolidate({ user, observations, now });
  const patch: Partial<User> = {};
  if (out.routines.length) patch.routines = out.routines.slice(0, MAX_ROUTINES);
  if (out.profile) patch.profile = out.profile;
  if (out.voice) patch.voice = out.voice;
  if (Object.keys(patch).length) await deps.store.updateUser(user.id, patch);
  return true;
}
