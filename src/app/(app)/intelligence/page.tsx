import { getCalls } from "@/lib/data/calls";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

export default async function IntelligencePage() {
  const calls = await getCalls();
  const analyzed = calls.filter((c) => c.analysis);
  const won = analyzed.filter((c) => c.deal?.status === "closed_won");
  const lost = analyzed.filter((c) => c.deal?.status === "closed_lost");

  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
  const sectionAvg = (group: typeof calls, section: string) => {
    const values = group
      .flatMap((c) => c.analysis?.criterion_scores ?? [])
      .filter((cs) => cs.section_name === section)
      .map((cs) => (cs.max_score ? ((cs.score ?? 0) / cs.max_score) * 100 : 0));
    return avg(values);
  };

  const sections = ["Discovery", "Value Presentation", "Objection Handling", "Closing", "Follow-Up Discipline"];

  const objectionFreq = (group: typeof calls) => {
    const counts = new Map<string, number>();
    for (const c of group) for (const o of c.analysis?.objections ?? []) counts.set(o.objection_type ?? "other", (counts.get(o.objection_type ?? "other") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  const missedFreq = (group: typeof calls) => {
    const counts = new Map<string, number>();
    for (const c of group) for (const m of c.analysis?.missed_opportunities ?? []) counts.set(m.category ?? "other", (counts.get(m.category ?? "other") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Revenue Intelligence</h1>
        <p className="text-sm text-muted">
          Comparing call behavior against HubSpot deal outcomes. These are <strong>correlations</strong> observed in
          this dataset, not proven causes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Won vs Lost — process quality</CardTitle>
          <CardDescription>Section scores are process quality signals, independent of the eventual outcome.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">Metric</th>
                <th className="py-2">Won ({won.length})</th>
                <th className="py-2">Lost ({lost.length})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2">Overall score</td>
                <td className="py-2 font-medium">{avg(won.map((c) => c.analysis?.overall_score ?? 0))}</td>
                <td className="py-2 font-medium">{avg(lost.map((c) => c.analysis?.overall_score ?? 0))}</td>
              </tr>
              {sections.map((s) => (
                <tr key={s}>
                  <td className="py-2">{s}</td>
                  <td className="py-2 font-medium">{sectionAvg(won, s)}%</td>
                  <td className="py-2 font-medium">{sectionAvg(lost, s)}%</td>
                </tr>
              ))}
              <tr>
                <td className="py-2">Avg call duration</td>
                <td className="py-2 font-medium">{formatDuration(Math.round(avg(won.map((c) => c.duration_seconds ?? 0))))}</td>
                <td className="py-2 font-medium">{formatDuration(Math.round(avg(lost.map((c) => c.duration_seconds ?? 0))))}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most common objections — Lost deals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {objectionFreq(lost).map(([type, count]) => (
                <li key={type} className="flex justify-between">
                  <span className="capitalize">{type}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
              {objectionFreq(lost).length === 0 && <li className="text-muted">No data yet.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most frequent missed opportunities — Lost deals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {missedFreq(lost).map(([cat, count]) => (
                <li key={cat} className="flex justify-between">
                  <span className="capitalize">{cat}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
              {missedFreq(lost).length === 0 && <li className="text-muted">No data yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-accent/30 bg-accent-soft/20">
        <CardContent className="py-4 text-xs text-foreground/70">
          <strong>Note on correlation vs. causation:</strong> a section scoring lower in lost deals suggests a
          pattern worth coaching against, but deals are lost and won for many reasons outside the call itself
          (budget reality, timing, competitor availability). Use this view to guide coaching priorities, not as
          proof that a single behavior determines outcomes.
        </CardContent>
      </Card>
    </div>
  );
}
