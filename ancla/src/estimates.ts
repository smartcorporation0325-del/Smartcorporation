// Estimador real de tiempos: compara lo que ella calculó con lo que de verdad le tomó.
// Las personas con TDA suelen subestimar cuánto tardan ("ceguera temporal"); con datos propios,
// Ancla puede decirle "dices 10 min, pero esto te suele tomar unos 25" sin adivinar.

import type { Item } from "./types.ts";

/** Una tarea terminada con inicio, fin y cálculo suyo. */
export interface TimingSample {
  title: string;
  estimate: number; // minutos que ella calculó
  actual: number; // minutos reales (de "empecé" a "terminé")
  doneAt: string;
}

// Menos de 1 min: se marcó empezada y terminada a la vez (no se midió nada).
// Más de 8 h: casi seguro se le olvidó avisar que terminó; ese dato engaña más de lo que ayuda.
const MIN_REAL = 1;
const MAX_REAL = 8 * 60;
/** Con menos muestras que esto no se calcula un factor (sería ruido); solo se muestran ejemplos. */
export const MIN_SAMPLES_FOR_FACTOR = 3;

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000);
}

export function timingSamples(items: Item[]): TimingSample[] {
  const out: TimingSample[] = [];
  for (const it of items) {
    if (it.status !== "done" || !it.startedAt || !it.doneAt || !it.estimateMinutes) continue;
    const actual = minutesBetween(it.startedAt, it.doneAt);
    if (actual < MIN_REAL || actual > MAX_REAL) continue;
    out.push({ title: it.title, estimate: it.estimateMinutes, actual, doneAt: it.doneAt });
  }
  return out.sort((a, b) => a.doneAt.localeCompare(b.doneAt));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Cuántas veces lo que calcula le toma de verdad (mediana, para que un caso raro no lo distorsione). */
export function estimateFactor(samples: TimingSample[]): number | null {
  if (samples.length < MIN_SAMPLES_FOR_FACTOR) return null;
  return Math.round(median(samples.map((s) => s.actual / s.estimate)) * 10) / 10;
}

/** Tiempo realista para un cálculo suyo, según su factor (redondeado a 5 min). */
export function realisticMinutes(estimate: number, factor: number | null): number | null {
  if (!factor || factor <= 1.1) return null; // si calcula bien, no hay nada que corregir
  return Math.max(5, Math.round((estimate * factor) / 5) * 5);
}

/** Líneas para el <contexto> del modelo. Vacío si todavía no hay datos. */
export function timingContext(items: Item[]): string[] {
  const samples = timingSamples(items);
  if (samples.length === 0) return [];
  const factor = estimateFactor(samples);
  const lines = ["Cuánto le toman las cosas DE VERDAD (medido por ti: de 'empecé' a 'terminé'):"];
  for (const s of samples.slice(-5)) lines.push(`- "${s.title}": calculó ${s.estimate} min, le tomó ${s.actual} min`);
  if (factor) {
    lines.push(
      factor > 1.1
        ? `En general le toma ${factor} veces lo que calcula (${samples.length} tareas medidas).`
        : `En general calcula bien sus tiempos (${samples.length} tareas medidas).`,
    );
  } else {
    lines.push(`Todavía son pocas tareas medidas (${samples.length}): no saques un promedio, solo usa los ejemplos si vienen al caso.`);
  }
  return lines;
}

