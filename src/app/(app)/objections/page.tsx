import Link from "next/link";
import { getObjectionIntelligence } from "@/lib/data/objections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate, titleCase } from "@/lib/utils";

export default async function ObjectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: selectedType } = await searchParams;
  const objections = await getObjectionIntelligence();
  const selected = selectedType ? objections.find((o) => o.type === selectedType) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Objection Intelligence</h1>
        <p className="text-sm text-muted">Aggregated objection patterns across all analyzed calls.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Objection frequency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {objections.map((o) => (
            <Link
              key={o.type}
              href={`/objections?type=${encodeURIComponent(o.type)}`}
              className="block rounded-lg p-2 hover:bg-black/[0.02]"
            >
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{titleCase(o.type)}</span>
                <span className="text-muted">
                  {o.sharePercent}% • {o.count} calls
                </span>
              </div>
              <ProgressBar percent={o.sharePercent} />
              <div className="mt-1 flex gap-3 text-xs text-muted">
                <span>Handled well: {o.handledRate}%</span>
                <span>Won: {o.wonCount}</span>
                <span>Lost: {o.lostCount}</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Calls with &ldquo;{titleCase(selected.type)}&rdquo; objection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selected.calls.map((c) => (
              <Link
                key={c.id}
                href={`/calls/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-black/[0.02]"
              >
                <div>
                  <div className="font-medium">
                    {c.contact?.firstname} {c.contact?.lastname}
                  </div>
                  <div className="text-xs text-muted">{formatDate(c.started_at)}</div>
                </div>
                <Badge tone={c.deal?.status === "closed_won" ? "good" : c.deal?.status === "closed_lost" ? "bad" : "neutral"}>
                  {titleCase(c.deal?.status ?? "open")}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
