import { test } from "node:test";
import assert from "node:assert/strict";

test("sin TTS_API_KEY, no hay voz: synthesize devuelve null y ttsConfigured es falso", async () => {
  delete process.env.TTS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  const { synthesize, ttsConfigured } = await import("../src/tts.ts");
  assert.equal(ttsConfigured(), false);
  assert.equal(await synthesize("hola", "x"), null);
});
