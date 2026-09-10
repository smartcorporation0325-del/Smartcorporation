import { Expandable } from "@/components/ui/expandable";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { scoreTone } from "@/lib/utils";
import type { CriterionScore } from "@/types/db";

export function ScorecardTab({ criterionScores, overallScore }: { criterionScores: CriterionScore[]; overallScore: number | null }) {
  const sections = new Map<string, CriterionScore[]>();
  for (const cs of criterionScores) {
    const key = cs.section_name ?? "Other";
    const arr = sections.get(key) ?? [];
    arr.push(cs);
    sections.set(key, arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-3xl font-semibold">{overallScore ?? "—"}</div>
        <div className="text-sm text-muted">/ 100 overall</div>
      </div>
      <div className="space-y-4">
        {[...sections.entries()].map(([sectionName, scores]) => (
          <div key={sectionName} className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-3 text-sm font-semibold">{sectionName}</div>
            <div className="px-5 pt-2">
              {scores.map((cs) => {
                const pct = cs.max_score ? ((cs.score ?? 0) / cs.max_score) * 100 : 0;
                return (
                  <Expandable
                    key={cs.id}
                    trigger={
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <span className="text-sm font-medium">{cs.criterion_name ?? sectionName}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-28">
                            <ProgressBar percent={pct} />
                          </div>
                          <Badge tone={scoreTone(pct) === "good" ? "good" : scoreTone(pct) === "warn" ? "warn" : "bad"}>
                            {cs.score} / {cs.max_score}
                          </Badge>
                        </div>
                      </div>
                    }
                  >
                    <div className="space-y-2 rounded-lg bg-black/[0.02] p-3 text-sm">
                      <p className="text-foreground/80">{cs.explanation}</p>
                      {cs.evidence && (
                        <p className="border-l-2 border-accent pl-3 text-xs italic text-muted">&ldquo;{cs.evidence}&rdquo;</p>
                      )}
                    </div>
                  </Expandable>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
