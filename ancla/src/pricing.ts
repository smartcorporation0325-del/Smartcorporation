// Costo aproximado de cada llamada, para saber cuánto cuesta cada persona y poder poner precios a los planes.
// Precios por millón de tokens (fuente: tabla oficial de Anthropic, noviembre de 2026). Revisar si cambian.

export interface Usage {
  model: string;
  inputTokens: number; // sin caché
  outputTokens: number; // incluye el razonamiento
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number; // escritura de caché de 5 min = 1,25 × entrada
}

const PRICES: [RegExp, Price][] = [
  [/opus-5-5/, { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }],
  [/opus/, { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }],
  [/sonnet-5-5/, { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 }],
  [/sonnet/, { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }],
  [/haiku-5-5/, { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }],
  [/haiku/, { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }],
];
// Un modelo desconocido se cuenta caro, para no subestimar.
const FALLBACK_PRICE: Price = { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 };

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export function costUsd(u: Usage): number {
  const p = PRICES.find(([re]) => re.test(u.model))?.[1] ?? FALLBACK_PRICE;
  return round6(
    (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) /
      1_000_000,
  );
}

/** Nota de voz de OpenAI (gpt-4o-mini-tts): ~0,015 USD por minuto; ~900 caracteres en español por minuto. */
export function voiceCostUsd(chars: number): number {
  return round6((chars / 900) * 0.015);
}

/** Lo que se guarda por cada llamada (sin contenido de mensajes). */
export interface UsageRecord extends Usage {
  userId: string;
  kind: "message" | "event" | "memory" | "voice";
  costUsd: number;
}
