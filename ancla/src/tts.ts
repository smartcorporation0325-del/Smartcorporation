import { config } from "./config.ts";
import { countryFromPhone } from "./dialect.ts";
import type { User } from "./types.ts";

// Respuestas en nota de voz. WhatsApp solo muestra una nota de voz si el archivo es Ogg con códec Opus,
// así que se le pide ese formato al servicio de voz y se comprueba antes de enviarlo.

/** Más largo que esto se queda en texto: un audio largo es difícil de escuchar y cuesta más. */
export const MAX_VOICE_CHARS = 600;

/** ElevenLabs si tiene llave y voz; si no, OpenAI si tiene llave. */
export function ttsProvider(): "elevenlabs" | "openai" | null {
  if (config.elevenlabsApiKey && config.elevenlabsVoiceId) return "elevenlabs";
  if (config.ttsApiKey) return "openai";
  return null;
}

export function ttsConfigured(): boolean {
  return ttsProvider() !== null;
}

/** Texto que suene natural al leerlo en voz alta: sin enlaces, emojis ni viñetas. */
export function speechText(reply: string): string {
  return reply
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .replace(/^[ \t•\-–*]+/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Cómo debe sonar: cálida, de amiga, con el acento de su país (si se sabe por el teléfono). */
export function voiceInstructions(user: Pick<User, "phone">): string {
  const country = countryFromPhone(user.phone)?.country;
  const accent = country && !country.includes("EE. UU.") ? `acento de ${country}` : "acento latinoamericano neutro";
  return `${config.ttsInstructions} Usa ${accent}.`;
}

/** ¿Es un archivo Ogg con Opus? (empieza con "OggS" y trae la cabecera "OpusHead") */
export function isOggOpus(audio: Buffer): boolean {
  return audio.length > 28 && audio.subarray(0, 4).toString("latin1") === "OggS" && audio.subarray(0, 128).includes("OpusHead");
}

/**
 * Convierte texto en una nota de voz (Ogg/Opus). Devuelve null si no hay servicio configurado y lanza
 * un error si falla; quien llama debe responder en texto en ese caso.
 */
export async function synthesize(text: string, instructions: string): Promise<Buffer | null> {
  const provider = ttsProvider();
  if (!provider || !text) return null;
  const res =
    provider === "elevenlabs"
      ? await elevenlabsRequest(text)
      : await openaiRequest(text, instructions);
  if (!res.ok) {
    // Solo el estado y el código: nunca el contenido del mensaje.
    const body = (await res.json().catch(() => null)) as { error?: { code?: string }; detail?: { status?: string } } | null;
    const code = body?.error?.code ?? body?.detail?.status ?? "";
    throw new Error(`Voz ${provider === "elevenlabs" ? "ElevenLabs " : ""}${res.status} ${code}`.trim());
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (!isOggOpus(audio)) throw new Error("La voz no llegó en formato Ogg/Opus (WhatsApp no la mostraría como nota de voz)");
  return audio;
}

// ElevenLabs no recibe instrucciones de tono: el acento y la calidez vienen de la voz elegida.
function elevenlabsRequest(text: string) {
  const url = `${config.elevenlabsUrl}/v1/text-to-speech/${encodeURIComponent(config.elevenlabsVoiceId)}?output_format=opus_48000_64`;
  return fetch(url, {
    method: "POST",
    headers: { "xi-api-key": config.elevenlabsApiKey, "Content-Type": "application/json", Accept: "audio/ogg" },
    body: JSON.stringify({
      text,
      model_id: config.elevenlabsModel,
      // Algo de variación para que no suene plano, sin que cambie de voz entre frases.
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(45_000),
  });
}

function openaiRequest(text: string, instructions: string) {
  return fetch(config.ttsUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.ttsApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ttsModel,
      voice: config.ttsVoice,
      input: text,
      instructions,
      response_format: "opus",
    }),
    signal: AbortSignal.timeout(45_000),
  });
}
