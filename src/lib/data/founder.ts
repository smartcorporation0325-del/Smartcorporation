import { getCalls } from "./calls";
import { isHotLead, hotLeadNeedsAction } from "@/lib/rules/hot-lead";
import { detectMissedRevenueOpportunity } from "@/lib/rules/missed-revenue";
import { getDealRisk } from "@/lib/rules/deal-risk";
import { isAnthropicConfigured } from "@/services/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import type { CallWithRelations } from "@/types/db";

// ============================================================================
// Founder Snapshot & Weekly Founder Brief (Sections 1 & 9).
//
// Both are built ONLY from structured data already stored in call_analyses — never
// by re-reading raw transcripts — per the explicit instruction to avoid a second
// analysis pass. The weekly brief's one-paragraph executive summary optionally asks
// Claude to phrase a handful of aggregate numbers into prose (a tiny, cheap prompt,
// not a transcript re-analysis); without ANTHROPIC_API_KEY it falls back to a
// deterministic template.
// ============================================================================

export interface FounderSnapshot {
  biggestRisk: string;
  bestOpportunity: string;
  mainObjection: string;
  coachingFocus: string;
}

export async function getFounderSnapshot(): Promise<FounderSnapshot> {
  const calls = await getCalls();
  const analyzed = calls.filter((c) => c.analysis);

  const hotLeadsNoAction = analyzed.filter(hotLeadNeedsAction);
  const highIntentActionable = analyzed.filter(
    (c) => isHotLead(c) && c.analysis!.next_actions.some((n) => !n.completed)
  );

  const objectionCounts = new Map<string, number>();
  for (const c of analyzed) {
    for (const o of c.analysis!.objections) {
      const key = o.objection_type ?? "other";
      objectionCounts.set(key, (objectionCounts.get(key) ?? 0) + 1);
    }
  }
  const topObjection = [...objectionCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const weaknessSectionCounts = new Map<string, number>();
  for (const c of analyzed) {
    for (const cs of c.analysis!.criterion_scores) {
      if (!cs.max_score || (cs.score ?? 0) / cs.max_score >= 0.6) continue;
      const key = cs.section_name ?? "Unknown";
      weaknessSectionCounts.set(key, (weaknessSectionCounts.get(key) ?? 0) + 1);
    }
  }
  const topWeakness = [...weaknessSectionCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    biggestRisk: hotLeadsNoAction.length
      ? `${hotLeadsNoAction.length} high-intent opportunit${hotLeadsNoAction.length === 1 ? "y" : "ies"} currently ${hotLeadsNoAction.length === 1 ? "has" : "have"} no confirmed next step.`
      : "No high-intent opportunities are currently missing a next step.",
    bestOpportunity: highIntentActionable.length
      ? `${highIntentActionable.length} client${highIntentActionable.length === 1 ? "" : "s"} showed strong buying intent with a next step already in motion.`
      : analyzed.some((c) => isHotLead(c))
        ? `${analyzed.filter(isHotLead).length} client(s) showed strong buying intent this period.`
        : "No standout high-intent opportunities identified yet.",
    mainObjection: topObjection
      ? `${titleCase(topObjection[0])} continues to be the most frequent objection (${topObjection[1]} call${topObjection[1] === 1 ? "" : "s"}).`
      : "No recurring objection pattern identified yet.",
    coachingFocus: topWeakness
      ? `Federico needs to improve ${topWeakness[0].toLowerCase()} — it scored below target on ${topWeakness[1]} call${topWeakness[1] === 1 ? "" : "s"}.`
      : "No consistent coaching gap identified yet — performance is even across sections.",
  };
}

export interface WeeklyFounderBrief {
  callsAnalyzed: number;
  highIntentOpportunities: number;
  missedCloseOpportunities: number;
  followUpsOverdue: number;
  mainObjection: string;
  averageScore: number;
  mainCoachingFocus: string;
  executiveSummary: string;
}

export async function getWeeklyFounderBrief(): Promise<WeeklyFounderBrief> {
  const calls = await getCalls();
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = calls.filter((c) => c.analysis && new Date(c.started_at ?? 0).getTime() >= cutoff);

  const highIntent = recent.filter((c) => isHotLead(c)).length;
  const missedClose = recent.filter((c) => detectMissedRevenueOpportunity(c).flagged).length;
  const followUpsOverdue = recent.filter((c) => {
    const q = (c.analysis!.follow_up_assessment as { quality?: string } | null)?.quality;
    return c.deal?.status === "open" && q !== "clear";
  }).length;

  const objectionCounts = new Map<string, number>();
  for (const c of recent) for (const o of c.analysis!.objections) objectionCounts.set(o.objection_type ?? "other", (objectionCounts.get(o.objection_type ?? "other") ?? 0) + 1);
  const topObjection = [...objectionCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const scores = recent.map((c) => c.analysis!.overall_score ?? 0);
  const averageScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

  const weaknessSectionCounts = new Map<string, number>();
  for (const c of recent) {
    for (const cs of c.analysis!.criterion_scores) {
      if (!cs.max_score || (cs.score ?? 0) / cs.max_score >= 0.6) continue;
      weaknessSectionCounts.set(cs.section_name ?? "Unknown", (weaknessSectionCounts.get(cs.section_name ?? "Unknown") ?? 0) + 1);
    }
  }
  const topWeakness = [...weaknessSectionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const mainCoachingFocus = topWeakness ? topWeakness[0] : "No consistent gap this week";

  const stats = {
    callsAnalyzed: recent.length,
    highIntentOpportunities: highIntent,
    missedCloseOpportunities: missedClose,
    followUpsOverdue,
    mainObjection: topObjection ? titleCase(topObjection[0]) : "None",
    averageScore,
    mainCoachingFocus,
  };

  const executiveSummary = await buildExecutiveSummary(stats);

  return { ...stats, executiveSummary };
}

async function buildExecutiveSummary(stats: {
  callsAnalyzed: number;
  highIntentOpportunities: number;
  missedCloseOpportunities: number;
  followUpsOverdue: number;
  mainObjection: string;
  averageScore: number;
  mainCoachingFocus: string;
}): Promise<string> {
  const fallback = [
    `${stats.callsAnalyzed} sales call${stats.callsAnalyzed === 1 ? " was" : "s were"} analyzed this week.`,
    stats.highIntentOpportunities
      ? `${stats.highIntentOpportunities} opportunit${stats.highIntentOpportunities === 1 ? "y" : "ies"} showed high buying intent.`
      : "No opportunities showed standout buying intent this week.",
    stats.missedCloseOpportunities
      ? `${stats.missedCloseOpportunities} of those left the conversation without a firm next step.`
      : "Closing attempts were made consistently where intent was high.",
    `${stats.mainObjection} remained the primary objection, with an average call score of ${stats.averageScore}/100.`,
    stats.followUpsOverdue
      ? `Immediate follow-up is recommended on ${stats.followUpsOverdue} open opportunit${stats.followUpsOverdue === 1 ? "y" : "ies"}.`
      : `Coaching focus for the week: ${stats.mainCoachingFocus}.`,
  ].join(" ");

  if (!isAnthropicConfigured()) return fallback;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system:
        "You write a 5-sentence-maximum executive sales summary for a founder, from aggregate numbers only. No transcript access, no invented facts — use only the numbers given. Plain prose, no markdown.",
      messages: [{ role: "user", content: `Write the weekly founder brief summary from this data:\n${JSON.stringify(stats, null, 2)}` }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text.trim() : fallback;
  } catch {
    return fallback;
  }
}

export interface OpenOpportunityValue {
  totalOpenValue: number;
  requiresAttentionValue: number;
}

// Open Opportunity Value (Section 12) — sums HubSpot deal amounts already stored on
// open deals. "Requires Attention" is a strict subset per the spec's own definition;
// never labeled "revenue at risk" since that implies a stronger causal claim than
// these simple rules can support.
export async function getOpenOpportunityValue(): Promise<OpenOpportunityValue> {
  const calls = await getCalls();
  const openCalls = calls.filter((c) => c.deal?.status === "open" && c.deal.amount != null);

  let totalOpenValue = 0;
  let requiresAttentionValue = 0;
  const seenDeals = new Set<string>();

  for (const c of openCalls) {
    const dealId = c.deal!.id;
    if (seenDeals.has(dealId)) continue;
    seenDeals.add(dealId);
    const amount = c.deal!.amount ?? 0;
    totalOpenValue += amount;

    if (requiresAttention(c)) requiresAttentionValue += amount;
  }

  return { totalOpenValue, requiresAttentionValue };
}

function requiresAttention(call: CallWithRelations): boolean {
  if (hotLeadNeedsAction(call)) return true;
  if (detectMissedRevenueOpportunity(call).flagged) return true;
  const followUpQuality = (call.analysis?.follow_up_assessment as { quality?: string } | null)?.quality;
  if (call.deal?.status === "open" && followUpQuality !== "clear") return true;
  if (getDealRisk(call).level === "High") return true;
  return false;
}

function titleCase(s: string): string {
  return s.split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
