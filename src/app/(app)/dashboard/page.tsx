import Link from "next/link";
import { getDashboardMetrics } from "@/lib/data/dashboard";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  ScoreOverTimeChart,
  CategoryBarChart,
  ObjectionsBarChart,
  WonVsLostChart,
  DistributionBarChart,
} from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">Revenue and coaching intelligence across all analyzed calls.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Calls Analyzed" value={metrics.callsAnalyzed} />
        <StatTile label="Average Score" value={`${metrics.averageScore}/100`} tone={metrics.averageScore >= 70 ? "good" : "warn"} />
        <StatTile label="Open Opportunities" value={metrics.openOpportunities} />
        <StatTile label="Conversion Rate" value={`${metrics.conversionRate}%`} />
        <StatTile label="Closed Won" value={metrics.closedWon} tone="good" />
        <StatTile label="Closed Lost" value={metrics.closedLost} tone="bad" />
        <StatTile
          label="Calls Needing Attention"
          value={metrics.callsRequiringAttention}
          tone={metrics.callsRequiringAttention > 0 ? "warn" : "neutral"}
        />
        <StatTile
          label="AI Close Likelihood"
          value={`${metrics.averageCloseProbability}%`}
          hint="AI estimate, not a guarantee"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Score Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreOverTimeChart data={metrics.scoreOverTime} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Score by Scorecard Category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={metrics.scoreByCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Objections</CardTitle>
          </CardHeader>
          <CardContent>
            <ObjectionsBarChart data={metrics.topObjections.map((o) => ({ ...o, type: titleCase(o.type) }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Won vs Lost — Avg Call Score</CardTitle>
          </CardHeader>
          <CardContent>
            <WonVsLostChart data={metrics.wonVsLostScore} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI Close Likelihood Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionBarChart data={metrics.closeProbabilityDistribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Follow-Up Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.followUpCompliance.map((f) => (
                <div key={f.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{f.label}</span>
                  <span className="font-medium">{f.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calls Needing Attention</CardTitle>
          <CardDescription>Deterministic rules flag these for manager review.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {metrics.attentionCalls.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted">Nothing needs attention right now.</div>
          ) : (
            <ul className="divide-y divide-border">
              {metrics.attentionCalls.map((c) => (
                <li key={c.id}>
                  <Link href={`/calls/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-black/[0.02]">
                    <div>
                      <div className="text-sm font-medium">
                        {c.contact?.firstname} {c.contact?.lastname}
                      </div>
                      <div className="text-xs text-muted">
                        {c.deal?.deal_name} • {formatDate(c.started_at)} • {formatCurrency(c.deal?.amount)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={c.deal?.status === "closed_lost" ? "bad" : "warn"}>
                        {c.analysis?.overall_score ?? "—"}/100
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
