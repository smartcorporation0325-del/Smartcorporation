import { notFound } from "next/navigation";
import { getCallById } from "@/lib/data/calls";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/calls/overview-tab";
import { ScorecardTab } from "@/components/calls/scorecard-tab";
import { TranscriptTab } from "@/components/calls/transcript-tab";
import { ObjectionsTab } from "@/components/calls/objections-tab";
import { CoachingTab } from "@/components/calls/coaching-tab";
import { CrmContextTab } from "@/components/calls/crm-context-tab";
import { ManualActions } from "@/components/calls/manual-actions";
import { CallBadges } from "@/components/calls/call-badges";
import { DealRiskCard } from "@/components/calls/deal-risk-card";
import { WhyThisMatters } from "@/components/calls/why-this-matters";
import { MissedRevenueFlag } from "@/components/calls/missed-revenue-flag";
import { DemoDataTag } from "@/components/layout/demo-data-tag";
import { getCallBadges } from "@/lib/rules/badges";
import { getDealRisk } from "@/lib/rules/deal-risk";
import { detectMissedRevenueOpportunity } from "@/lib/rules/missed-revenue";
import { formatCurrency, formatDate, formatDuration, titleCase } from "@/lib/utils";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await getCallById(id);
  if (!call) notFound();

  const a = call.analysis;
  const badges = getCallBadges(call);
  const dealRisk = getDealRisk(call);
  const missedRevenue = detectMissedRevenueOpportunity(call);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-lg font-semibold">
                {call.contact?.firstname} {call.contact?.lastname}
              </h1>
              <DemoDataTag />
            </div>
            <p className="text-sm text-muted">
              {call.sales_rep?.name ?? "Unassigned"} • {formatDate(call.started_at)} • {formatDuration(call.duration_seconds)} •{" "}
              {call.call_type}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {a?.overall_score != null && (
              <Badge tone={a.overall_score >= 75 ? "good" : a.overall_score >= 55 ? "warn" : "bad"}>
                Score {a.overall_score}/100
              </Badge>
            )}
            {a?.close_probability != null && <Badge tone="accent">AI Close Likelihood {a.close_probability}%</Badge>}
            {a?.call_outcome && <Badge tone="neutral">{titleCase(a.call_outcome)}</Badge>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm md:grid-cols-4">
          <div>
            <div className="text-xs text-muted">Deal</div>
            <div className="font-medium">{call.deal?.deal_name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Stage</div>
            <div className="font-medium">{call.deal?.stage ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Deal Value</div>
            <div className="font-medium">{formatCurrency(call.deal?.amount)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Analysis Status</div>
            <div className="font-medium">{titleCase(call.analysis_status)}</div>
          </div>
        </div>
        {badges.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <CallBadges badges={badges} />
          </div>
        )}
      </div>

      {a && <WhyThisMatters text={a.why_this_matters} />}
      {missedRevenue.flagged && <MissedRevenueFlag result={missedRevenue} />}
      {a && call.deal?.status === "open" && <DealRiskCard overallScore={a.overall_score} risk={dealRisk} />}

      <ManualActions callId={call.id} hasTranscript={Boolean(call.transcript?.transcript_text)} />

      {call.analysis_status === "failed" && (
        <div className="rounded-xl border border-bad/30 bg-bad/5 p-4 text-sm text-bad">
          Analysis failed: {call.analysis_error ?? "Unknown error."} You can retry above once a transcript is available.
        </div>
      )}

      {a ? (
        <Tabs
          tabs={[
            { key: "overview", label: "Overview", content: <OverviewTab analysis={a} /> },
            { key: "scorecard", label: "Scorecard", content: <ScorecardTab criterionScores={a.criterion_scores} overallScore={a.overall_score} /> },
            { key: "transcript", label: "Transcript", content: <TranscriptTab transcriptText={call.transcript?.transcript_text ?? null} /> },
            { key: "objections", label: "Objections", content: <ObjectionsTab objections={a.objections} /> },
            { key: "coaching", label: "Coaching", content: <CoachingTab analysis={a} /> },
            { key: "crm", label: "CRM Context", content: <CrmContextTab call={call} /> },
          ]}
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          No analysis yet. {call.transcript?.transcript_text ? "Run analysis above." : "Paste a transcript above to get started."}
        </div>
      )}
    </div>
  );
}
