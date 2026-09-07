import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SuggestedFollowUp } from "@/components/calls/suggested-follow-up";
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
          {analysis.buying_intent && (
            <Badge tone={analysis.buying_intent === "high" ? "good" : analysis.buying_intent === "medium" ? "warn" : "neutral"}>
              Buying Intent: {titleCase(analysis.buying_intent)}
            </Badge>
          )}
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
        <h4 className="mb-3 text-sm font-semibold">Smart Next Action</h4>
        {analysis.next_actions.length === 0 ? (
          <p className="text-sm text-muted">No next actions recorded.</p>
        ) : (
          <ul className="space-y-3">
            {analysis.next_actions.map((n) => (
              <li key={n.id} className="rounded-lg bg-black/[0.02] p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {n.action_type && <Badge tone="accent">{titleCase(n.action_type)}</Badge>}
                  {n.priority && <Badge tone={n.priority === "high" ? "bad" : n.priority === "medium" ? "warn" : "neutral"}>{titleCase(n.priority)} priority</Badge>}
                  <span className="text-xs text-muted">
                    {n.owner}
                    {n.due_date ? ` • due ${n.due_date.slice(0, 10)}` : ""}
                    {n.due_time ? ` ${n.due_time}` : ""}
                  </span>
                </div>
                <p className="text-foreground/80">{n.action}</p>
                {n.close_strategy && (
                  <p className="mt-1.5 border-l-2 border-accent pl-2 text-xs text-muted">
                    <span className="font-medium text-accent">Close strategy: </span>
                    {n.close_strategy}
                  </p>
                )}
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

      <SuggestedFollowUp sms={analysis.follow_up_sms} email={analysis.follow_up_email} />
    </div>
  );
}
