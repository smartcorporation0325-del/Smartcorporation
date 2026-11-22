import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleInbound, runTick, type AppDeps } from "../src/app.ts";
import { buildContext, buildMessages, normalizeOutput, type Brain, type BrainContext, type ConsolidationContext, type ConsolidationOutput } from "../src/brain.ts";
import { getOrCreateUser, runTurn } from "../src/handler.ts";
import { countryFromPhone } from "../src/dialect.ts";
import { dueEvent, withinServiceWindow } from "../src/scheduler.ts";
import { MemoryStore } from "../src/store/memory.ts";
import { localParts, localToIso, whenPhrase } from "../src/time.ts";
import type { BrainOutput, User } from "../src/types.ts";
import { ConsoleSender, parseWebhook, verifySignature } from "../src/whatsapp.ts";
import { privacyHtml } from "../src/privacy.ts";
import { cleanQuickReplies } from "../src/quickReplies.ts";
import { MAX_VOICE_CHARS, speechText, voiceInstructions } from "../src/tts.ts";
import { helpText, matchCommand, privacyText, welcomeText, WELCOME_BUTTONS } from "../src/onboarding.ts";
import { SYSTEM_PROMPT } from "../src/prompt.ts";
import { chooseMode, normalizeForMode, DEEP_MIN_CHARS } from "../src/modes.ts";
import { createApp } from "../src/server.ts";

/** Cerebro falso: devuelve lo que el test le diga y recuerda el contexto que recibió. */
class FakeBrain implements Brain {
  calls: BrainContext[] = [];
  next: Partial<BrainOutput> = {};
  consolidated: ConsolidationOutput = { routines: [], profile: "", voice: "" };
  consolidations: ConsolidationContext[] = [];
  async consolidate(ctx: ConsolidationContext) {
    this.consolidations.push(ctx);
    return this.consolidated;
  }
  async think(ctx: BrainContext) {
    this.calls.push(ctx);
    return normalizeOutput({ reply: "ok", ...this.next });
  }
}

function setup(now = new Date("2026-11-23T14:00:00Z")) {
  const store = new MemoryStore();
  const brain = new FakeBrain();
  const sender = new ConsoleSender();
  const deps: AppDeps = { store, brain, sender, now: () => now };
  return { store, brain, sender, deps, now };
}

const textMsg = (id: string, text: string) =>
  ({ id, from: "521555", profileName: "Ana", type: "text", text }) as const;

test("brain dump: guarda pendientes y responde", async () => {
  const { deps, brain, store, sender } = setup();
  brain.next = {
    reply: "Guardé 2 cosas.",
    new_items: [
      { kind: "task", title: "Pagar luz", first_step: "Abre la app del banco", due: "2026-11-25", estimate_minutes: 10 },
      { kind: "worry", title: "Junta con jefe", first_step: "", due: "", estimate_minutes: 0 },
    ],
    focus_item_ref: "new:0",
  };
  await handleInbound(deps, textMsg("m1", "tengo que pagar la luz y me preocupa la junta"));

  // Es un número nuevo: primero la bienvenida (con botones) y luego la respuesta
  assert.equal(sender.sent.length, 2);
  assert.deepEqual(sender.sent[0].buttons, ["Empezar", "¿Qué puedes hacer?"]);
  assert.deepEqual(sender.sent[1], { to: "521555", text: "Guardé 2 cosas.", template: false });
  const user = (await store.getUserByPhone("521555"))!;
  assert.equal(user.name, "Ana");
  const items = await store.listActiveItems(user.id);
  assert.equal(items.length, 2);
  assert.equal(items[0].due, "2026-11-25");
  assert.equal(items[1].estimateMinutes, null);
  assert.equal(user.focusItemId, items[0].id);
  assert.ok(user.lastInboundAt);
  assert.equal((await store.recentMessages(user.id, 10)).length, 3, "bienvenida + mensaje + respuesta");
});

test("mensajes duplicados de Meta se procesan una sola vez", async () => {
  const { deps, brain } = setup();
  await handleInbound(deps, textMsg("dup", "hola"));
  await handleInbound(deps, textMsg("dup", "hola"));
  assert.equal(brain.calls.length, 1);
});

test("completar, empezar y soltar pendientes por referencia corta", async () => {
  const { deps, brain, store } = setup();
  const user = await getOrCreateUser(store, "521555");
  const [a, b, c] = await store.addItems(
    ["A", "B", "C"].map((title) => ({ userId: user.id, kind: "task" as const, title, firstStep: "", due: null, estimateMinutes: null })),
  );
  await store.updateUser(user.id, { focusItemId: a.id });

  brain.next = { completed_item_refs: ["t1"], started_item_refs: ["t2", "t1"], dropped_item_refs: ["t3"], checkin_in_minutes: 15 };
  await runTurn(deps, (await store.getUserByPhone("521555"))!, { type: "message", text: "ya pagué A, empiezo B, olvida C" });

  assert.equal(store.items.get(a.id)!.status, "done");
  assert.equal(store.items.get(b.id)!.status, "started");
  assert.equal(store.items.get(c.id)!.status, "dropped");
  const fresh = (await store.getUserByPhone("521555"))!;
  assert.equal(fresh.focusItemId, null, "la 1 cosa terminada se limpia");
  assert.equal(fresh.checkinAt, "2026-11-23T14:15:00.000Z");
  assert.equal(await store.countDoneSince(user.id, "2026-11-23T00:00:00Z"), 1);
});

test("ajustes válidos se aplican y los inválidos se ignoran", async () => {
  const { deps, brain, store } = setup();
  const user = await getOrCreateUser(store, "521555");
  brain.next = {
    settings: { name: "Ani", timezone: "Marte/Olympus", morning_time: "07:15", evening_time: "25:00", proactive: "off" },
    new_notes: ["Trabaja de 9 a 6"],
    energy: "low",
  };
  await runTurn(deps, user, { type: "message", text: "..." });
  const u = (await store.getUserByPhone("521555"))!;
  assert.equal(u.name, "Ani");
  assert.equal(u.timezone, "America/Mexico_City");
  assert.equal(u.morningTime, "07:15");
  assert.equal(u.eveningTime, "21:00");
  assert.equal(u.proactive, false);
  assert.equal(u.energy, "low");
  assert.deepEqual(u.notes, ["Trabaja de 9 a 6"]);
});

test("normalizeOutput tolera basura del modelo", () => {
  const o = normalizeOutput({ reply: "  ", new_items: [{ title: "" }, { title: "X", kind: "rara" }], energy: "furioso", checkin_in_minutes: -5 });
  assert.ok(o.reply.length > 0);
  assert.equal(o.new_items.length, 1);
  assert.equal(o.new_items[0].kind, "task");
  assert.equal(o.energy, "no_change");
  assert.equal(o.checkin_in_minutes, 0);
});

const baseUser = (patch: Partial<User> = {}): User => ({
  id: "u", phone: "1", name: "", timezone: "America/Mexico_City", morningTime: "08:30", eveningTime: "21:00",
  proactive: true, energy: "unknown", focusItemId: null, notes: [], voice: "", routines: [], profile: "", people: [], lastInboundAt: null, lastMorningDate: null,
  lastEveningDate: null, checkinAt: null, createdAt: "", ...patch,
});

test("scheduler: buenos días, cierre y check-in a su hora local", () => {
  // 14:40 UTC = 08:40 en Ciudad de México (UTC-6)
  const t = new Date("2026-11-23T14:40:00Z");
  assert.equal(localParts(t, "America/Mexico_City").time, "08:40");
  assert.equal(dueEvent(baseUser(), t), "morning");
  assert.equal(dueEvent(baseUser({ lastMorningDate: "2026-11-23" }), t), null);
  assert.equal(dueEvent(baseUser({ proactive: false }), t), null);
  assert.equal(dueEvent(baseUser({ checkinAt: "2026-11-23T14:30:00Z", lastMorningDate: "2026-11-23" }), t), "checkin");
  // 03:10 UTC del 24 = 21:10 del 23 en CDMX
  assert.equal(dueEvent(baseUser(), new Date("2026-11-24T03:10:00Z")), "evening");
  // Muy tarde para el buenos días (más de 90 min después)
  assert.equal(dueEvent(baseUser(), new Date("2026-11-23T17:00:00Z")), null);
});

test("ventana de 24 h de WhatsApp", () => {
  const now = new Date("2026-11-23T14:00:00Z");
  assert.equal(withinServiceWindow(baseUser(), now), false);
  assert.equal(withinServiceWindow(baseUser({ lastInboundAt: "2026-11-23T01:00:00Z" }), now), true);
  assert.equal(withinServiceWindow(baseUser({ lastInboundAt: "2026-11-22T13:00:00Z" }), now), false);
});

test("tick: manda el buenos días una sola vez y no escribe fuera de la ventana sin plantilla", async () => {
  const now = new Date("2026-11-23T14:40:00Z");
  const { deps, store, sender, brain } = setup(now);
  const u1 = await getOrCreateUser(store, "5215551");
  await store.updateUser(u1.id, { lastInboundAt: "2026-11-23T02:00:00Z" });
  await getOrCreateUser(store, "5215552"); // nunca escribió: fuera de la ventana

  brain.next = { reply: "Buenos días. Tu 1 cosa: ..." };
  assert.equal(await runTick(deps, now), 2);
  assert.deepEqual(sender.sent, [{ to: "5215551", text: "Buenos días. Tu 1 cosa: ...", template: false }]);
  assert.equal(brain.calls[0].input.type, "event");

  sender.sent.length = 0;
  assert.equal(await runTick(deps, now), 0, "no repite el mismo día");
  assert.equal(sender.sent.length, 0);
});

test("audio sin transcripción configurada pide texto", async () => {
  const { deps, sender, brain } = setup();
  await getOrCreateUser(deps.store, "521555");
  deps.fetchMedia = async () => ({ data: Buffer.from("x"), mimeType: "audio/ogg" });
  deps.transcribeAudio = async () => null;
  await handleInbound(deps, { id: "a1", from: "521555", profileName: "", type: "audio", mediaId: "m" });
  assert.equal(brain.calls.length, 0);
  assert.match(sender.sent[0].text, /audios/);
});

test("audio transcrito y foto llegan al cerebro", async () => {
  const { deps, brain } = setup();
  await getOrCreateUser(deps.store, "521555");
  deps.fetchMedia = async (id) =>
    id === "aud" ? { data: Buffer.from("x"), mimeType: "audio/ogg" } : { data: Buffer.from("img"), mimeType: "image/jpeg" };
  deps.transcribeAudio = async () => "tengo mil cosas";
  await handleInbound(deps, { id: "a2", from: "521555", profileName: "", type: "audio", mediaId: "aud" });
  await handleInbound(deps, { id: "i1", from: "521555", profileName: "", type: "image", mediaId: "img", caption: "mi escritorio" });
  assert.deepEqual(brain.calls[0].input, { type: "message", text: "(audio transcrito) tengo mil cosas" });
  const img = brain.calls[1].input;
  assert.ok(img.type === "message" && img.image?.base64 === Buffer.from("img").toString("base64"));
});

test("contexto y mensajes para Claude", async () => {
  const { store } = setup();
  const user = await getOrCreateUser(store, "1");
  const [item] = await store.addItems([{ userId: user.id, kind: "task", title: "Pagar luz", firstStep: "Abrir app", due: null, estimateMinutes: 10 }]);
  const ctx: BrainContext = {
    user: { ...user, focusItemId: item.id, notes: ["Le gusta la música"] },
    items: [item],
    history: [{ userId: user.id, role: "assistant", text: "Buenos días", createdAt: "" }],
    input: { type: "message", text: "hola" },
    now: new Date("2026-11-23T14:40:00Z"),
    doneToday: 0,
    reminders: [],
    observations: [],
  };
  const c = buildContext(ctx);
  assert.match(c, /t1 \[task\] Pagar luz .*ES SU 1 COSA DE HOY/);
  assert.match(c, /Le gusta la música/);
  const msgs = buildMessages(ctx);
  assert.equal(msgs[0].role, "user", "la conversación siempre empieza con user");
  assert.equal(msgs.at(-1)!.role, "user");
});

test("webhook: firma y parseo", () => {
  const body = Buffer.from(JSON.stringify({ hola: 1 }));
  const sig = "sha256=" + createHmac("sha256", "secreto").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "secreto"), true);
  assert.equal(verifySignature(body, "sha256=abc", "secreto"), false);
  assert.equal(verifySignature(body, undefined, "secreto"), false);

  const payload = {
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: "521555", profile: { name: "Ana" } }],
      messages: [
        { id: "w1", from: "521555", type: "text", text: { body: "hola" } },
        { id: "w2", from: "521555", type: "audio", audio: { id: "media1" } },
        { id: "w3", from: "521555", type: "sticker", sticker: {} },
      ],
    } }] }],
  };
  const msgs = parseWebhook(payload);
  assert.equal(msgs.length, 3);
  assert.deepEqual(msgs[0], { id: "w1", from: "521555", profileName: "Ana", type: "text", text: "hola" });
  assert.equal(msgs[1].type, "audio");
  assert.equal(msgs[2].type, "unsupported");
  assert.deepEqual(parseWebhook({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] }), []);
});

test("dialecto y zona horaria según el teléfono", async () => {
  assert.equal(countryFromPhone("584141234567")?.timezone, "America/Caracas");
  assert.match(countryFromPhone("584141234567")!.dialect, /venezolano/);
  assert.equal(countryFromPhone("5215512345678")?.timezone, "America/Mexico_City");
  assert.equal(countryFromPhone("18095551234")?.timezone, "America/Santo_Domingo");
  assert.equal(countryFromPhone("999"), null);
  const { store } = setup();
  assert.equal((await getOrCreateUser(store, "584141234567")).timezone, "America/Caracas");
});

test("aprende su voz y sus rutinas, sin duplicar y con tope", async () => {
  const { deps, brain, store } = setup();
  const user = await getOrCreateUser(store, "584141234567");
  brain.next = {
    voice: "Venezolana. Amiga cercana, dice 'chama', mensajes cortos, sin emojis.",
    new_routines: ["Se despierta a las 7", "Rinde mejor en la tarde"],
  };
  await runTurn(deps, user, { type: "message", text: "chama hola" });
  let u = (await store.getUserByPhone("584141234567"))!;
  assert.match(u.voice, /Venezolana/);
  assert.equal(u.routines.length, 2);

  brain.next = { new_routines: ["Se despierta a las 7", "Hace ejercicio los lunes"] };
  await runTurn(deps, u, { type: "message", text: "..." });
  u = (await store.getUserByPhone("584141234567"))!;
  assert.match(u.voice, /Venezolana/, "voz vacía = sin cambio");
  assert.deepEqual(u.routines, ["Se despierta a las 7", "Rinde mejor en la tarde", "Hace ejercicio los lunes"]);

  brain.next = { new_routines: Array.from({ length: 40 }, (_, i) => `rutina ${i}`) };
  await runTurn(deps, u, { type: "message", text: "..." });
  u = (await store.getUserByPhone("584141234567"))!;
  assert.equal(u.routines.length, 30);
  assert.equal(u.routines.at(-1), "rutina 39");
});

test("el contexto incluye dialecto, voz y rutinas", () => {
  const base = {
    items: [], history: [], input: { type: "message", text: "hola" } as const,
    now: new Date("2026-11-23T14:40:00Z"), doneToday: 0, reminders: [], observations: [],
  };
  const withVoice = buildContext({
    ...base,
    user: baseUser({ phone: "584141234567", voice: "Mucha confianza, dice chama", routines: ["Se despierta a las 7"] }),
  });
  assert.match(withVoice, /Venezuela → venezolano/);
  assert.match(withVoice, /Mucha confianza, dice chama/);
  assert.match(withVoice, /Se despierta a las 7/);
  const fresh = buildContext({ ...base, user: baseUser({ phone: "584141234567" }) });
  assert.match(fresh, /todavía nada/);
});

test("conversión de hora local a UTC y frases de tiempo", () => {
  assert.equal(localToIso("2026-11-23T08:00", "America/Caracas"), "2026-11-23T12:00:00.000Z");
  assert.equal(localToIso("2026-11-23T08:00", "America/Mexico_City"), "2026-11-23T14:00:00.000Z");
  assert.equal(localToIso("2026-02-31T10:00", "America/Caracas"), null);
  assert.equal(localToIso("mañana 3pm", "America/Caracas"), null);
  const now = new Date("2026-11-23T20:00:00Z"); // 14:00 en CDMX
  assert.equal(whenPhrase("2026-11-23T14:42:00Z", now, "America/Mexico_City"), "hoy en la mañana (08:42)");
  assert.equal(whenPhrase("2026-11-23T19:00:00Z", now, "America/Mexico_City"), "hoy en la tarde (13:00)");
  assert.equal(whenPhrase("2026-11-22T21:10:00Z", now, "America/Mexico_City"), "ayer (15:10)");
});

test("crea recordatorios con sus palabras, ignora los inválidos y evita duplicados", async () => {
  const { deps, brain, store } = setup(new Date("2026-11-23T14:00:00Z")); // 08:00 CDMX
  const user = await getOrCreateUser(store, "521555");
  const r = { when: "2026-11-23T15:00", text: "Llamar al dentista", quote: "después del almuerzo llamo al dentista" };
  brain.next = {
    reminders: [
      r,
      { when: "2026-11-23T07:00", text: "ya pasó", quote: "" }, // en el pasado
      { when: "mañana", text: "formato malo", quote: "" },
      { when: "2027-06-01T10:00", text: "muy lejano", quote: "" },
    ],
  };
  await runTurn(deps, user, { type: "message", text: "después del almuerzo llamo al dentista" });
  let pending = await store.listPendingReminders(user.id);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].remindAt, "2026-11-23T21:00:00.000Z");
  assert.equal(pending[0].quote, "después del almuerzo llamo al dentista");
  assert.equal(pending[0].saidAt, "2026-11-23T14:00:00.000Z");

  brain.next = { reminders: [r] }; // el mismo otra vez
  await runTurn(deps, user, { type: "message", text: "..." });
  assert.equal((await store.listPendingReminders(user.id)).length, 1);

  brain.next = { cancel_reminder_refs: ["r1", "r9"] };
  await runTurn(deps, user, { type: "message", text: "ya llamé" });
  pending = await store.listPendingReminders(user.id);
  assert.equal(pending.length, 0);
  assert.match(JSON.stringify(brain.calls.at(-1)!.reminders.map((x) => x.text)), /dentista/);
});

test("el recordatorio llega a su hora citando lo que dijo, una sola vez", async () => {
  const said = new Date("2026-11-23T14:00:00Z"); // 08:00 CDMX
  const { deps, store, sender, brain } = setup(said);
  const user = await getOrCreateUser(store, "521555");
  await store.updateUser(user.id, { lastInboundAt: said.toISOString(), lastMorningDate: "2026-11-23", lastEveningDate: "2026-11-23" });
  await store.addReminders([
    { userId: user.id, remindAt: "2026-11-23T21:00:00.000Z", text: "Llamar al dentista", quote: "después del almuerzo llamo al dentista", saidAt: said.toISOString() },
  ]);

  assert.equal(await runTick(deps, new Date("2026-11-23T20:00:00Z")), 0, "todavía no es la hora");

  brain.next = { reply: "Oye, esta mañana me dijiste que llamabas al dentista" };
  const at = new Date("2026-11-23T21:05:00Z"); // 15:05 CDMX
  assert.equal(await runTick({ ...deps, now: () => at }, at), 1);
  assert.deepEqual(sender.sent.map((m) => m.text), ["Oye, esta mañana me dijiste que llamabas al dentista"]);
  const input = brain.calls.at(-1)!.input;
  assert.ok(input.type === "event" && input.name === "reminder" && input.reminders[0].quote.includes("dentista"));
  assert.equal((await store.listPendingReminders(user.id)).length, 0);

  sender.sent.length = 0;
  assert.equal(await runTick({ ...deps, now: () => at }, at), 0, "no se repite");
  assert.equal(sender.sent.length, 0);
});

test("un recordatorio muy atrasado ya no se manda solo, pero aparece como VENCIDO", async () => {
  const { deps, store, sender, brain } = setup(new Date("2026-11-23T14:00:00Z"));
  const user = await getOrCreateUser(store, "521555");
  await store.updateUser(user.id, { lastInboundAt: "2026-11-23T14:00:00Z", lastMorningDate: "2026-11-23", lastEveningDate: "2026-11-23" });
  await store.addReminders([
    { userId: user.id, remindAt: "2026-11-23T14:30:00.000Z", text: "Pagar el internet", quote: "pago el internet hoy", saidAt: "2026-11-23T14:00:00.000Z" },
  ]);
  const late = new Date("2026-11-23T22:00:00Z"); // 7,5 h después
  assert.equal(await runTick({ ...deps, now: () => late }, late), 0);
  assert.equal(sender.sent.length, 0);

  await runTurn({ ...deps, now: () => late }, (await store.getUserByPhone("521555"))!, { type: "message", text: "hola" });
  const ctx = buildContext(brain.calls.at(-1)!);
  assert.match(ctx, /r1 \[.*VENCIDO\] Pagar el internet — ella dijo: "pago el internet hoy"/);
});

test("guarda observaciones, personas y perfil sin pisar lo anterior", async () => {
  const { deps, brain, store } = setup();
  const user = await getOrCreateUser(store, "521555");
  brain.next = {
    observation: { activity: "viendo reels", state: "distracted", note: "después de comer" },
    people: [{ name: "Marta", relation: "jefa", note: "pide reportes los lunes" }],
    profile: "Creativa, se abruma con listas largas.",
  };
  await runTurn(deps, user, { type: "message", text: "me puse a ver reels, Marta quiere el reporte" });
  const obs = await store.listObservationsSince(user.id, "2026-01-01T00:00:00Z", 10);
  assert.deepEqual(obs.map((o) => [o.activity, o.state]), [["viendo reels", "distracted"]]);

  brain.next = { people: [{ name: "marta", relation: "", note: "pide reportes los lunes y odia los retrasos" }, { name: "Luis", relation: "pareja", note: "" }] };
  await runTurn(deps, (await store.getUserByPhone("521555"))!, { type: "message", text: "..." });
  const u = (await store.getUserByPhone("521555"))!;
  assert.deepEqual(u.people, [
    { name: "Marta", relation: "jefa", note: "pide reportes los lunes y odia los retrasos" },
    { name: "Luis", relation: "pareja", note: "" },
  ]);
  assert.equal(u.profile, "Creativa, se abruma con listas largas.", "perfil vacío = sin cambio");

  brain.next = { observation: { activity: "", state: "unknown", note: "" } };
  await runTurn(deps, u, { type: "message", text: "ok" });
  assert.equal((await store.listObservationsSince(u.id, "2026-01-01T00:00:00Z", 10)).length, 1, "sin actividad no se anota");
});

test("cada noche consolida lo observado en rutinas y perfil", async () => {
  const now = new Date("2026-11-24T03:10:00Z"); // 21:10 del 23 en CDMX
  const { deps, store, sender, brain } = setup(now);
  const user = await getOrCreateUser(store, "521555");
  await store.updateUser(user.id, { lastInboundAt: "2026-11-23T20:00:00Z", lastMorningDate: "2026-11-23" });
  for (const [at, state] of [["2026-11-22T22:00:00Z", "distracted"], ["2026-11-23T14:00:00Z", "focused"]] as const) {
    await store.addObservation({ userId: user.id, at, activity: "algo", state, note: "" });
  }
  brain.consolidated = { routines: ["A media tarde se distrae con redes"], profile: "Creativa y muy sensible a la presión.", voice: "" };

  // Con solo 2 observaciones todavía no hay material
  await runTick(deps, now);
  assert.equal(brain.consolidations.length, 0);

  await store.updateUser(user.id, { lastEveningDate: null });
  await store.addObservation({ userId: user.id, at: "2026-11-23T20:00:00Z", activity: "reels", state: "distracted", note: "" });
  await runTick(deps, now);
  assert.equal(brain.consolidations.length, 1);
  const u = (await store.getUserByPhone("521555"))!;
  assert.deepEqual(u.routines, ["A media tarde se distrae con redes"]);
  assert.equal(u.profile, "Creativa y muy sensible a la presión.");
  assert.equal(sender.sent.length, 2, "el cierre del día se manda en ambos ticks");
});

test("/olvidar pide confirmación y /olvidar todo borra lo aprendido", async () => {
  const { deps, store, sender, brain } = setup();
  const user = await getOrCreateUser(store, "521555");
  await store.updateUser(user.id, { voice: "chama", profile: "x", routines: ["y"], notes: ["z"], people: [{ name: "A", relation: "", note: "" }] });
  await store.addItems([{ userId: user.id, kind: "task", title: "T", firstStep: "", due: null, estimateMinutes: null }]);
  await store.addObservation({ userId: user.id, at: "2026-11-23T14:00:00Z", activity: "a", state: "focused", note: "" });

  await handleInbound(deps, textMsg("o1", "/olvidar"));
  assert.match(sender.sent[0].text, /\/olvidar todo/);
  assert.equal((await store.getUserByPhone("521555"))!.profile, "x", "todavía no borra");

  await handleInbound(deps, textMsg("o2", "/Olvidar TODO"));
  const u = (await store.getUserByPhone("521555"))!;
  assert.deepEqual([u.voice, u.profile, u.routines, u.notes, u.people], ["", "", [], [], []]);
  assert.equal((await store.listActiveItems(u.id)).length, 0);
  assert.equal((await store.listObservationsSince(u.id, "2000-01-01T00:00:00Z", 5)).length, 0);
  assert.equal(brain.calls.length, 0, "los comandos no pasan por el modelo");
});

test("el contexto incluye perfil, gente, recordatorios, lo de hoy y lo observado", () => {
  const user = baseUser({
    phone: "584141234567", timezone: "America/Caracas", profile: "Creativa", people: [{ name: "Marta", relation: "jefa", note: "pide reportes" }],
  });
  const ctx = buildContext({
    user, items: [], now: new Date("2026-11-23T20:00:00Z"), doneToday: 0, input: { type: "message", text: "hola" },
    history: [
      { userId: "u", role: "user", text: "después del almuerzo llamo al dentista", createdAt: "2026-11-23T12:42:00Z" },
      { userId: "u", role: "user", text: "mensaje de ayer", createdAt: "2026-11-22T12:42:00Z" },
    ],
    reminders: [{ id: "x", userId: "u", remindAt: "2026-11-23T19:00:00Z", text: "Llamar al dentista", quote: "después del almuerzo llamo al dentista", saidAt: "2026-11-23T12:42:00Z", status: "pending" }],
    observations: [{ userId: "u", at: "2026-11-23T19:30:00Z", activity: "viendo reels", state: "distracted", note: "" }],
  });
  assert.match(ctx, /Creativa/);
  assert.match(ctx, /Marta \(jefa\): pide reportes/);
  assert.match(ctx, /r1 \[hoy 15:00 — VENCIDO\] Llamar al dentista — ella dijo: "después del almuerzo llamo al dentista" \(hoy en la mañana \(08:42\)\)/);
  assert.match(ctx, /Lo que ella te dijo hoy \(con hora\):\n- 08:42 después del almuerzo llamo al dentista/);
  assert.doesNotMatch(ctx, /mensaje de ayer/);
  assert.match(ctx, /distracted — viendo reels/);
});

test("la política de privacidad se sirve en /privacy y escapa el correo", async () => {
  const html = privacyHtml("Ancla", 'yo@example.com"><script>x</script>');
  assert.doesNotMatch(html, /<script>x/);
  assert.match(html, /mailto:yo@example\.com/);
  assert.match(html, /\/olvidar todo/);

  const { deps } = setup();
  const server = createApp(deps).listen(0);
  try {
    await new Promise((r) => server.once("listening", r));
    const { port } = server.address() as { port: number };
    const res = await fetch(`http://127.0.0.1:${port}/privacy`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await res.text(), /Política de privacidad de Ancla/);
  } finally {
    server.close();
  }
});

test("si la transcripción falla, viene vacía o el audio es enorme, responde con calidez y no llama al modelo", async () => {
  const { deps, brain, sender } = setup();
  const audio = (id: string) => ({ id, from: "521555", profileName: "", type: "audio", mediaId: "m" }) as const;
  deps.fetchMedia = async () => ({ data: Buffer.from("x"), mimeType: "audio/ogg" });

  deps.transcribeAudio = async () => {
    throw new Error("servicio caído");
  };
  await handleInbound(deps, audio("f1"));
  assert.match(sender.sent.at(-1)!.text, /No logré escuchar/);

  deps.transcribeAudio = async () => "";
  await handleInbound(deps, audio("f2"));
  assert.match(sender.sent.at(-1)!.text, /No alcancé a entender/);

  deps.fetchMedia = async () => ({ data: Buffer.alloc(9 * 1024 * 1024), mimeType: "audio/ogg" });
  deps.transcribeAudio = async () => "no debería llamarse";
  await handleInbound(deps, audio("f3"));
  assert.match(sender.sent.at(-1)!.text, /muy largo/);

  assert.equal(brain.calls.length, 0);
});

test("los botones de respuesta rápida se limpian, llegan con el mensaje y al tocarlos entran como texto", async () => {
  assert.deepEqual(cleanQuickReplies([" Ya empecé ", "ya empecé", "", 5, "Una etiqueta demasiado larga", "Más tarde", "Otra"]), [
    "Ya empecé",
    "Una etiqueta demasia",
    "Más tarde",
  ]);
  assert.deepEqual(cleanQuickReplies("no es lista"), []);
  assert.deepEqual(normalizeOutput({ reply: "x", quick_replies: ["Va", "va"] }).quick_replies, ["Va"]);
  assert.deepEqual(normalizeOutput({ reply: "x" }).quick_replies, []);
  assert.match(SYSTEM_PROMPT, /quick_replies/);

  const { deps, brain, sender } = setup();
  await getOrCreateUser(deps.store, "521555");
  brain.next = { reply: "¿Empiezas por la luz?", quick_replies: ["Va", "Otra cosa", "Hoy no"] };
  await handleInbound(deps, textMsg("q1", "hola"));
  assert.deepEqual(sender.sent[0], { to: "521555", text: "¿Empiezas por la luz?", template: false, buttons: ["Va", "Otra cosa", "Hoy no"] });

  // Sin botones sigue saliendo como texto simple
  brain.next = { reply: "Aquí estoy" };
  await handleInbound(deps, textMsg("q2", "gracias"));
  assert.deepEqual(sender.sent[1], { to: "521555", text: "Aquí estoy", template: false });

  // Lo que llega cuando ella toca un botón
  const parsed = parseWebhook({
    entry: [{ changes: [{ value: { messages: [
      { id: "b1", from: "521555", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "qr1", title: "Ya empecé" } } },
    ] } }] }],
  });
  assert.deepEqual(parsed, [{ id: "b1", from: "521555", profileName: "", type: "text", text: "Ya empecé" }]);
});

test("los mensajes que Ancla manda por su cuenta también llevan botones dentro de la ventana de 24 h", async () => {
  const now = new Date("2026-11-23T14:40:00Z");
  const { deps, store, sender, brain } = setup(now);
  const user = await getOrCreateUser(store, "5215551");
  await store.updateUser(user.id, { lastInboundAt: "2026-11-23T02:00:00Z" });
  brain.next = { reply: "Buenos días. Tu 1 cosa: la luz. ¿Va?", quick_replies: ["Va", "Otra cosa"] };
  await runTick(deps, now);
  assert.deepEqual(sender.sent, [
    { to: "5215551", text: "Buenos días. Tu 1 cosa: la luz. ¿Va?", template: false, buttons: ["Va", "Otra cosa"] },
  ]);
});

test("primer contacto: bienvenida con botones, el modelo no se presenta de nuevo, y la segunda vez ya no hay bienvenida", async () => {
  const { deps, brain, sender, store } = setup();
  brain.next = { reply: "Cuéntame qué traes en la cabeza." };
  await handleInbound(deps, textMsg("n1", "hola"));
  assert.equal(sender.sent.length, 2);
  assert.equal(sender.sent[0].buttons?.join("|"), WELCOME_BUTTONS.join("|"));
  assert.match(sender.sent[0].text, /soy Ancla/);
  assert.match(sender.sent[0].text, /Al seguir escribiéndome aceptas/);
  assert.match(sender.sent[0].text, /\/olvidar todo/);
  assert.equal(sender.sent[1].text, "Cuéntame qué traes en la cabeza.");
  assert.ok(brain.calls[0].input.type === "message" && brain.calls[0].input.firstContact === true);
  const user = (await store.getUserByPhone("521555"))!;
  assert.equal((await store.recentMessages(user.id, 10))[0].role, "assistant", "la bienvenida queda en el historial");

  // El modelo recibe la nota de que ya hubo bienvenida
  assert.match(JSON.stringify(buildMessages(brain.calls[0])), /PRIMER mensaje/);

  await handleInbound(deps, textMsg("n2", "tengo que pagar la luz"));
  assert.equal(sender.sent.length, 3, "solo la respuesta, sin otra bienvenida");
  assert.ok(brain.calls[1].input.type === "message" && !("firstContact" in brain.calls[1].input));
});

test("/ayuda y /privacidad responden al instante sin llamar al modelo; 'ayuda' a secas no es un comando", async () => {
  assert.equal(matchCommand("/ayuda"), "help");
  assert.equal(matchCommand("¿Qué puedes hacer?"), "help");
  assert.equal(matchCommand("/Privacidad"), "privacy");
  assert.equal(matchCommand("/olvidar todo"), "forget-all");
  assert.equal(matchCommand("ayuda"), null, "alguien en apuro merece una respuesta humana, no un manual");
  assert.equal(matchCommand("necesito ayuda con mi tarea"), null);

  const { deps, brain, sender, store } = setup();
  await handleInbound(deps, textMsg("c1", "/ayuda")); // primer mensaje y es comando: sin bienvenida
  assert.equal(sender.sent.length, 1);
  assert.match(sender.sent[0].text, /Vaciar la cabeza/);
  assert.match(sender.sent[0].text, /\/privacidad/);
  assert.ok(await store.getUserByPhone("521555"), "igual se crea la persona");
  await handleInbound(deps, textMsg("c2", "¿Qué puedes hacer?"));
  await handleInbound(deps, textMsg("c3", "/privacidad"));
  assert.match(sender.sent[2].text, /No los vendo/);
  assert.equal(brain.calls.length, 0, "los comandos no gastan IA");

  await handleInbound(deps, textMsg("c4", "ayuda"));
  assert.equal(brain.calls.length, 1, "'ayuda' va al modelo");
});

test("los textos de bienvenida y ayuda caben en un mensaje con botones y dicen la verdad sobre los audios", () => {
  assert.ok(welcomeText("https://ejemplo.onrender.com").length < 1024);
  assert.ok(welcomeText("").length < 1024);
  assert.match(welcomeText("https://ejemplo.onrender.com"), /https:\/\/ejemplo\.onrender\.com\/privacy/);
  assert.match(welcomeText(""), /escribe \/privacidad/);
  assert.match(privacyText("https://ejemplo.onrender.com"), /ejemplo\.onrender\.com\/privacy/);
  assert.doesNotMatch(privacyText(""), /http/);
  assert.match(helpText(true), /mándame audios/);
  assert.doesNotMatch(helpText(false), /audios/);
});

test("el contexto le dice al modelo si los audios están disponibles", () => {
  const ctx = buildContext({
    user: baseUser(), items: [], history: [], reminders: [], observations: [], doneToday: 0,
    now: new Date("2026-11-23T14:40:00Z"), input: { type: "message", text: "hola" },
  });
  assert.match(ctx, /Audios: NO disponibles todavía/);
  assert.match(SYSTEM_PROMPT, /PRIMER mensaje/);
  assert.match(SYSTEM_PROMPT, /UN dato útil por día/);
});

test("el modo se elige sin llamar a la IA: acuses y botones simples → rápido; planes y desahogos largos → profundo", () => {
  const msg = (text: string, image?: boolean) =>
    chooseMode({ type: "message", text, ...(image ? { image: { mediaType: "image/png", base64: "x" } } : {}) });
  for (const t of ["gracias", "¡Gracias!", "ok", "Jajaja 😂", "Ya empecé", "10 min más", "Más tarde", "Hoy no", "Ya lo hice", "hola"]) {
    assert.equal(msg(t), "fast", t);
  }
  for (const t of ["Me atasqué", "Me abruma", "tengo que pagar la luz", "no sé por dónde empezar", "gracias por todo lo de hoy, de verdad"]) {
    assert.equal(msg(t), "normal", t);
  }
  for (const t of ["Piénsalo bien", "piensalo bien!", "Ayúdame a planear mi semana", "Planea mi viernes", "hazme un plan para el informe"]) {
    assert.equal(msg(t), "deep", t);
  }
  assert.equal(msg("x".repeat(DEEP_MIN_CHARS - 1)), "normal");
  assert.equal(msg("x".repeat(DEEP_MIN_CHARS)), "deep");
  assert.equal(msg("gracias", true), "normal", "con foto siempre normal");
  // Los mensajes que Ancla manda por su cuenta nunca van en modo rápido ni profundo
  assert.equal(chooseMode({ type: "event", name: "morning" }), "normal");
  assert.equal(chooseMode({ type: "event", name: "checkin" }), "normal");
  assert.equal(normalizeForMode("  ¡Ya   empecé! 💪 "), "ya empece");
});

test("modo profundo: avisa que va a pensar y le pasa el modo al modelo; rápido responde sin aviso", async () => {
  const { deps, brain, sender } = setup();
  await getOrCreateUser(deps.store, "521555");
  brain.next = { reply: "Plan: 1) ..." };
  await handleInbound(deps, textMsg("d1", "Piénsalo bien"));
  assert.equal(sender.sent.length, 2);
  assert.match(sender.sent[0].text, /Dame un momentito/);
  assert.equal(sender.sent[1].text, "Plan: 1) ...");
  assert.equal(brain.calls[0].mode, "deep");

  await handleInbound(deps, textMsg("d2", "gracias"));
  assert.equal(sender.sent.length, 3, "rápido: solo la respuesta, sin aviso");
  assert.equal(brain.calls[1].mode, "fast");

  await handleInbound(deps, textMsg("d3", "tengo que llamar al dentista"));
  assert.equal(brain.calls[2].mode, "normal");
});

test("el contexto le dice al modelo en qué modo responde, y el prompt sabe ofrecer 'Piénsalo bien'", () => {
  const base = {
    user: baseUser(), items: [], history: [], reminders: [], observations: [], doneToday: 0,
    now: new Date("2026-11-23T14:40:00Z"), input: { type: "message", text: "hola" } as const,
  };
  assert.match(buildContext({ ...base, mode: "deep" }), /Modo de esta respuesta: profundo/);
  assert.match(buildContext({ ...base, mode: "fast" }), /Modo de esta respuesta: rápido/);
  assert.match(buildContext(base), /Modo de esta respuesta: normal/);
  assert.match(SYSTEM_PROMPT, /"Piénsalo bien"/);
  assert.match(SYSTEM_PROMPT, /máximo 5 pasos/);
});

test("speechText deja el texto listo para leerse en voz alta, y la voz usa el acento del país", () => {
  assert.equal(speechText("Hola 🙂 empezamos:\n\n• Abre la app\n- Mira https://ancla.onrender.com/privacy ahora"), "Hola empezamos:\nAbre la app\nMira ahora");
  assert.match(voiceInstructions({ phone: "584125551" }), /como una amiga cercana.*acento de Venezuela/s);
  assert.match(voiceInstructions({ phone: "18095551234" }), /acento de República Dominicana/);
  assert.match(voiceInstructions({ phone: "12125551234" }), /acento latinoamericano neutro/);
});

test("si te hablan por voz, Ancla responde con nota de voz y los botones van en un mensaje aparte", async () => {
  const { deps, brain, sender, store } = setup();
  await getOrCreateUser(store, "584125551");
  const spoken: { text: string; instructions: string }[] = [];
  deps.synthesizeSpeech = async (text, instructions) => {
    spoken.push({ text, instructions });
    return Buffer.from("ogg");
  };
  deps.fetchMedia = async () => ({ data: Buffer.from("x"), mimeType: "audio/ogg" });
  deps.transcribeAudio = async () => "tengo mil cosas";
  brain.next = { reply: "Listo, lo ordeno 🙂 ¿Empezamos por la luz?", quick_replies: ["Va", "Otra cosa"] };

  await handleInbound(deps, { id: "v1", from: "584125551", profileName: "", type: "audio", mediaId: "m" });

  assert.deepEqual(sender.sent, [
    { to: "584125551", text: "(nota de voz)", template: false, voice: true },
    { to: "584125551", text: "Toca una opción si te sirve:", template: false, buttons: ["Va", "Otra cosa"] },
  ]);
  assert.equal(spoken[0].text, "Listo, lo ordeno ¿Empezamos por la luz?");
  assert.match(spoken[0].instructions, /acento de Venezuela/);
  const input = brain.calls[0].input;
  assert.ok(input.type === "message" && input.voiceReply === true, "el modelo sabe que se dirá en voz");
  assert.match(JSON.stringify(buildMessages(brain.calls[0])), /NOTA DE VOZ/);
});

test("la voz solo se usa cuando corresponde: texto → texto; respuesta larga, plan profundo o fallo → texto", async () => {
  const { deps, brain, sender, store } = setup();
  await getOrCreateUser(store, "584125551");
  const logs: string[] = [];
  deps.log = (m) => logs.push(m);
  let spokenCount = 0;
  let behavior: "ok" | "throw" | "null" = "ok";
  deps.synthesizeSpeech = async () => {
    spokenCount++;
    if (behavior === "throw") throw new Error("Voz 500");
    return behavior === "null" ? null : Buffer.from("ogg");
  };
  deps.fetchMedia = async () => ({ data: Buffer.from("x"), mimeType: "audio/ogg" });
  let transcript = "hola";
  deps.transcribeAudio = async () => transcript;
  const audio = (id: string) => ({ id, from: "584125551", profileName: "", type: "audio", mediaId: "m" }) as const;

  // 1) escribe → texto, sin llamar a la voz
  brain.next = { reply: "Hola" };
  await handleInbound(deps, { id: "t1", from: "584125551", profileName: "", type: "text", text: "hola" });
  assert.equal(spokenCount, 0);
  assert.deepEqual(sender.sent.at(-1), { to: "584125551", text: "Hola", template: false });

  // 2) habla pero la respuesta es larga → texto
  brain.next = { reply: "a".repeat(MAX_VOICE_CHARS + 1) };
  await handleInbound(deps, audio("t2"));
  assert.equal(spokenCount, 0);
  assert.equal(sender.sent.at(-1)!.text.length, MAX_VOICE_CHARS + 1);

  // 3) la voz falla → llega el texto y queda un aviso en el registro (sin contenido)
  brain.next = { reply: "Sigo aquí" };
  behavior = "throw";
  await handleInbound(deps, audio("t3"));
  assert.deepEqual(sender.sent.at(-1), { to: "584125551", text: "Sigo aquí", template: false });
  assert.ok(logs.some((l) => l.includes("voz falló, se envía texto: Voz 500")));
  assert.ok(logs.every((l) => !l.includes("Sigo aquí")));

  // 4) no hay servicio configurado (devuelve null) → texto
  behavior = "null";
  await handleInbound(deps, audio("t4"));
  assert.deepEqual(sender.sent.at(-1), { to: "584125551", text: "Sigo aquí", template: false });

  // 5) un desahogo larguísimo hablado entra en modo profundo: aviso + plan en texto, no en voz
  behavior = "ok";
  const before = spokenCount;
  transcript = "x".repeat(950);
  brain.next = { reply: "Plan: 1) ..." };
  await handleInbound(deps, audio("t5"));
  assert.equal(spokenCount, before);
  assert.match(sender.sent.at(-2)!.text, /Dame un momentito/);
  assert.equal(sender.sent.at(-1)!.text, "Plan: 1) ...");
  assert.equal(brain.calls.at(-1)!.mode, "deep");
});
