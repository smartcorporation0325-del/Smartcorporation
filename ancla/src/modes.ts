import { config } from "./config.ts";
import type { TurnInput } from "./types.ts";

// Modos de respuesta, como el "Instantáneo" y el "Pensar" de Muse:
//   fast   → acuses y botones simples ("gracias", "Ya empecé"): respuesta cortísima y rápida
//   normal → la conversación de siempre
//   deep   → "Piénsalo bien", planes grandes o desahogos larguísimos: más razonamiento (y más tiempo)
// La elección es determinista (sin otra llamada a la IA), así que no suma costo ni demora.

export type Mode = "fast" | "normal" | "deep";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ModePlan {
  model: string;
  effort: Effort;
  maxTokens: number;
}

// Cuánto texto cuenta como "desahogo larguísimo" (p. ej. una nota de voz larga transcrita).
export const DEEP_MIN_CHARS = 900;

const FAST_REPLIES = new Set([
  "gracias", "muchas gracias", "ok", "okey", "vale", "listo", "va", "dale", "jaja", "jajaja", "jeje",
  "si", "no", "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches",
  "ya empece", "10 min mas", "mas tarde", "otra cosa", "hoy no", "ya lo hice", "lo hago ya", "ya termine", "empezar",
]);

const DEEP_PHRASES = /^(piensalo bien|pensalo bien|ayudame a planear|planea|planifica|organiza mi semana|organizame la semana|hazme un plan)\b/;

/** Minúsculas, sin acentos, emojis ni signos, con espacios simples. */
export function normalizeForMode(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function chooseMode(input: TurnInput): Mode {
  if (input.type !== "message") return "normal"; // buenos días, check-ins y recordatorios llevan el cariño completo
  if (input.image) return "normal";
  const norm = normalizeForMode(input.text);
  if (DEEP_PHRASES.test(norm) || input.text.length >= DEEP_MIN_CHARS) return "deep";
  if (norm.length > 0 && norm.length <= 25 && FAST_REPLIES.has(norm)) return "fast";
  return "normal";
}

/** Qué modelo y cuánto razonamiento usar. Sin variables de entorno, los tres modos usan el mismo modelo. */
export function planFor(mode: Mode): ModePlan {
  switch (mode) {
    case "fast":
      return { model: config.fastModel || config.model, effort: "low", maxTokens: 4000 };
    case "deep":
      return { model: config.deepModel || config.model, effort: config.deepEffort, maxTokens: 16000 };
    default:
      return { model: config.model, effort: config.effort, maxTokens: 8000 };
  }
}

export const MODE_LABEL: Record<Mode, string> = { fast: "rápido", normal: "normal", deep: "profundo" };
