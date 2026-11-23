import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

// Archivo propio: con llave e id de voz de ElevenLabs, se usa ElevenLabs aunque también haya llave de OpenAI.
const OGG_OPUS = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(24), Buffer.from("OpusHead"), Buffer.alloc(20)]);
let reply: { status: number; body: Buffer | string } = { status: 200, body: OGG_OPUS };
const seen: { url?: string; key?: string; body?: any } = {};

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  seen.url = req.url;
  seen.key = req.headers["xi-api-key"] as string;
  seen.body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  res.writeHead(reply.status).end(reply.body);
}).listen(0);
await new Promise((r) => server.once("listening", r));
process.env.ELEVENLABS_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
process.env.ELEVENLABS_API_KEY = "k-11";
process.env.ELEVENLABS_VOICE_ID = "voz123";
process.env.TTS_API_KEY = "k-openai";
const { synthesize, ttsProvider } = await import("../src/tts.ts");

test("usa ElevenLabs con la voz elegida y pide Ogg/Opus", async () => {
  assert.equal(ttsProvider(), "elevenlabs");
  const audio = await synthesize("Hola, ¿cómo vas?", "instrucciones que ElevenLabs no usa");
  assert.deepEqual(audio, OGG_OPUS);
  assert.equal(seen.url, "/v1/text-to-speech/voz123?output_format=opus_48000_64");
  assert.equal(seen.key, "k-11");
  assert.equal(seen.body.text, "Hola, ¿cómo vas?");
  assert.equal(seen.body.model_id, "eleven_multilingual_v2");
});

test("los errores de ElevenLabs dicen el motivo sin el texto del mensaje", async () => {
  reply = { status: 401, body: JSON.stringify({ detail: { status: "detected_unusual_activity", message: "x" } }) };
  await assert.rejects(
    () => synthesize("algo privado", "x"),
    (err: Error) => err.message === "Voz ElevenLabs 401 detected_unusual_activity" && !err.message.includes("privado"),
  );
  server.close();
});
