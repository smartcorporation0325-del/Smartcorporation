import { test } from "node:test";
import assert from "node:assert/strict";
import { handleInbound, MAX_INBOUND_ATTEMPTS, recoverInbound, runTick, type AppDeps } from "../src/app.ts";
import { normalizeOutput, type Brain, type BrainContext } from "../src/brain.ts";
import { getOrCreateUser } from "../src/handler.ts";
import { MemoryStore } from "../src/store/memory.ts";
import type { BrainOutput } from "../src/types.ts";
import { ConsoleSender, type InboundMessage } from "../src/whatsapp.ts";

// Mensajes que se quedan a medias (error de un servicio, servidor reiniciado) no se pierden.

class FlakyBrain implements Brain {
  calls: BrainContext[] = [];
  failures = 0; // cuántas llamadas seguidas fallan
  next: Partial<BrainOutput> = {};
  async consolidate() {
    return { routines: [], profile: "", voice: "" };
  }
  async think(ctx: BrainContext) {
    this.calls.push(ctx);
    if (this.failures > 0) {
      this.failures--;
      throw new Error("API caída");
    }
    return normalizeOutput({ reply: "Listo, te aviso.", ...this.next });
  }
}

class FlakySender extends ConsoleSender {
  failures = 0;
  async sendText(to: string, text: string) {
    if (this.failures > 0) {
      this.failures--;
      throw new Error("WhatsApp 500");
    }
    return super.sendText(to, text);
  }
}

function setup() {
  let now = new Date("2026-11-23T14:00:00Z");
  const store = new MemoryStore();
  store.clock = () => now;
  const brain = new FlakyBrain();
  const sender = new FlakySender();
  const logs: string[] = [];
  const deps: AppDeps = { store, brain, sender, now: () => now, log: (m) => logs.push(m) };
  const advance = (min: number) => (now = new Date(now.getTime() + min * 60_000));
  return { store, brain, sender, deps, logs, advance, at: () => now };
}

const msg = (id: string, text: string): InboundMessage => ({ id, from: "521555", profileName: "", type: "text", text });

async function knownUser(store: MemoryStore) {
  await getOrCreateUser(store, "521555"); // sin bienvenida, para que las cuentas sean simples
}

test("si el cerebro falla, avisa, y el reloj lo reintenta con la hora en que llegó el mensaje", async () => {
  const { store, brain, sender, deps, advance } = setup();
  await knownUser(store);
  brain.failures = 1;
  await handleInbound(deps, msg("w1", "Recuérdame en 15 minutos tomar agua"));

  assert.equal(sender.sent.length, 1);
  assert.match(sender.sent[0].text, /se me trabó/);
  assert.equal(store.pendingInbound.size, 1, "queda pendiente");

  // 2 minutos después todavía no se toca (podría estar en curso en otro servidor)
  advance(2);
  assert.equal(await recoverInbound(deps), 0);

  advance(8); // siguiente revisión del reloj
  await runTick(deps);
  assert.equal(brain.calls.length, 2);
  assert.equal(brain.calls[1].now.toISOString(), "2026-11-23T14:00:00.000Z", "'en 15 minutos' cuenta desde que lo escribió");
  assert.equal(sender.sent.at(-1)!.text, "Listo, te aviso.");
  assert.equal(store.pendingInbound.size, 0, "cerrado y sin contenido guardado");
});

test("servidor reiniciado a mitad de camino: el mensaje se retoma al volver", async () => {
  const { store, brain, sender, deps, advance } = setup();
  await knownUser(store);
  // Simula el reinicio: el mensaje se registró pero nunca se procesó.
  assert.equal(await store.claimInboundMessage(msg("w2", "hola")), true);
  advance(4);
  assert.equal(await recoverInbound(deps), 1);
  assert.equal(brain.calls.length, 1);
  assert.equal(sender.sent.length, 1);
  assert.equal(store.pendingInbound.size, 0);
  // Meta reintenta el mismo webhook: no se responde dos veces
  await handleInbound(deps, msg("w2", "hola"));
  assert.equal(brain.calls.length, 1);
});

test("si ya había respuesta y solo falló el envío, se reenvía sin volver a pensar", async () => {
  const { store, brain, sender, deps, advance } = setup();
  await knownUser(store);
  brain.next = { reminders: [{ when: "2026-11-23T08:15", text: "tomar agua", quote: "tomar agua" }] };
  sender.failures = 1; // falla el envío de la respuesta
  await handleInbound(deps, msg("w3", "Recuérdame en 15 minutos tomar agua"));
  assert.equal(sender.sent.length, 0);
  assert.ok(store.pendingInbound.get("w3")!.reply, "la respuesta quedó guardada");

  advance(5);
  await recoverInbound(deps);
  assert.equal(brain.calls.length, 1, "no se llamó otra vez a Claude");
  assert.equal(sender.sent.length, 1);
  assert.equal(sender.sent[0].text, "Listo, te aviso.");
  const user = (await store.getUserByPhone("521555"))!;
  assert.equal((await store.listPendingReminders(user.id)).length, 1, "sin recordatorios duplicados");
});

test("después de varios intentos se suelta y se le pide repetirlo, sin quedarse en bucle", async () => {
  const { store, brain, sender, deps, advance } = setup();
  await knownUser(store);
  brain.failures = 99;
  await handleInbound(deps, msg("w4", "algo"));
  for (let i = 0; i < MAX_INBOUND_ATTEMPTS + 2; i++) {
    advance(10);
    await recoverInbound(deps);
  }
  assert.equal(brain.calls.length, MAX_INBOUND_ATTEMPTS);
  assert.match(sender.sent.at(-1)!.text, /me lo mandas otra vez/);
  assert.equal(store.pendingInbound.size, 0);
});

test("un mensaje viejísimo (servidor caído horas) no se contesta como si nada", async () => {
  const { store, brain, sender, deps, advance } = setup();
  await knownUser(store);
  await store.claimInboundMessage(msg("w5", "¿me recuerdas lo de las 3?"));
  advance(13 * 60);
  await recoverInbound(deps);
  assert.equal(brain.calls.length, 0);
  assert.match(sender.sent[0].text, /me lo mandas otra vez/);
});

test("/olvidar todo también borra los mensajes pendientes guardados", async () => {
  const { store, deps } = setup();
  await knownUser(store);
  await store.claimInboundMessage(msg("w6", "algo íntimo"));
  await handleInbound(deps, msg("w7", "/olvidar todo"));
  assert.equal(store.pendingInbound.size, 0);
});
