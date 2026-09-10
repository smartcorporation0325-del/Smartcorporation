import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CriterionScore } from "@/types/db";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null | undefined, max = 100): string {
  if (score == null) return "—";
  return `${Math.round(score)}/${max}`;
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n)}%`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function scoreTone(pct: number): "good" | "warn" | "bad" {
  if (pct >= 75) return "good";
  if (pct >= 55) return "warn";
  return "bad";
}

/**
 * Aggregates a scorecard section's total score/max across ALL its criteria — a
 * section like "Closing" is made of several criterion_scores rows (e.g. "Identified
 * buying signals", "Trial close", "Asked for commitment"...), not one. Several call
 * sites used to do `criterionScores.find(cs => cs.section_name === "Closing")`,
 * which only grabs the first matching row and silently evaluates just that one
 * criterion (e.g. "did the rep notice buying signals") instead of the section's real
 * performance — confirmed in production: a call where the rep noticed signals well
 * but never asked for the sale wasn't flagged as a missed closing opportunity,
 * because the lucky first row happened to score high.
 */
export function getSectionScore(
  criterionScores: CriterionScore[],
  sectionName: string
): { score: number; maxScore: number; pct: number } | null {
  const rows = criterionScores.filter((cs) => cs.section_name === sectionName);
  if (!rows.length) return null;
  const score = rows.reduce((sum, cs) => sum + (cs.score ?? 0), 0);
  const maxScore = rows.reduce((sum, cs) => sum + (cs.max_score ?? 0), 0);
  return { score, maxScore, pct: maxScore > 0 ? (score / maxScore) * 100 : 0 };
}

export function titleCase(s: string): string {
  return s
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
