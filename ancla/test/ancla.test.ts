import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleInbound, runTick, type AppDeps } from "../src/app.ts";
import { buildContext, buildMessages, normalizeOutput, type Brain, type BrainContext } from "../src/brain.ts";
import { getOrCreateUser, runTurn } from "../src/handler.ts";
import { countryFromPhone } from "../src/dialect.ts";
import { dueEvent, withinServiceWindow } from "../src/scheduler.ts";
import { MemoryStore } from "../src/store/memory.ts";
import { localParts } from "../src/time.ts";
import type { BrainOutput, User } from "../src/types.ts";
import { ConsoleSender, parseWebhook, verifySignature } from "../src/whatsapp.ts";

/** Cerebro falso: devuelve lo que el test le diga y recuerda el contexto que recibió. */
class FakeBrain implements Brain {
  calls: BrainContext[] = [];
  next: Partial<BrainOutput> = {};
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

  assert.deepEqual(sender.sent, [{ to: "521555", text: "Guardé 2 cosas.", template: false }]);
  const user = (await store.getUserByPhone("521555"))!;
  assert.equal(user.name, "Ana");
  const items = await store.listActiveItems(user.id);
  assert.equal(items.length, 2);
  assert.equal(items[0].due, "2026-11-25");
  assert.equal(items[1].estimateMinutes, null);
  assert.equal(user.focusItemId, items[0].id);
  assert.ok(user.lastInboundAt);
  assert.equal((await store.recentMessages(user.id, 10)).length, 2);
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
  proactive: true, energy: "unknown", focusItemId: null, notes: [], voice: "", routines: [], lastInboundAt: null, lastMorningDate: null,
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
  deps.fetchMedia = async () => ({ data: Buffer.from("x"), mimeType: "audio/ogg" });
  deps.transcribeAudio = async () => null;
  await handleInbound(deps, { id: "a1", from: "521555", profileName: "", type: "audio", mediaId: "m" });
  assert.equal(brain.calls.length, 0);
  assert.match(sender.sent[0].text, /audios/);
});

test("audio transcrito y foto llegan al cerebro", async () => {
  const { deps, brain } = setup();
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
    now: new Date("2026-11-23T14:40:00Z"), doneToday: 0,
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
