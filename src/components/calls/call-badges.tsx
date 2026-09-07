import { Badge } from "@/components/ui/badge";
import type { CallBadge } from "@/lib/rules/badges";

const BADGE_TONE: Record<CallBadge, "good" | "warn" | "bad" | "accent" | "neutral"> = {
  "Strong Call": "good",
  "High Intent": "accent",
  "At Risk": "bad",
  "Needs Coaching": "warn",
  "Missed Close": "bad",
  "Follow-Up Required": "warn",
};

export function CallBadges({ badges }: { badges: CallBadge[] }) {
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Badge key={b} tone={BADGE_TONE[b]}>
          {b}
        </Badge>
      ))}
    </div>
  );
}
