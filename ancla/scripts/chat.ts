// Simulador en la terminal: habla con Ancla como si fuera WhatsApp, sin configurar Meta.
// Uso: ANTHROPIC_API_KEY=... npm run chat
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { handleInbound, type AppDeps } from "../src/app.ts";
import { ClaudeBrain } from "../src/brain.ts";
import { getOrCreateUser, runTurn } from "../src/handler.ts";
import { MemoryStore } from "../src/store/memory.ts";
import { ConsoleSender } from "../src/whatsapp.ts";

const PHONE = "5210000000000";
const store = new MemoryStore();
const sender = new ConsoleSender();
const deps: AppDeps = { store, brain: new ClaudeBrain(), sender, log: console.error };

const flush = () => {
  for (const m of sender.sent.splice(0)) console.log(`\n\x1b[36mAncla:\x1b[0m ${m.text}\n`);
};

console.log(`Simulador de Ancla. Escribe como en WhatsApp.
Comandos: /manana  /noche  /checkin  /pendientes  /perfil  /salir\n`);

const rl = createInterface({ input: stdin, output: stdout });
let n = 0;
while (true) {
  const line = (await rl.question("\x1b[33mTú:\x1b[0m ")).trim();
  if (!line) continue;
  if (line === "/salir") break;
  try {
    const user = await getOrCreateUser(store, PHONE, "");
    if (line === "/pendientes") {
      const items = await store.listActiveItems(user.id);
      console.log(items.map((i, k) => `t${k + 1} [${i.kind}/${i.status}] ${i.title} → ${i.firstStep}`).join("\n") || "(nada)");
      continue;
    }
    if (line === "/perfil") {
      console.log(JSON.stringify(user, null, 2));
      continue;
    }
    const events: Record<string, "morning" | "evening" | "checkin"> = {
      "/manana": "morning",
      "/noche": "evening",
      "/checkin": "checkin",
    };
    if (events[line]) {
      await sender.sendText(PHONE, await runTurn(deps, user, { type: "event", name: events[line] }));
    } else {
      await handleInbound(deps, { id: `sim-${n++}`, from: PHONE, profileName: "", type: "text", text: line });
    }
    flush();
  } catch (err) {
    console.error("Error:", (err as Error).message);
  }
}
rl.close();
