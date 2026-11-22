import { config } from "./config.ts";

/**
 * Transcribe un audio con cualquier servicio compatible con el endpoint `/audio/transcriptions`
 * (formulario multipart con `file` y `model`, respuesta `{ text }`). Se configura con
 * TRANSCRIBE_URL / TRANSCRIBE_API_KEY / TRANSCRIBE_MODEL. Devuelve null si no está configurado.
 */
export async function transcribe(audio: Buffer, mimeType: string): Promise<string | null> {
  if (!config.transcribeUrl) return null;
  const form = new FormData();
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mpeg") ? "mp3" : "m4a";
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `audio.${ext}`);
  form.append("model", config.transcribeModel);
  form.append("language", "es");
  const res = await fetch(config.transcribeUrl, {
    method: "POST",
    headers: config.transcribeApiKey ? { Authorization: `Bearer ${config.transcribeApiKey}` } : {},
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Transcripción ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
