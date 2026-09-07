"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WeeklyFounderBrief } from "@/lib/data/founder";

const STATS: { key: keyof WeeklyFounderBrief; label: string }[] = [
  { key: "callsAnalyzed", label: "Calls Analyzed" },
  { key: "highIntentOpportunities", label: "High-Intent Opportunities" },
  { key: "missedCloseOpportunities", label: "Missed Close Opportunities" },
  { key: "followUpsOverdue", label: "Follow-Ups Overdue" },
  { key: "mainObjection", label: "Most Common Objection" },
  { key: "averageScore", label: "Average Call Score" },
  { key: "mainCoachingFocus", label: "Main Coaching Focus" },
];

export function WeeklyBrief({ brief }: { brief: WeeklyFounderBrief }) {
  const [copied, setCopied] = useState(false);

  function copyBrief() {
    const text = [
      "Weekly Founder Brief",
      ...STATS.map((s) => `${s.label}: ${brief[s.key]}`),
      "",
      brief.executiveSummary,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Weekly Founder Brief</CardTitle>
          <CardDescription>Last 7 days of analyzed calls.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={copyBrief}>
          {copied ? "Copied" : "Copy Brief"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.key}>
              <div className="text-xs uppercase tracking-wide text-muted">{s.label}</div>
              <div className="mt-0.5 text-sm font-semibold">{brief[s.key]}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-border pt-4 text-sm text-foreground/80">{brief.executiveSummary}</p>
      </CardContent>
    </Card>
  );
}
