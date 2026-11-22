import { test } from "node:test";
import assert from "node:assert/strict";

process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
process.env.WHATSAPP_TOKEN = "tok-test";
process.env.GRAPH_API_VERSION = "v25.0";
const { WhatsAppSender } = await import("../src/whatsapp.ts");

type Call = { url: string; auth: string | null; form?: FormData; json?: any };
const calls: Call[] = [];
const replies: Response[] = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  const call: Call = { url: String(url), auth: new Headers(init.headers).get("authorization") };
  if (init.body instanceof FormData) call.form = init.body;
  else call.json = JSON.parse(String(init.body));
  calls.push(call);
  return replies.shift() ?? new Response("{}", { status: 200 });
}) as typeof fetch;

const reset = () => {
  calls.length = 0;
  replies.length = 0;
};

test("sendVoice sube el audio a WhatsApp y lo manda como nota de voz", async () => {
  reset();
  replies.push(new Response(JSON.stringify({ id: "media-777" }), { status: 200 }));
  await new WhatsAppSender().sendVoice("584127176924", Buffer.from([1, 2, 3, 4]));

  assert.equal(calls.length, 2);
  // 1) subida
  assert.equal(calls[0].url, "https://graph.facebook.com/v25.0/123456/media");
  assert.equal(calls[0].auth, "Bearer tok-test");
  assert.equal(calls[0].form!.get("messaging_product"), "whatsapp");
  assert.equal(calls[0].form!.get("type"), "audio/ogg");
  const file = calls[0].form!.get("file") as File;
  assert.equal(file.name, "ancla.ogg");
  assert.equal(file.size, 4);
  // 2) envío como voz
  assert.equal(calls[1].url, "https://graph.facebook.com/v25.0/123456/messages");
  assert.deepEqual(calls[1].json, {
    messaging_product: "whatsapp",
    to: "584127176924",
    type: "audio",
    audio: { id: "media-777", voice: true },
  });
});

test("si la subida falla o no trae id, lanza error (la app responde en texto)", async () => {
  reset();
  replies.push(new Response("{}", { status: 400 }));
  await assert.rejects(() => new WhatsAppSender().sendVoice("1", Buffer.from([1])), /subir audio 400/);

  reset();
  replies.push(new Response("{}", { status: 200 }));
  await assert.rejects(() => new WhatsAppSender().sendVoice("1", Buffer.from([1])), /no devolvió el id/);
  assert.equal(calls.length, 1, "no manda el mensaje si no hay audio subido");
});
