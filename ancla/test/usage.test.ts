import { test } from "node:test";
import assert from "node:assert/strict";
import { handleInbound, type AppDeps } from "../src/app.ts";
import { normalizeOutput, type Brain, type BrainContext, type ConsolidationContext } from "../src/brain.ts";
import { consolidate, getOrCreateUser } from "../src/handler.ts";
import { costUsd, voiceCostUsd } from "../src/pricing.ts";
import { MemoryStore } from "../src/store/memory.ts";
import { ConsoleSender } from "../src/whatsapp.ts";

test("costo por llamada con los precios de cada modelo", () => {
  // Opus 5.5: 1.000 entrada ($4/M) + 400 salida ($20/M) + 4.000 caché leída ($0,20/M) = 0,004 + 0,008 + 0,0008
  assert.equal(costUsd({ model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 400, cacheReadTokens: 4000, cacheWriteTokens: 0 }), 0.0128);
  assert.equal(costUsd({ model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 400, cacheReadTokens: 4000, cacheWriteTokens: 0 }), 0.0064);
  assert.equal(costUsd({ model: "claude-haiku-5-5", inputTokens: 1000, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 }), 0.0003);
  // Escribir caché cuesta 1,25 × la entrada
  assert.equal(costUsd({ model: "claude-opus-5-5", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 1_000_000 }), 5);
  // Un modelo desconocido se cuenta caro
  assert.ok(costUsd({ model: "otro", inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }) >= 0.01);
  assert.equal(voiceCostUsd(900), 0.015);
});

class MeteredBrain implements Brain {
  async think(ctx: BrainContext) {
    ctx.onUsage?.({ model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 400, cacheReadTokens: 4000, cacheWriteTokens: 0 });
    return normalizeOutput({ reply: "ok" });
  }
  async consolidate(ctx: ConsolidationContext) {
    ctx.onUsage?.({ model: "claude-opus-5-5", inputTokens: 2000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 });
    return { routines: [], profile: "", voice: "" };
  }
}

test("cada turno y la memoria nocturna dejan su costo, sin contenido", async () => {
  const store = new MemoryStore();
  const now = new Date("2026-11-25T15:00:00Z");
  const deps: AppDeps = { store, brain: new MeteredBrain(), sender: new ConsoleSender(), now: () => now };
  const user = await getOrCreateUser(store, "521555");
  await handleInbound(deps, { id: "u1", from: "521555", profileName: "", type: "text", text: "algo privado" });
  for (let i = 0; i < 3; i++) await store.addObservation({ userId: user.id, at: now.toISOString(), activity: "x", state: "focused", note: "" });
  await consolidate(deps, user, now);
  await new Promise((r) => setImmediate(r));

  assert.deepEqual(store.usage.map((u) => [u.kind, u.costUsd]), [["message", 0.0128], ["memory", 0.018]]);
  assert.ok(!JSON.stringify(store.usage).includes("privado"));
});

test("si guardar el costo falla, la persona igual recibe su respuesta", async () => {
  const store = new MemoryStore();
  store.addUsage = async () => {
    throw new Error("base caída");
  };
  const sender = new ConsoleSender();
  const deps: AppDeps = { store, brain: new MeteredBrain(), sender };
  await getOrCreateUser(store, "521555");
  await handleInbound(deps, { id: "u2", from: "521555", profileName: "", type: "text", text: "hola" });
  assert.equal(sender.sent.at(-1)!.text, "ok");
});
