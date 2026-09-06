import { getCalls } from "./calls";
import type { CallWithRelations, SalesRep } from "@/types/db";

export interface RepCoachingSummary {
  rep: SalesRep;
  overallScore: number;
  trend: "up" | "down" | "flat";
  sectionAverages: Record<string, number>;
  primaryWeakness: string;
  primaryStrength: string;
  recommendedTopic: string;
  callsToReview: CallWithRelations[];
  strongExample: CallWithRelations | null;
  improvementExamples: CallWithRelations[];
}

export async function getCoachingSummaries(): Promise<RepCoachingSummary[]> {
  const calls = await getCalls();
  const byRep = new Map<string, CallWithRelations[]>();
  for (const c of calls) {
    if (!c.sales_rep_id || !c.analysis || !c.sales_rep) continue;
    const arr = byRep.get(c.sales_rep_id) ?? [];
    arr.push(c);
    byRep.set(c.sales_rep_id, arr);
  }

  const summaries: RepCoachingSummary[] = [];
  for (const [, repCalls] of byRep) {
    const rep = repCalls[0].sales_rep!;
    const sorted = [...repCalls].sort((a, b) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime());
    const scores = sorted.map((c) => c.analysis!.overall_score ?? 0);
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const half = Math.floor(scores.length / 2) || 1;
    const firstHalfAvg = avg(scores.slice(0, half));
    const secondHalfAvg = avg(scores.slice(half));
    const trend = secondHalfAvg > firstHalfAvg + 2 ? "up" : secondHalfAvg < firstHalfAvg - 2 ? "down" : "flat";

    const sectionTotals = new Map<string, { sum: number; max: number }>();
    for (const c of repCalls) {
      for (const cs of c.analysis!.criterion_scores) {
        const key = cs.section_name ?? "Unknown";
        const entry = sectionTotals.get(key) ?? { sum: 0, max: 0 };
        entry.sum += cs.score ?? 0;
        entry.max += cs.max_score ?? 0;
        sectionTotals.set(key, entry);
      }
    }
    const sectionAverages: Record<string, number> = {};
    let weakest: { name: string; pct: number } | null = null;
    let strongest: { name: string; pct: number } | null = null;
    for (const [name, { sum, max }] of sectionTotals) {
      const pct = max > 0 ? Math.round((sum / max) * 100) : 0;
      sectionAverages[name] = pct;
      if (!weakest || pct < weakest.pct) weakest = { name, pct };
      if (!strongest || pct > strongest.pct) strongest = { name, pct };
    }

    const weakCalls = [...repCalls].sort((a, b) => (a.analysis!.overall_score ?? 0) - (b.analysis!.overall_score ?? 0));
    const callsToReview = weakCalls.slice(0, 3);
    const strongExample = [...repCalls].sort((a, b) => (b.analysis!.overall_score ?? 0) - (a.analysis!.overall_score ?? 0))[0] ?? null;
    const improvementExamples = weakCalls.slice(0, 2);

    summaries.push({
      rep,
      overallScore,
      trend,
      sectionAverages,
      primaryWeakness: weakest?.name ?? "—",
      primaryStrength: strongest?.name ?? "—",
      recommendedTopic: recommendTopic(weakest?.name),
      callsToReview,
      strongExample,
      improvementExamples,
    });
  }

  return summaries;
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function recommendTopic(section?: string): string {
  switch (section) {
    case "Discovery":
      return "Practice actively discovering budget and decision-makers rather than accepting vague first answers.";
    case "Objection Handling":
      return "Roleplay isolating objections before responding — 'is it the price, or something else?'";
    case "Closing":
      return "Practice a natural conditional close tied to a concrete next step (video, availability, etc.).";
    case "Value Presentation":
      return "Practice leading with value and a personalized recommendation before discussing price.";
    case "Follow-Up Discipline":
      return "Always commit to a specific date and owner for the next touchpoint — never leave it open-ended.";
    default:
      return "Review recent calls together and identify one concrete pattern to focus on this week.";
  }
}
