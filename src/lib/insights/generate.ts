// Shared, deterministic generators for founder-facing text that doesn't need a fresh
// Claude call every time: used by the demo heuristic fallback (no ANTHROPIC_API_KEY)
// and to backfill the seeded demo dataset. The real Claude pipeline generates its own
// versions of this text per call (see services/anthropic/prompt.ts); these exist so
// the app looks and behaves consistently even when nothing here came from a live model.

export interface FollowUpMessageInput {
  contactFirstName: string | null;
  repName: string | null;
  nextActionSummary: string;
}

export function buildFollowUpMessages({ contactFirstName, repName, nextActionSummary }: FollowUpMessageInput): {
  sms: string;
  email: string;
} {
  const name = contactFirstName || "there";
  const rep = repName || "Federico";
  return {
    sms: `Hi ${name}, it was great speaking with you today! ${nextActionSummary} Let me know if anything comes up in the meantime. — ${rep}, Elite Marry Me`,
    email: `Hi ${name},\n\nIt was wonderful speaking with you today about your event. ${nextActionSummary}\n\nHappy to answer any questions in the meantime.\n\nWarmly,\n${rep}\nElite Marry Me`,
  };
}

export interface WhyThisMattersInput {
  buyingIntent: "low" | "medium" | "high";
  dealOpen: boolean;
  hasClearNextStep: boolean;
  dealAmount: number | null;
  missedClose: boolean;
}

export function buildWhyThisMatters({ buyingIntent, dealOpen, hasClearNextStep, dealAmount, missedClose }: WhyThisMattersInput): string {
  const value = dealAmount ? ` worth $${dealAmount.toLocaleString()}` : "";
  if (missedClose) {
    return `This client showed clear buying intent but left the call without a committed next step. Fast follow-up could prevent a${value} opportunity from going cold.`;
  }
  if (buyingIntent === "high" && dealOpen && hasClearNextStep) {
    return `This is a high-intent, well-handled opportunity${value} with a clear next step already scheduled — prioritize keeping the momentum going.`;
  }
  if (buyingIntent === "high" && dealOpen && !hasClearNextStep) {
    return `Buying intent is high on this${value} opportunity, but there's no confirmed next step — a quick follow-up now meaningfully changes the odds of closing.`;
  }
  if (!dealOpen) {
    return `This deal is already closed, so the main value here is coaching signal for future calls rather than immediate revenue risk.`;
  }
  return `This call shows moderate interest with no urgent risk, but a clear next step still keeps the deal moving rather than going quiet.`;
}
