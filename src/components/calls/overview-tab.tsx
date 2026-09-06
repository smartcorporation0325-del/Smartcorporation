import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";
import type { CallAnalysisFull } from "@/types/db";

export function OverviewTab({ analysis }: { analysis: CallAnalysisFull }) {
  const followUp = analysis.follow_up_assessment as { hasScheduledFollowUp?: boolean; quality?: string; notes?: string } | null;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h4 className="mb-2 text-sm font-semibold">AI Summary</h4>
        <p className="text-sm text-foreground/80">{analysis.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="accent">Outcome: {titleCase(analysis.call_outcome ?? "unknown")}</Badge>
          <Badge tone="neutral">Sentiment: {titleCase(analysis.sentiment ?? "unknown")}</Badge>
        </div>
      </Card>

      <Card className="p-5">
        <h4 className="mb-2 text-sm font-semibold">Customer Intent</h4>
        <p className="text-sm text-foreground/80">{analysis.customer_intent}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h4 className="mb-3 text-sm font-semibold">Buying signals</h4>
          {analysis.buying_signals.length === 0 ? (
            <p className="text-sm text-muted">None detected.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.buying_signals.map((b) => (
                <li key={b.id} className="text-sm">
                  <Badge tone="good" className="mr-2">
                    {titleCase(b.strength ?? "")}
                  </Badge>
                  {b.type} — <span className="text-muted">{b.evidence}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h4 className="mb-3 text-sm font-semibold">Deal risk factors</h4>
          {(analysis.deal_risk_factors ?? []).length === 0 ? (
            <p className="text-sm text-muted">None identified.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-foreground/80">
              {analysis.deal_risk_factors!.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h4 className="mb-3 text-sm font-semibold">Next actions</h4>
        {analysis.next_actions.length === 0 ? (
          <p className="text-sm text-muted">No next actions recorded.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.next_actions.map((n) => (
              <li key={n.id} className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2 text-sm">
                <span>{n.action}</span>
                <span className="text-xs text-muted">
                  {n.owner} {n.due_date ? `• due ${n.due_date.slice(0, 10)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {followUp && (
          <div className="mt-3 rounded-lg bg-accent-soft/40 p-3 text-xs text-foreground/80">
            Follow-up quality: <strong>{titleCase(followUp.quality ?? "unknown")}</strong> — {followUp.notes}
          </div>
        )}
      </Card>
    </div>
  );
}
