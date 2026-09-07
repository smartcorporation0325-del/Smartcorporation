import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { FounderSnapshot } from "@/lib/data/founder";

const ROWS: { key: keyof FounderSnapshot; label: string }[] = [
  { key: "biggestRisk", label: "Biggest Sales Risk" },
  { key: "bestOpportunity", label: "Best Opportunity" },
  { key: "mainObjection", label: "Main Objection" },
  { key: "coachingFocus", label: "Coaching Focus" },
];

export function FounderSnapshotCard({ snapshot }: { snapshot: FounderSnapshot }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Founder Snapshot</CardTitle>
        <CardDescription>The four things that matter most from this period&apos;s calls.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {ROWS.map((row) => (
          <div key={row.key} className="rounded-lg border border-border p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">{row.label}</div>
            <p className="text-sm text-foreground/80">{snapshot[row.key]}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
