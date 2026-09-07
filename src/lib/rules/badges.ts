import type { CallWithRelations } from "@/types/db";
import { isHotLead } from "./hot-lead";
import { detectMissedRevenueOpportunity } from "./missed-revenue";

export const CALL_BADGES = ["Strong Call", "High Intent", "At Risk", "Needs Coaching", "Missed Close", "Follow-Up Required"] as const;
export type CallBadge = (typeof CALL_BADGES)[number];

// Call Quality Badges (Section 6): a call can carry multiple badges. Rules are
// intentionally simple and read directly off already-stored analysis fields — no new
// scoring model.
export function getCallBadges(call: CallWithRelations): CallBadge[] {
  const a = call.analysis;
  if (!a) return [];
  const badges: CallBadge[] = [];

  if ((a.overall_score ?? 0) >= 80) badges.push("Strong Call");
  if (isHotLead(call)) badges.push("High Intent");

  const unresolvedHighSeverity = a.objections.some((o) => o.severity === "high" && !o.handled);
  const followUpQuality = (a.follow_up_assessment as { quality?: string } | null)?.quality;
  if (unresolvedHighSeverity || followUpQuality === "missing") badges.push("At Risk");

  if ((a.overall_score ?? 100) < 60) badges.push("Needs Coaching");

  if (detectMissedRevenueOpportunity(call).flagged) badges.push("Missed Close");

  const hasOpenNextAction = a.next_actions.some((n) => !n.completed);
  if (!hasOpenNextAction && call.deal?.status === "open") badges.push("Follow-Up Required");

  return badges;
}
