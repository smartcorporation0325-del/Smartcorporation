import type { CallWithRelations } from "@/types/db";

// Hot Lead (Section 2): buyingIntent = high OR multiple strong buying signals,
// AND the deal is still open. Deliberately simple and deterministic — no scoring model.
export function isHotLead(call: CallWithRelations): boolean {
  const a = call.analysis;
  if (!a || call.deal?.status !== "open") return false;
  const strongSignalCount = a.buying_signals.filter((b) => b.strength === "high").length;
  return a.buying_intent === "high" || strongSignalCount >= 2;
}

// "Action Required": a hot lead with no open next action.
export function hotLeadNeedsAction(call: CallWithRelations): boolean {
  if (!isHotLead(call)) return false;
  const a = call.analysis!;
  return !a.next_actions.some((n) => !n.completed);
}
