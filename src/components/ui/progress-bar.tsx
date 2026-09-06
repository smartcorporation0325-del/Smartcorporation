import { cn } from "@/lib/utils";
import { scoreTone } from "@/lib/utils";

const toneBg = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" } as const;

export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const tone = scoreTone(percent);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-black/5", className)}>
      <div
        className={cn("h-full rounded-full transition-all", toneBg[tone])}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}
