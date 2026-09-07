import type { CallWithRelations } from "@/types/db";
import { detectMissedRevenueOpportunity } from "./missed-revenue";

export type DealRiskLevel = "Low" | "Medium" | "High";

export interface DealRiskResult {
  level: DealRiskLevel;
  reason: string;
}

// Deal Risk (Section 7): deliberately separate from call quality — a great call can
// still sit on a risky deal. Score is a simple point count against clear, readable
// factors (objection severity, buying intent, follow-up status, a missed close,
// decision-maker uncertainty, budget mismatch), NOT a black-box model. Claude's own
// dealRiskFactors are used only to phrase the human-readable reason — the
// Low/Medium/High label itself always comes from this function.
//
// Note: "does a next_action row exist" is NOT used as a risk signal — the pipeline
// always attaches an AI-suggested next action even when the rep secured nothing with
// the client, so that alone says nothing about real risk. Whether a next step was
// actually confirmed with the client comes from follow_up_assessment instead.
export function getDealRisk(call: CallWithRelations): DealRiskResult {
  const a = call.analysis;
  const deal = call.deal;
  if (!a || !deal || deal.status !== "open") {
    return { level: "Low", reason: "Deal is not open, so there is no active risk to track." };
  }

  let points = 0;
  const reasons: string[] = [];

  const highSeverityUnresolved = a.objections.filter((o) => o.severity === "high" && !o.handled);
  if (highSeverityUnresolved.length) {
    points += 2;
    reasons.push(`an unresolved ${highSeverityUnresolved[0].objection_type ?? "high-severity"} objection`);
  } else if (a.objections.some((o) => o.severity === "medium" && !o.handled)) {
    points += 1;
    reasons.push("a medium-severity objection that wasn't fully resolved");
  }

  if (a.buying_intent === "low") {
    points += 1;
    reasons.push("low buying intent");
  }

  if (detectMissedRevenueOpportunity(call).flagged) {
    points += 2;
    reasons.push("a missed closing attempt despite buying signals");
  }

  const followUp = a.follow_up_assessment as { hasScheduledFollowUp?: boolean; quality?: string } | null;
  if (followUp?.hasScheduledFollowUp === false) {
    points += 2;
    reasons.push("no follow-up scheduled with the client");
  } else if (followUp?.quality === "vague") {
    points += 1;
    reasons.push("a vague follow-up commitment");
  }

  const decisionMakerUncertain = a.objections.some((o) => (o.objection_type ?? "").toLowerCase().includes("partner"));
  if (decisionMakerUncertain) {
    points += 1;
    reasons.push("uncertainty about the decision-maker (needs partner/family approval)");
  }

  const budgetMismatch = a.deal_risk_factors?.some((f) => f.toLowerCase().includes("budget")) ?? false;
  if (budgetMismatch) {
    points += 1;
    reasons.push("a possible budget mismatch");
  }

  const level: DealRiskLevel = points >= 4 ? "High" : points >= 2 ? "Medium" : "Low";
  const reason = reasons.length
    ? `${reasons.slice(0, 2).join(" and ")}.`.replace(/^./, (c) => c.toUpperCase())
    : "No significant risk factors detected on this call.";

  return { level, reason };
}
