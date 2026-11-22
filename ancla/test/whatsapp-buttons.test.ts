import { test } from "node:test";
import assert from "node:assert/strict";

// Archivo propio (proceso propio): se fijan las variables antes de importar la configuración.
process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
process.env.WHATSAPP_TOKEN = "tok-test";
process.env.GRAPH_API_VERSION = "v25.0";
const { WhatsAppSender } = await import("../src/whatsapp.ts");

type Call = { url: string; auth: string | null; body: any };
const calls: Call[] = [];
const statuses: number[] = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({
    url: String(url),
    auth: new Headers(init.headers).get("authorization"),
    body: JSON.parse(String(init.body)),
  });
  return new Response("{}", { status: statuses.shift() ?? 200 });
}) as typeof fetch;

const reset = () => {
  calls.length = 0;
  statuses.length = 0;
};

test("sendButtons manda un mensaje interactivo con botones de respuesta", async () => {
  reset();
  await new WhatsAppSender().sendButtons("584127176924", "¿Empezaste?", ["Ya empecé", "10 min más", "Me atasqué"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://graph.facebook.com/v25.0/123456/messages");
  assert.equal(calls[0].auth, "Bearer tok-test");
  assert.deepEqual(calls[0].body, {
    messaging_product: "whatsapp",
    to: "584127176924",
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "¿Empezaste?" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "qr1", title: "Ya empecé" } },
          { type: "reply", reply: { id: "qr2", title: "10 min más" } },
          { type: "reply", reply: { id: "qr3", title: "Me atasqué" } },
        ],
      },
    },
  });
});

test("recorta a 3 botones de 20 caracteres y quita repetidos", async () => {
  reset();
  await new WhatsAppSender().sendButtons("1", "Hola", ["Una", "una", "Un título larguísimo que no cabe", "Dos", "Tres"]);
  const titles = calls[0].body.interactive.action.buttons.map((b: any) => b.reply.title);
  assert.deepEqual(titles, ["Una", "Un título larguísimo q", "Dos"].map((t) => [...t].slice(0, 20).join("").trim()));
});

test("sin botones, o con un cuerpo de más de 1024 caracteres, va como texto normal", async () => {
  reset();
  const sender = new WhatsAppSender();
  await sender.sendButtons("1", "Solo texto", []);
  await sender.sendButtons("1", "x".repeat(1025), ["Va"]);
  assert.deepEqual(calls.map((c) => c.body.type), ["text", "text"]);
});

test("si Meta rechaza los botones, el mensaje no se pierde: se reenvía como texto", async () => {
  reset();
  statuses.push(400); // falla el interactivo; el reintento como texto sale con 200
  await new WhatsAppSender().sendButtons("1", "¿Va?", ["Va", "Otra cosa"]);
  assert.deepEqual(calls.map((c) => c.body.type), ["interactive", "text"]);
  assert.equal(calls[1].body.text.body, "¿Va?");
});
