import { test } from "node:test";
import assert from "node:assert/strict";
import { handleInbound, type AppDeps } from "../src/app.ts";
import { buildContext, normalizeOutput, type Brain, type BrainContext } from "../src/brain.ts";
import { estimateFactor, realisticMinutes, timingContext, timingSamples } from "../src/estimates.ts";
import { getOrCreateUser } from "../src/handler.ts";
import { MemoryStore } from "../src/store/memory.ts";
import type { BrainOutput, Item, User } from "../src/types.ts";
import { ConsoleSender } from "../src/whatsapp.ts";

const item = (title: string, estimate: number | null, start: string | null, done: string | null, status: Item["status"] = "done"): Item => ({
  id: title, userId: "u", kind: "task", title, firstStep: "", due: null, estimateMinutes: estimate,
  status, createdAt: "2026-11-01T00:00:00Z", startedAt: start, doneAt: done,
});

test("mide lo que calculó contra lo que le tomó, sin datos absurdos", () => {
  const s = timingSamples([
    item("Pagar luz", 10, "2026-11-20T10:00:00Z", "2026-11-20T10:35:00Z"),
    item("Correo", 5, "2026-11-20T11:00:00Z", "2026-11-20T11:00:00Z"), // marcado a la vez: no se midió
    item("Informe", 60, "2026-11-20T09:00:00Z", "2026-11-21T09:00:00Z"), // se le olvidó avisar
    item("Lavar", null, "2026-11-20T09:00:00Z", "2026-11-20T09:30:00Z"), // sin cálculo suyo
  ]);
  assert.deepEqual(s.map((x) => [x.title, x.estimate, x.actual]), [["Pagar luz", 10, 35]]);
});

test("factor: mediana a partir de 3 tareas; tiempo realista redondeado", () => {
  const two = timingSamples([
    item("a", 10, "2026-11-20T10:00:00Z", "2026-11-20T10:30:00Z"),
    item("b", 10, "2026-11-20T11:00:00Z", "2026-11-20T11:20:00Z"),
  ]);
  assert.equal(estimateFactor(two), null, "con 2 todavía no");
  const three = timingSamples([
    ...[item("a", 10, "2026-11-20T10:00:00Z", "2026-11-20T10:30:00Z"), item("b", 10, "2026-11-20T11:00:00Z", "2026-11-20T11:20:00Z")],
    item("c", 20, "2026-11-20T12:00:00Z", "2026-11-20T14:00:00Z"),
  ]);
  assert.equal(estimateFactor(three), 3); // 3, 2 y 6 → mediana 3
  assert.equal(realisticMinutes(10, 3), 30);
  assert.equal(realisticMinutes(10, 1), null, "si calcula bien, no se corrige");
  assert.match(timingContext([...three.map((x) => item(x.title, x.estimate, "2026-11-20T10:00:00Z", new Date(Date.parse("2026-11-20T10:00:00Z") + x.actual * 60_000).toISOString()))]).join("\n"), /3 veces lo que calcula \(3 tareas/);
});

const user: User = {
  id: "u", phone: "521555", name: "", timezone: "America/Mexico_City", morningTime: "08:30", eveningTime: "21:00",
  proactive: true, energy: "unknown", focusItemId: null, notes: [], voice: "", routines: [], profile: "", people: [],
  lastInboundAt: null, lastMorningDate: null, lastEveningDate: null, checkinAt: null, createdAt: "",
};

test("el contexto muestra cuánto lleva en lo empezado y el tiempo realista de cada pendiente", () => {
  const timed = ["a", "b", "c"].map((t) => item(t, 10, "2026-11-20T10:00:00Z", "2026-11-20T10:25:00Z"));
  const text = buildContext({
    user, now: new Date("2026-11-23T15:00:00Z"), history: [], reminders: [], observations: [], doneToday: 0,
    input: { type: "message", text: "hola" }, timed,
    items: [item("Informe", 20, "2026-11-23T14:20:00Z", null, "started"), item("Llamar", 10, null, null, "open")],
  });
  assert.match(text, /le tomó 25 min/);
  assert.match(text, /2\.5 veces lo que calcula/);
  assert.match(text, /t1 \[task\] Informe \(EMPEZADA hace 40 min; ella calcula ~20 min, por cómo le va, cuenta ~50\)/);
  assert.match(text, /t2 \[task\] Llamar \(ella calcula ~10 min, por cómo le va, cuenta ~25\)/);
});

test("sin tareas medidas, no se agrega nada al contexto", () => {
  assert.deepEqual(timingContext([item("x", null, null, "2026-11-20T10:00:00Z")]), []);
});

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

test("de punta a punta: dice cuánto le toma, empieza, termina, y la próxima vez Ancla lo sabe", async () => {
  let now = new Date("2026-11-23T15:00:00Z");
  const store = new MemoryStore();
  const brain = new ScriptBrain();
  const deps: AppDeps = { store, brain, sender: new ConsoleSender(), now: () => now };
  const u = await getOrCreateUser(store, "521555");
  await store.addItems([{ userId: u.id, kind: "task", title: "Pagar luz", firstStep: "", due: null, estimateMinutes: null }]);

  brain.script = [{ estimate_updates: [{ ref: "t1", minutes: 10 }], started_item_refs: ["t1"] }];
  await handleInbound(deps, { id: "e1", from: "521555", profileName: "", type: "text", text: "voy con la luz, me toma 10 min" });
  now = new Date("2026-11-23T15:35:00Z");
  brain.script = [{ completed_item_refs: ["t1"] }];
  await handleInbound(deps, { id: "e2", from: "521555", profileName: "", type: "text", text: "listo la luz" });
  assert.match(buildContext(brain.calls[1]), /t1 \[task\] Pagar luz \(EMPEZADA hace 35 min; ella calcula ~10 min\)/);

  await handleInbound(deps, { id: "e3", from: "521555", profileName: "", type: "text", text: "hola" });
  assert.match(buildContext(brain.calls[2]), /"Pagar luz": calculó 10 min, le tomó 35 min/);
});

test("normalizeOutput limpia estimate_updates raros", () => {
  const o = normalizeOutput({ reply: "x", estimate_updates: [{ ref: "t1", minutes: 15 }, { ref: "t2", minutes: -3 }, { minutes: 5 }, "basura"] });
  assert.deepEqual(o.estimate_updates, [{ ref: "t1", minutes: 15 }]);
});
