import Link from "next/link";
import { getDashboardMetrics } from "@/lib/data/dashboard";
import { getFounderSnapshot, getWeeklyFounderBrief, getOpenOpportunityValue } from "@/lib/data/founder";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ScoreOverTimeChart, ObjectionsBarChart } from "@/components/dashboard/charts";
import { FounderSnapshotCard } from "@/components/dashboard/founder-snapshot";
import { HotLeadsSection } from "@/components/dashboard/hot-leads-section";
import { WeeklyBrief } from "@/components/dashboard/weekly-brief";
import { CallBadges } from "@/components/calls/call-badges";
import { DemoDataTag } from "@/components/layout/demo-data-tag";
import { getCallBadges } from "@/lib/rules/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";

export default async function DashboardPage() {
  const [metrics, snapshot, brief, opportunityValue] = await Promise.all([
    getDashboardMetrics(),
    getFounderSnapshot(),
    getWeeklyFounderBrief(),
    getOpenOpportunityValue(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted">The sales operation, understandable in under 30 seconds.</p>
        </div>
        <DemoDataTag />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label="Calls Analyzed" value={metrics.callsAnalyzed} />
        <StatTile label="Hot Leads" value={metrics.hotLeadsCount} tone={metrics.hotLeadsCount > 0 ? "warn" : "neutral"} />
        <StatTile label="Missed Revenue Opportunities" value={metrics.missedRevenueCount} tone={metrics.missedRevenueCount > 0 ? "bad" : "neutral"} />
        <StatTile label="Follow-Ups Due" value={metrics.followUpsDueCount} tone={metrics.followUpsDueCount > 0 ? "warn" : "neutral"} />
        <StatTile
          label="Open Opportunity Value"
          value={formatCurrency(opportunityValue.totalOpenValue)}
          hint={opportunityValue.requiresAttentionValue > 0 ? `${formatCurrency(opportunityValue.requiresAttentionValue)} requires attention` : undefined}
        />
      </div>

      <FounderSnapshotCard snapshot={snapshot} />
      <HotLeadsSection hotLeads={metrics.hotLeads} />
      <WeeklyBrief brief={brief} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Call Score Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreOverTimeChart data={metrics.scoreOverTime} />
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {metrics.recentCalls.map((c) => (
              <li key={c.id}>
                <Link href={`/calls/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-black/[0.02]">
                  <div>
                    <div className="text-sm font-medium">
                      {c.contact?.firstname} {c.contact?.lastname}
                    </div>
                    <div className="text-xs text-muted">
                      {formatDate(c.started_at)} • {c.deal?.deal_name ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CallBadges badges={getCallBadges(c)} />
                    {c.analysis?.overall_score != null && (
                      <span className="text-sm font-medium text-muted">{c.analysis.overall_score}/100</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
