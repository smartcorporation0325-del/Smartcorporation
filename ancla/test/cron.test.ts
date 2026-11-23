import { test } from "node:test";
import assert from "node:assert/strict";

// Archivo propio (proceso propio): se fija el secreto antes de importar la configuración.
process.env.CRON_SECRET = "secreto-del-reloj";
const { createApp } = await import("../src/server.ts");
const { MemoryStore } = await import("../src/store/memory.ts");
const { ConsoleSender } = await import("../src/whatsapp.ts");

class SlowStore extends MemoryStore {
  release!: () => void;
  gate = new Promise<void>((r) => (this.release = r));
  async listUsers() {
    await this.gate; // simula una revisión lenta
    return super.listUsers();
  }
}

test("/cron/tick responde al instante y sigue trabajando en segundo plano", async () => {
  const store = new SlowStore();
  const logs: string[] = [];
  const brain = { think: async () => { throw new Error("no debería llamarse"); }, consolidate: async () => ({ routines: [], profile: "", voice: "" }) };
  const server = createApp({ store, brain, sender: new ConsoleSender(), log: (m: string) => logs.push(m) }).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const tick = (auth?: string) =>
    fetch(`${base}/cron/tick`, { method: "POST", headers: auth ? { Authorization: auth } : {} });
  try {
    assert.equal((await tick()).status, 401);
    assert.equal((await tick("Bearer otra")).status, 401);

    // La revisión está "colgada" (listUsers espera), pero el reloj recibe respuesta ya.
    const first = await tick("Bearer secreto-del-reloj");
    assert.equal(first.status, 202);
    assert.deepEqual(await first.json(), { accepted: true });

    // Mientras sigue corriendo, otra llamada no arranca una segunda revisión
    const second = await tick("Bearer secreto-del-reloj");
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), { busy: true });

    // Cuando termina, se puede volver a llamar
    store.release();
    await new Promise((r) => setTimeout(r, 50));
    const third = await tick("Bearer secreto-del-reloj");
    assert.equal(third.status, 202);
  } finally {
    server.close();
  }
});
