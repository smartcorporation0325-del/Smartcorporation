import { config } from "./config.ts";
import { countryFromPhone } from "./dialect.ts";
import type { User } from "./types.ts";

// Respuestas en nota de voz. WhatsApp solo muestra una nota de voz si el archivo es Ogg con códec Opus,
// así que se le pide ese formato al servicio de voz y se comprueba antes de enviarlo.

/** Más largo que esto se queda en texto: un audio largo es difícil de escuchar y cuesta más. */
export const MAX_VOICE_CHARS = 600;

export function ttsConfigured(): boolean {
  return Boolean(config.ttsApiKey);
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
  if (!config.ttsApiKey || !text) return null;
  const res = await fetch(config.ttsUrl, {
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
  if (!res.ok) {
    // Solo el estado y el código: nunca el contenido del mensaje.
    const code = ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code ?? "";
    throw new Error(`Voz ${res.status} ${code}`.trim());
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (!isOggOpus(audio)) throw new Error("La voz no llegó en formato Ogg/Opus (WhatsApp no la mostraría como nota de voz)");
  return audio;
}
