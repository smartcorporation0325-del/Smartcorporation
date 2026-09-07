import { Card } from "@/components/ui/card";

export function WhyThisMatters({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Card className="border-accent/40 bg-accent-soft/30 p-5">
      <h4 className="mb-1 text-sm font-semibold text-accent">Why This Matters</h4>
      <p className="text-sm text-foreground/80">{text}</p>
    </Card>
  );
}
