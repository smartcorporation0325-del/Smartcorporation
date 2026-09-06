import { getActiveScorecardTemplate } from "@/lib/data/scorecard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ScorecardsSettingsPage() {
  const template = await getActiveScorecardTemplate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Scorecards</h1>
          <p className="text-sm text-muted">The active scorecard used for every new call analysis.</p>
        </div>
        <Badge tone="accent">v{template.version} • Active</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{template.name}</CardTitle>
          <CardDescription>{template.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {template.sections.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-4">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-sm font-semibold">{s.name}</h4>
                <Badge tone="neutral">Weight {s.weight}%</Badge>
              </div>
              <p className="mb-3 text-xs text-muted">{s.description}</p>
              <ul className="space-y-1.5 text-sm">
                {s.criteria.map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <span>{c.name}</span>
                    <span className="text-xs text-muted">max {c.maxScore}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
        Editing sections/weights, versioning, and duplicating scorecards is planned for a later iteration —
        historical analyses will always stay attached to the scorecard version they were scored against.
      </div>
    </div>
  );
}
