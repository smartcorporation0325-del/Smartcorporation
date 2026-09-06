import Link from "next/link";
import { getCalls } from "@/lib/data/calls";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { CallWithRelations } from "@/types/db";

interface DerivedAlert {
  ruleKey: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  call: CallWithRelations;
}

function deriveAlerts(calls: CallWithRelations[]): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  for (const c of calls) {
    const a = c.analysis;
    if (!a || !c.deal) continue;
    const name = `${c.contact?.firstname ?? ""} ${c.contact?.lastname ?? ""}`.trim();
    const hasOpenNextAction = a.next_actions.some((n) => !n.completed);

    if (c.deal.status === "open" && (a.close_probability ?? 0) >= 75 && !hasOpenNextAction) {
      alerts.push({
        ruleKey: "HOT_LEAD",
        title: `Hot lead, no clear next action — ${name}`,
        description: `AI close likelihood ${a.close_probability}% but no open next action is recorded.`,
        severity: "warning",
        call: c,
      });
    }
    const closingSection = a.criterion_scores.find((cs) => cs.section_name === "Closing");
    if (
      a.buying_signals.length > 0 &&
      closingSection &&
      (closingSection.max_score ?? 0) > 0 &&
      (closingSection.score ?? 0) / (closingSection.max_score ?? 1) < 0.5
    ) {
      alerts.push({
        ruleKey: "CLOSING_OPPORTUNITY_MISSED",
        title: `Closing opportunity missed — ${name}`,
        description: "Strong buying signal detected but closing score is below threshold.",
        severity: "warning",
        call: c,
      });
    }
    if (c.deal.status === "open" && a.follow_up_assessment && (a.follow_up_assessment as { quality?: string }).quality !== "clear") {
      alerts.push({
        ruleKey: "FOLLOW_UP_OVERDUE",
        title: `Follow-up unclear or overdue — ${name}`,
        description: "Follow-up commitment on this call was vague or missing.",
        severity: "info",
        call: c,
      });
    }
    if (a.objections.some((o) => o.severity === "high" && !o.handled)) {
      alerts.push({
        ruleKey: "PRICE_RISK",
        title: `Unresolved high-severity objection — ${name}`,
        description: "A high-severity objection was raised and not clearly resolved.",
        severity: "critical",
        call: c,
      });
    }
    if ((c.deal.amount ?? 0) >= 6000 && (a.overall_score ?? 100) < 60) {
      alerts.push({
        ruleKey: "HIGH_VALUE_RISK",
        title: `High-value deal, low call score — ${name}`,
        description: `Deal worth $${c.deal.amount} scored ${a.overall_score}/100.`,
        severity: "critical",
        call: c,
      });
    }
  }
  return alerts.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
}

function severityWeight(s: string) {
  return s === "critical" ? 3 : s === "warning" ? 2 : 1;
}

export default async function AlertsPage() {
  const calls = await getCalls();
  const alerts = deriveAlerts(calls);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="text-sm text-muted">Deterministic rules evaluated against every analyzed call.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active alerts ({alerts.length})</CardTitle>
          <CardDescription>
            Rules: Hot Lead, Closing Opportunity Missed, Stale Opportunity, Follow-Up Overdue, Price Risk, High Value Risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-0">
          {alerts.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted">No active alerts.</div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link href={`/calls/${a.call.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-black/[0.02]">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Badge tone={a.severity === "critical" ? "bad" : a.severity === "warning" ? "warn" : "neutral"}>
                          {a.ruleKey.replace(/_/g, " ")}
                        </Badge>
                        {a.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {a.description} • {formatDate(a.call.started_at)}
                      </div>
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
