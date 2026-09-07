import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MissedRevenueResult } from "@/lib/rules/missed-revenue";

export function MissedRevenueFlag({ result }: { result: MissedRevenueResult }) {
  if (!result.flagged) return null;
  return (
    <Card className="border-bad/30 bg-bad/5 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Badge tone="bad">Missed Revenue Opportunity</Badge>
      </div>
      <p className="text-sm text-foreground/80">{result.explanation}</p>
    </Card>
  );
}
