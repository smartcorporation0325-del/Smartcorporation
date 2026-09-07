import { getCalls } from "./calls";
import { isHotLead } from "@/lib/rules/hot-lead";
import { detectMissedRevenueOpportunity } from "@/lib/rules/missed-revenue";
import type { CallWithRelations } from "@/types/db";

// Kept intentionally small (Section 11 — Simple Dashboard Design): top-row counts,
// two charts, and the recent calls list. Founder Snapshot, Hot Leads, and the Weekly
// Founder Brief are computed separately in lib/data/founder.ts.
export interface DashboardMetrics {
  callsAnalyzed: number;
  hotLeadsCount: number;
  missedRevenueCount: number;
  followUpsDueCount: number;
  scoreOverTime: { date: string; score: number }[];
  topObjections: { type: string; count: number }[];
  hotLeads: CallWithRelations[];
  recentCalls: CallWithRelations[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const calls = await getCalls();
  const analyzed = calls.filter((c) => c.analysis);

  const hotLeads = analyzed.filter((c) => isHotLead(c));
  const missedRevenueCount = analyzed.filter((c) => detectMissedRevenueOpportunity(c).flagged).length;
  const followUpsDueCount = analyzed.filter((c) => {
    const q = (c.analysis!.follow_up_assessment as { quality?: string } | null)?.quality;
    return c.deal?.status === "open" && q !== "clear";
  }).length;

  const scoreOverTime = [...analyzed]
    .sort((a, b) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime())
    .map((c) => ({ date: (c.started_at ?? "").slice(0, 10), score: c.analysis!.overall_score ?? 0 }));

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

  const recentCalls = [...calls]
    .sort((a, b) => new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime())
    .slice(0, 8);

  return {
    callsAnalyzed: analyzed.length,
    hotLeadsCount: hotLeads.length,
    missedRevenueCount,
    followUpsDueCount,
    scoreOverTime,
    topObjections,
    hotLeads,
    recentCalls,
  };
}
