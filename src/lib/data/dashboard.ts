import { getCalls, callNeedsAttention } from "./calls";
import type { CallWithRelations } from "@/types/db";

export interface DashboardMetrics {
  callsAnalyzed: number;
  averageScore: number;
  openOpportunities: number;
  closedWon: number;
  closedLost: number;
  conversionRate: number;
  callsRequiringAttention: number;
  averageCloseProbability: number;
  scoreOverTime: { date: string; score: number }[];
  scoreByCategory: { category: string; avgPercent: number }[];
  topObjections: { type: string; count: number }[];
  wonVsLostScore: { label: string; avgScore: number }[];
  closeProbabilityDistribution: { bucket: string; count: number }[];
  followUpCompliance: { label: string; count: number }[];
  attentionCalls: CallWithRelations[];
}

export async function getDashboardMetrics(repId?: string): Promise<DashboardMetrics> {
  const calls = await getCalls(repId ? { repId } : {});
  const analyzed = calls.filter((c) => c.analysis);
  const scores = analyzed.map((c) => c.analysis!.overall_score ?? 0);
  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);

  const closedWon = calls.filter((c) => c.deal?.status === "closed_won").length;
  const closedLost = calls.filter((c) => c.deal?.status === "closed_lost").length;
  const openOpportunities = calls.filter((c) => c.deal?.status === "open").length;
  const conversionRate = closedWon + closedLost > 0 ? Math.round((closedWon / (closedWon + closedLost)) * 1000) / 10 : 0;

  const scoreOverTime = [...analyzed]
    .sort((a, b) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime())
    .map((c) => ({
      date: (c.started_at ?? "").slice(0, 10),
      score: c.analysis!.overall_score ?? 0,
    }));

  const categoryTotals = new Map<string, { sum: number; max: number }>();
  for (const c of analyzed) {
    for (const cs of c.analysis!.criterion_scores) {
      const key = cs.section_name ?? "Unknown";
      const entry = categoryTotals.get(key) ?? { sum: 0, max: 0 };
      entry.sum += cs.score ?? 0;
      entry.max += cs.max_score ?? 0;
      categoryTotals.set(key, entry);
    }
  }
  const scoreByCategory = Array.from(categoryTotals.entries()).map(([category, { sum, max }]) => ({
    category,
    avgPercent: max > 0 ? Math.round((sum / max) * 1000) / 10 : 0,
  }));

  const objectionCounts = new Map<string, number>();
  for (const c of analyzed) {
    for (const o of c.analysis!.objections) {
      const key = o.objection_type ?? "other";
      objectionCounts.set(key, (objectionCounts.get(key) ?? 0) + 1);
    }
  }
  const topObjections = Array.from(objectionCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const wonScores = analyzed.filter((c) => c.deal?.status === "closed_won").map((c) => c.analysis!.overall_score ?? 0);
  const lostScores = analyzed.filter((c) => c.deal?.status === "closed_lost").map((c) => c.analysis!.overall_score ?? 0);
  const wonVsLostScore = [
    { label: "Won", avgScore: avg(wonScores) },
    { label: "Lost", avgScore: avg(lostScores) },
  ];

  const buckets = [
    { bucket: "0-25", min: 0, max: 25 },
    { bucket: "26-50", min: 26, max: 50 },
    { bucket: "51-75", min: 51, max: 75 },
    { bucket: "76-100", min: 76, max: 100 },
  ];
  const closeProbabilityDistribution = buckets.map((b) => ({
    bucket: b.bucket,
    count: analyzed.filter((c) => {
      const p = c.analysis!.close_probability ?? 0;
      return p >= b.min && p <= b.max;
    }).length,
  }));

  const followUpQuality = (c: CallWithRelations) =>
    (c.analysis!.follow_up_assessment as { quality?: string } | null)?.quality;
  const followUpCompliance = [
    { label: "Clear", count: analyzed.filter((c) => followUpQuality(c) === "clear").length },
    { label: "Vague", count: analyzed.filter((c) => followUpQuality(c) === "vague").length },
    { label: "Missing", count: analyzed.filter((c) => followUpQuality(c) === "missing").length },
  ];

  const attentionCalls = calls.filter(callNeedsAttention);

  return {
    callsAnalyzed: analyzed.length,
    averageScore: avg(scores),
    openOpportunities,
    closedWon,
    closedLost,
    conversionRate,
    callsRequiringAttention: attentionCalls.length,
    averageCloseProbability: avg(analyzed.map((c) => c.analysis!.close_probability ?? 0)),
    scoreOverTime,
    scoreByCategory,
    topObjections,
    wonVsLostScore,
    closeProbabilityDistribution,
    followUpCompliance,
    attentionCalls,
  };
}
