import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

// Este archivo corre en su propio proceso, así que puede fijar las variables antes de importar.
test("transcribe manda el audio como multipart con modelo e idioma y devuelve el texto limpio", async () => {
  const seen: { auth?: string; form?: FormData } = {};
  let status = 200;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    seen.auth = req.headers.authorization;
    seen.form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": req.headers["content-type"] ?? "" },
    }).formData();
    res
      .writeHead(status, { "Content-Type": "application/json" })
      .end(JSON.stringify(status === 200 ? { text: "  tengo que llamar al dentista " } : { error: "boom" }));
  }).listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as { port: number };
  process.env.TRANSCRIBE_URL = `http://127.0.0.1:${port}/openai/v1/audio/transcriptions`;
  process.env.TRANSCRIBE_API_KEY = "k-test";
  process.env.TRANSCRIBE_MODEL = "modelo-x";
  const { transcribe } = await import("../src/transcribe.ts");
  try {
    const text = await transcribe(Buffer.from([1, 2, 3]), "audio/ogg; codecs=opus");
    assert.equal(text, "tengo que llamar al dentista");
    assert.equal(seen.auth, "Bearer k-test");
    assert.equal(seen.form!.get("model"), "modelo-x");
    assert.equal(seen.form!.get("language"), "es");
    const file = seen.form!.get("file") as File;
    assert.equal(file.name, "audio.ogg");
    assert.equal(file.size, 3);

    status = 500;
    await assert.rejects(() => transcribe(Buffer.from([1]), "audio/ogg"), /Transcripción 500/);
  } finally {
    server.close();
  }
});
