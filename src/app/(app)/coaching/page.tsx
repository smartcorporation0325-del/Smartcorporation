import Link from "next/link";
import { getCoachingSummaries } from "@/lib/data/coaching";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default async function CoachingPage() {
  const summaries = await getCoachingSummaries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Coaching Center</h1>
        <p className="text-sm text-muted">Per-rep performance trends and this week&apos;s coaching focus.</p>
      </div>

      {summaries.map((s) => (
        <Card key={s.rep.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{s.rep.name}</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Overall score {s.overallScore}/100</p>
            </div>
            <Badge tone={s.trend === "up" ? "good" : s.trend === "down" ? "bad" : "neutral"}>
              {s.trend === "up" && <TrendingUp className="mr-1 inline h-3 w-3" />}
              {s.trend === "down" && <TrendingDown className="mr-1 inline h-3 w-3" />}
              {s.trend === "flat" && <Minus className="mr-1 inline h-3 w-3" />}
              {s.trend === "up" ? "Improving" : s.trend === "down" ? "Declining" : "Stable"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Object.entries(s.sectionAverages).map(([name, pct]) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">{name}</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <ProgressBar percent={pct} />
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-good/5 p-3 text-sm">
                <span className="font-medium text-good">Primary strength: </span>
                {s.primaryStrength}
              </div>
              <div className="rounded-lg bg-warn/5 p-3 text-sm">
                <span className="font-medium text-warn">Primary weakness: </span>
                {s.primaryWeakness}
              </div>
            </div>

            <div className="rounded-lg bg-accent-soft/40 p-4">
              <h4 className="mb-1 text-sm font-semibold text-accent">This week&apos;s coaching focus</h4>
              <p className="text-sm text-foreground/80">{s.recommendedTopic}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Strong example
                </h4>
                {s.strongExample && (
                  <Link
                    href={`/calls/${s.strongExample.id}`}
                    className="block rounded-lg border border-border p-3 text-sm hover:bg-black/[0.02]"
                  >
                    <div className="font-medium">
                      {s.strongExample.contact?.firstname} {s.strongExample.contact?.lastname}
                    </div>
                    <div className="text-xs text-muted">
                      {formatDate(s.strongExample.started_at)} • Score {s.strongExample.analysis?.overall_score}/100
                    </div>
                  </Link>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Calls to review this week
                </h4>
                <div className="space-y-2">
                  {s.callsToReview.map((c) => (
                    <Link
                      key={c.id}
                      href={`/calls/${c.id}`}
                      className="block rounded-lg border border-border p-3 text-sm hover:bg-black/[0.02]"
                    >
                      <div className="font-medium">
                        {c.contact?.firstname} {c.contact?.lastname}
                      </div>
                      <div className="text-xs text-muted">
                        {formatDate(c.started_at)} • Score {c.analysis?.overall_score}/100
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
              <span className="font-medium text-foreground">Suggested roleplay: </span>
              Practice the &ldquo;{s.primaryWeakness}&rdquo; scenario from the calls above, focused on{" "}
              {s.recommendedTopic.toLowerCase()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
