import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CallAnalysisFull } from "@/types/db";

export function CoachingTab({ analysis }: { analysis: CallAnalysisFull }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h4 className="mb-2 text-sm font-semibold text-good">What went well</h4>
          <ul className="space-y-2 text-sm text-foreground/80">
            {analysis.strengths?.length ? (
              analysis.strengths.map((s, i) => <li key={i}>• {s}</li>)
            ) : (
              <li className="text-muted">None recorded.</li>
            )}
          </ul>
        </Card>
        <Card className="p-5">
          <h4 className="mb-2 text-sm font-semibold text-bad">What should improve</h4>
          <ul className="space-y-2 text-sm text-foreground/80">
            {analysis.weaknesses?.length ? (
              analysis.weaknesses.map((s, i) => <li key={i}>• {s}</li>)
            ) : (
              <li className="text-muted">None recorded.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h4 className="mb-3 text-sm font-semibold">Missed opportunities</h4>
        {analysis.missed_opportunities.length === 0 ? (
          <p className="text-sm text-muted">None identified.</p>
        ) : (
          <div className="space-y-3">
            {analysis.missed_opportunities.map((m) => (
              <div key={m.id} className="rounded-lg bg-black/[0.02] p-3 text-sm">
                <Badge tone="accent" className="mb-1.5">
                  {m.category}
                </Badge>
                <p className="text-foreground/80">{m.description}</p>
                <p className="mt-1 text-xs text-muted">Suggested practice: {m.recommended_action}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h4 className="mb-3 text-sm font-semibold">Coaching recommendations</h4>
        <div className="space-y-3">
          {analysis.coaching_insights.map((c) => (
            <div key={c.id} className="rounded-lg bg-black/[0.02] p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <Badge tone={c.strength_or_weakness === "strength" ? "good" : "warn"}>{c.category}</Badge>
              </div>
              <p className="text-foreground/80">{c.insight}</p>
              <p className="mt-1 text-xs font-medium text-accent">Suggested phrasing / practice: {c.recommendation}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-accent/40 bg-accent-soft/30 p-5">
        <h4 className="mb-1 text-sm font-semibold text-accent">Manager summary</h4>
        <p className="text-sm text-foreground/80">{analysis.manager_summary}</p>
      </Card>
    </div>
  );
}
