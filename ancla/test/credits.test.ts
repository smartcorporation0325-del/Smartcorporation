import { test } from "node:test";
import assert from "node:assert/strict";
import { handleInbound, recoverInbound, runTick, type AppDeps } from "../src/app.ts";
import { normalizeOutput, OutOfCreditsError, type Brain, type BrainContext } from "../src/brain.ts";
import { getOrCreateUser } from "../src/handler.ts";
import { MemoryStore } from "../src/store/memory.ts";
import { ConsoleSender, type InboundMessage } from "../src/whatsapp.ts";

// Sin saldo en Anthropic: avisar una vez, guardar los mensajes y contestarlos cuando vuelva el saldo.

class BrokeBrain implements Brain {
  broke = true;
  calls = 0;
  async consolidate() {
    return { routines: [], profile: "", voice: "" };
  }
  async think(_ctx: BrainContext) {
    this.calls++;
    if (this.broke) throw new OutOfCreditsError();
    return normalizeOutput({ reply: "¡Volví! Aquí va tu respuesta." });
  }
}

const msg = (id: string, text: string): InboundMessage => ({ id, from: "521777", profileName: "", type: "text", text });

test("sin saldo: avisa una sola vez, no gasta intentos y responde cuando vuelve el saldo", async () => {
  let now = new Date("2026-11-26T15:00:00Z");
  const store = new MemoryStore();
  store.clock = () => now;
  const brain = new BrokeBrain();
  const sender = new ConsoleSender();
  const deps: AppDeps = { store, brain, sender, now: () => now };
  await getOrCreateUser(store, "521777");

  await handleInbound(deps, msg("k1", "recuérdame llamar a mi mamá"));
  await handleInbound(deps, msg("k2", "y otra cosa"));
  assert.equal(sender.sent.length, 1, "un solo aviso aunque escriba dos veces");
  assert.match(sender.sent[0].text, /pausa técnica/);
  assert.equal(store.pendingInbound.size, 2, "los dos mensajes quedan guardados");

  // Varias revisiones del reloj sin saldo: nunca se rinde ni le pide repetir
  for (let i = 1; i <= 6; i++) {
    now = new Date(Date.parse("2026-11-26T15:00:00Z") + i * 10 * 60_000);
    await recoverInbound(deps);
  }
  assert.equal(sender.sent.length, 1);
  assert.equal(store.pendingInbound.size, 2);
  assert.ok([...store.pendingInbound.values()].every((p) => p.attempts <= 1), "los intentos no se gastan");

  // Vuelve el saldo
  brain.broke = false;
  now = new Date("2026-11-26T16:20:00Z");
  await recoverInbound(deps);
  assert.equal(store.pendingInbound.size, 0);
  assert.deepEqual(sender.sent.slice(1).map((s) => s.text), ["¡Volví! Aquí va tu respuesta.", "¡Volví! Aquí va tu respuesta."]);
});

test("sin saldo, el buenos días no se da por enviado: sale cuando vuelve el saldo", async () => {
  let now = new Date("2026-11-26T14:40:00Z"); // 08:40 en Ciudad de México
  const store = new MemoryStore();
  const brain = new BrokeBrain();
  const sender = new ConsoleSender();
  const deps: AppDeps = { store, brain, sender, now: () => now };
  const user = await getOrCreateUser(store, "521777");
  await store.updateUser(user.id, { lastInboundAt: "2026-11-26T03:00:00Z" });

  await runTick(deps);
  assert.equal((await store.getUserByPhone("521777"))!.lastMorningDate, null, "la marca se deshizo");
  assert.equal(sender.sent.length, 0);

  brain.broke = false;
  now = new Date("2026-11-26T14:50:00Z");
  await runTick(deps);
  assert.equal(sender.sent.length, 1);
  assert.equal((await store.getUserByPhone("521777"))!.lastMorningDate, "2026-11-26");
});
