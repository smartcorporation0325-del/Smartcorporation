import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";
import type { Objection } from "@/types/db";

export function ObjectionsTab({ objections }: { objections: Objection[] }) {
  if (!objections.length) {
    return <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">No objections detected in this call.</div>;
  }
  return (
    <div className="space-y-4">
      {objections.map((o) => (
        <Card key={o.id} className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge tone="accent">{titleCase(o.objection_type ?? "objection")}</Badge>
              <Badge tone={o.severity === "high" ? "bad" : o.severity === "medium" ? "warn" : "neutral"}>
                {titleCase(o.severity ?? "")} severity
              </Badge>
              <Badge tone={o.handled ? "good" : "bad"}>{o.handled ? "Handled" : "Not resolved"}</Badge>
            </div>
            <div className="text-xs text-muted">Handling score: {o.handling_quality ?? "—"}/10</div>
          </div>
          <p className="mb-2 border-l-2 border-accent pl-3 text-sm italic text-foreground/80">&ldquo;{o.evidence}&rdquo;</p>
          <p className="mb-2 text-sm text-foreground/80">{o.objection_text}</p>
          <div className="rounded-lg bg-accent-soft/50 p-3 text-sm">
            <span className="font-medium text-accent">Recommended response: </span>
            {o.recommended_response}
          </div>
        </Card>
      ))}
    </div>
  );
}
