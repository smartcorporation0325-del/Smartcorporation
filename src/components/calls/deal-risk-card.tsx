import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DealRiskResult } from "@/lib/rules/deal-risk";

const TONE = { Low: "good", Medium: "warn", High: "bad" } as const;

export function DealRiskCard({ overallScore, risk }: { overallScore: number | null; risk: DealRiskResult }) {
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Call Quality</div>
          <div className="mt-1 text-2xl font-semibold">{overallScore ?? "—"}/100</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Deal Risk</div>
          <div className="mt-1">
            <Badge tone={TONE[risk.level]} className="text-sm">
              {risk.level}
            </Badge>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        <span className="font-medium text-foreground/70">Reason: </span>
        {risk.reason}
      </p>
    </Card>
  );
}
