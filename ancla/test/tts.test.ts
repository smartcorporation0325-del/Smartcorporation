import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

// Archivo propio (proceso propio): se fijan las variables antes de importar la configuración.
const OGG_OPUS = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(24), Buffer.from("OpusHead"), Buffer.alloc(20)]);
let reply: { status: number; body: Buffer | string } = { status: 200, body: OGG_OPUS };
const seen: { auth?: string; body?: any; calls: number } = { calls: 0 };

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  seen.calls++;
  seen.auth = req.headers.authorization;
  seen.body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  res.writeHead(reply.status, { "Content-Type": reply.status === 200 ? "audio/ogg" : "application/json" }).end(reply.body);
}).listen(0);
await new Promise((r) => server.once("listening", r));
process.env.TTS_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1/audio/speech`;
process.env.TTS_API_KEY = "k-tts";
const { synthesize, isOggOpus, ttsConfigured } = await import("../src/tts.ts");

test("synthesize pide Ogg/Opus con la voz y las instrucciones, y devuelve el audio", async () => {
  assert.equal(ttsConfigured(), true);
  const audio = await synthesize("Hola, empecemos por lo más chiquito.", "Habla cálido. Usa acento de Venezuela.");
  assert.ok(audio && isOggOpus(audio));
  assert.deepEqual(audio, OGG_OPUS);
  assert.equal(seen.auth, "Bearer k-tts");
  assert.deepEqual(seen.body, {
    model: "gpt-4o-mini-tts",
    voice: "coral",
    input: "Hola, empecemos por lo más chiquito.",
    instructions: "Habla cálido. Usa acento de Venezuela.",
    response_format: "opus",
  });
});

test("si el audio no es Ogg/Opus, falla con un mensaje claro (para responder en texto)", async () => {
  reply = { status: 200, body: Buffer.concat([Buffer.from("ID3"), Buffer.alloc(60)]) };
  await assert.rejects(() => synthesize("hola", "x"), /Ogg\/Opus/);
});

test("si el servicio falla, el error trae el estado y el código pero NUNCA el texto del mensaje", async () => {
  reply = { status: 429, body: JSON.stringify({ error: { code: "rate_limit_exceeded", message: "hola secreto de la persona" } }) };
  await assert.rejects(
    () => synthesize("hola secreto de la persona", "x"),
    (err: Error) => err.message === "Voz 429 rate_limit_exceeded" && !err.message.includes("secreto"),
  );
});

test("sin texto no llama a nadie", async () => {
  const before = seen.calls;
  assert.equal(await synthesize("", "x"), null);
  assert.equal(seen.calls, before);
  server.close();
});
