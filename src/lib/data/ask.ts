import { getCalls } from "./calls";
import { getSectionScore } from "@/lib/utils";
import type { CallWithRelations } from "@/types/db";

// Very small keyword-based retrieval layer (Section 17): pulls a bounded, relevant
// subset of calls based on the question text, rather than ever sending the whole
// dataset to Claude. This is intentionally simple heuristics, not a vector index —
// good enough for the call volumes this product deals with (dozens-hundreds, not
// millions of calls).
export async function retrieveRelevantCalls(question: string, limit = 12): Promise<CallWithRelations[]> {
  const calls = await getCalls();
  const q = question.toLowerCase();

  const scored = calls
    .filter((c) => c.analysis)
    .map((c) => {
      let score = 0;
      const a = c.analysis!;
      if (q.includes("won") && c.deal?.status === "closed_won") score += 3;
      if (q.includes("lost") && c.deal?.status === "closed_lost") score += 3;
      if (q.includes("federico") && c.sales_rep?.name?.toLowerCase() === "federico") score += 1;
      if (q.includes("price") && a.objections.some((o) => o.objection_type === "price")) score += 3;
      if (q.includes("partner") && a.objections.some((o) => o.objection_type?.includes("partner"))) score += 3;
      if (q.includes("closing") || q.includes("close")) {
        const closingSection = getSectionScore(a.criterion_scores, "Closing");
        if (closingSection && closingSection.pct < 60) score += 2;
      }
      if (q.includes("objection")) score += a.objections.length;
      if (q.includes("coach")) score += 1;
      if ((a.overall_score ?? 0) < 60 && (q.includes("coach") || q.includes("improve") || q.includes("weak"))) score += 2;
      if (q.includes("buying") || q.includes("intent")) score += a.buying_signals.length;
      return { call: c, score };
    })
    .sort((a, b) => b.score - a.score);

  const topScored = scored.filter((s) => s.score > 0).slice(0, limit);
  if (topScored.length > 0) return topScored.map((s) => s.call);

  // Fallback: most recent analyzed calls, so a generic question still gets grounded context.
  return calls
    .filter((c) => c.analysis)
    .sort((a, b) => new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime())
    .slice(0, limit);
}

export function summarizeCallsForPrompt(calls: CallWithRelations[]): string {
  return calls
    .map((c) => {
      const a = c.analysis!;
      return [
        `Call ${c.id} — ${c.contact?.firstname} ${c.contact?.lastname} — ${c.started_at?.slice(0, 10)}`,
        `  Rep: ${c.sales_rep?.name ?? "Unknown rep"} | Deal: ${c.deal?.deal_name ?? "N/A"} (${c.deal?.status ?? "open"}, $${c.deal?.amount ?? "?"})`,
        `  Score: ${a.overall_score}/100 | Outcome: ${a.call_outcome} | AI close likelihood: ${a.close_probability}%`,
        `  Objections: ${a.objections.map((o) => `${o.objection_type}${o.handled ? " (handled)" : " (unresolved)"}`).join(", ") || "none"}`,
        `  Buying signals: ${a.buying_signals.map((b) => b.type).join(", ") || "none"}`,
        `  Summary: ${a.summary}`,
      ].join("\n");
    })
    .join("\n\n");
}
