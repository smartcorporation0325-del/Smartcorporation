import { test } from "node:test";
import assert from "node:assert/strict";

test("sin TRANSCRIBE_URL configurada, transcribe devuelve null y no llama a nadie", async () => {
  delete process.env.TRANSCRIBE_URL;
  const { transcribe } = await import("../src/transcribe.ts");
  assert.equal(await transcribe(Buffer.from([1]), "audio/ogg"), null);
});
