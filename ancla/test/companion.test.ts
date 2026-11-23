import { test } from "node:test";
import assert from "node:assert/strict";
import { handleInbound, runTick, type AppDeps } from "../src/app.ts";
import { buildContext, buildMessages, normalizeOutput, type Brain, type BrainContext } from "../src/brain.ts";
import { getOrCreateUser } from "../src/handler.ts";
import { dueEvent } from "../src/scheduler.ts";
import { MemoryStore } from "../src/store/memory.ts";
import type { BrainOutput } from "../src/types.ts";
import { ConsoleSender } from "../src/whatsapp.ts";

class ScriptBrain implements Brain {
  calls: BrainContext[] = [];
  script: Partial<BrainOutput>[] = [];
  async consolidate() {
    return { routines: [], profile: "", voice: "" };
  }
  async think(ctx: BrainContext) {
    this.calls.push(ctx);
    return normalizeOutput({ reply: "ok", ...(this.script.shift() ?? {}) });
  }
}

const start = (p: Partial<BrainOutput["companion"]>): Partial<BrainOutput> => ({
  companion: { action: "start", minutes: 0, every_minutes: 0, task_ref: "", title: "", ...p },
});

async function setup() {
  let now = new Date("2026-11-23T15:00:00Z"); // 9:00 en Ciudad de México
  const store = new MemoryStore();
  const brain = new ScriptBrain();
  const sender = new ConsoleSender();
  const deps: AppDeps = { store, brain, sender, now: () => now };
  const user = await getOrCreateUser(store, "521555");
  await store.updateUser(user.id, { lastMorningDate: "2026-11-23", lastEveningDate: "2026-11-23" });
  await store.addItems([{ userId: user.id, kind: "task", title: "Informe", firstStep: "", due: null, estimateMinutes: null }]);
  const at = (min: number) => (now = new Date(Date.parse("2026-11-23T15:00:00Z") + min * 60_000));
  const fresh = async () => (await store.getUserByPhone("521555"))!;
  return { store, brain, sender, deps, at, fresh };
}

const msg = (id: string, text: string) => ({ id, from: "521555", profileName: "", type: "text", text }) as const;

test("acompáñame: abre la sesión, empieza la tarea, hace check-ins solos y cierra al final", async () => {
  const { store, brain, sender, deps, at, fresh } = await setup();
  brain.script = [start({ minutes: 30, every_minutes: 10, task_ref: "t1" })];
  await handleInbound(deps, msg("c1", "acompáñame 30 min con el informe"));

  let u = await fresh();
  assert.equal(u.companion!.title, "Informe");
  assert.equal(u.companion!.endsAt, "2026-11-23T15:30:00.000Z");
  assert.equal(u.checkinAt, "2026-11-23T15:10:00.000Z");
  const [item] = await store.listActiveItems(u.id);
  assert.equal(item.status, "started", "la sesión empieza la tarea (para medir el tiempo)");

  at(10);
  await runTick(deps);
  const tick1 = brain.calls.at(-1)!.input;
  assert.equal(tick1.type === "event" && tick1.name, "checkin");
  assert.match(buildContext(brain.calls.at(-1)!), /SESIÓN "ACOMPÁÑAME" EN CURSO: "Informe" \(t1\).*lleva 10 min, quedan 20/);
  u = await fresh();
  assert.equal(u.checkinAt, "2026-11-23T15:20:00.000Z", "el siguiente check-in se programa solo");

  at(20);
  await runTick(deps);
  u = await fresh();
  assert.equal(u.checkinAt, null, "no hay check-in pegado al cierre");

  at(30);
  await runTick(deps);
  const last = brain.calls.at(-1)!;
  assert.equal(last.input.type === "event" && last.input.name, "companion_end");
  const text = JSON.stringify(buildMessages(last));
  assert.match(text, /terminó la sesión \\"acompáñame\\" de \\"Informe\\" \(empezó a las 09:00, 30 min\)/);
  assert.equal((await fresh()).companion, null);
  assert.equal(sender.sent.length, 4);

  at(40);
  assert.equal(await runTick(deps), 0, "después del cierre no le escribe más");
});

test("si termina la tarea o pide parar, la sesión se cierra sin más check-ins", async () => {
  const { brain, deps, at, fresh } = await setup();
  brain.script = [start({ task_ref: "t1" }), { completed_item_refs: ["t1"] }];
  await handleInbound(deps, msg("c2", "acompáñame con el informe"));
  assert.equal((await fresh()).companion!.endsAt, "2026-11-23T15:45:00.000Z", "45 min por defecto");
  at(12);
  await handleInbound(deps, msg("c3", "ya terminé!"));
  const u = await fresh();
  assert.equal(u.companion, null);
  assert.equal(u.checkinAt, null);

  brain.script = [start({ title: "Limpiar" }), { companion: { action: "stop", minutes: 0, every_minutes: 0, task_ref: "", title: "" } }];
  await handleInbound(deps, msg("c4", "acompáñame a limpiar"));
  assert.equal((await fresh()).companion!.title, "Limpiar");
  await handleInbound(deps, msg("c5", "mejor paro"));
  assert.equal((await fresh()).companion, null);
});

test("los check-ins de la sesión salen aunque haya apagado los mensajes por iniciativa propia", async () => {
  const { store, deps, brain, fresh } = await setup();
  brain.script = [start({ minutes: 20, every_minutes: 10 })];
  await handleInbound(deps, msg("c6", "acompáñame 20 min"));
  await store.updateUser((await fresh()).id, { proactive: false });
  const u = await fresh();
  assert.equal(dueEvent(u, new Date("2026-11-23T15:10:00Z")), "checkin");
  assert.equal(dueEvent(u, new Date("2026-11-23T15:20:00Z")), "companion_end");
});

test("normalizeOutput: companion raro queda en 'none' y con límites", () => {
  assert.equal(normalizeOutput({ reply: "x" }).companion.action, "none");
  const c = normalizeOutput({ reply: "x", companion: { action: "start", minutes: 9999, every_minutes: -3, task_ref: " t2 ", title: 5 } }).companion;
  assert.deepEqual(c, { action: "start", minutes: 240, every_minutes: 0, task_ref: "t2", title: "" });
});
