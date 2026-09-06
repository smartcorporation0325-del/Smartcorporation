import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  icon?: ReactNode;
}) {
  const toneClass = {
    neutral: "text-foreground",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
  }[tone];

  return (
    <Card className="px-4 py-4">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
        {icon}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}
