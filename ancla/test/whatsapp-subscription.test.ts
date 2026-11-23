import { test } from "node:test";
import assert from "node:assert/strict";

// Archivo propio: se fijan las variables antes de importar la configuración.
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "123";
process.env.WHATSAPP_TOKEN = "t";
const { ensureWebhookSubscription } = await import("../src/whatsapp.ts");

test("revisa y reconecta la cuenta de WhatsApp a la app", async () => {
  const calls: { url: string; method: string }[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify({ data: [] }), { status: 200 });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }) as typeof fetch;
  const msg = await ensureWebhookSubscription(fake);
  assert.match(msg, /antes: ninguna.*OK/);
  assert.deepEqual(calls.map((c) => c.method), ["GET", "POST"]);
  assert.ok(calls[0].url.endsWith("/123/subscribed_apps"));
});

test("si Meta rechaza la reconexión, lo dice en los registros sin romper el arranque", async () => {
  const fake = (async (_url: string, init?: RequestInit) =>
    (init?.method ?? "GET") === "GET"
      ? new Response(JSON.stringify({ data: [{ whatsapp_business_api_data: { name: "Ancla" } }] }), { status: 200 })
      : new Response("sin permiso", { status: 403 })) as typeof fetch;
  const msg = await ensureWebhookSubscription(fake);
  assert.match(msg, /antes: Ancla.*No se pudo reconectar \(403/);
});
