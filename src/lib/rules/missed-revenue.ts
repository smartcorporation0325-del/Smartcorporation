import type { CallWithRelations } from "@/types/db";

const INTENT_KEYWORDS = ["availability", "deposit", "book", "reserve", "next step", "package", "location", "date"];

export interface MissedRevenueResult {
  flagged: boolean;
  explanation: string | null;
}

// Missed Revenue Opportunity (Section 3): strong buying intent + the customer asked
// about something actionable (availability/deposit/booking/next step/package/
// location) + the rep never made a meaningful closing attempt. We reuse the
// analysis's own "closing" missed_opportunities entry when present (it already cites
// evidence) rather than re-deriving one from scratch.
export function detectMissedRevenueOpportunity(call: CallWithRelations): MissedRevenueResult {
  const a = call.analysis;
  if (!a) return { flagged: false, explanation: null };

  const hasIntent = a.buying_intent === "high" || a.buying_intent === "medium" || a.buying_signals.length > 0;
  if (!hasIntent) return { flagged: false, explanation: null };

  const customerAskedSomethingActionable = a.buying_signals.some((b) =>
    INTENT_KEYWORDS.some((kw) => (b.evidence ?? "").toLowerCase().includes(kw) || (b.type ?? "").toLowerCase().includes(kw))
  );

  const closingSection = a.criterion_scores.find((cs) => cs.section_name === "Closing");
  const weakClosing = closingSection ? (closingSection.score ?? 0) / (closingSection.max_score || 1) < 0.55 : true;

  const closingMissedOpportunity = a.missed_opportunities.find((m) => m.category === "closing");

  const flagged = hasIntent && Boolean(closingMissedOpportunity) || (hasIntent && customerAskedSomethingActionable && weakClosing);
  if (!flagged) return { flagged: false, explanation: null };

  const explanation =
    closingMissedOpportunity?.description ??
    "The client showed buying intent, but no direct or conditional close was attempted before the call ended.";

  return { flagged: true, explanation };
}
