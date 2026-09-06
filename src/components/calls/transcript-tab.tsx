"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TranscriptTab({ transcriptText }: { transcriptText: string | null }) {
  const [query, setQuery] = useState("");

  const lines = useMemo(() => {
    if (!transcriptText) return [];
    return transcriptText
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        return match ? { speaker: match[1], text: match[2] } : { speaker: "", text: line };
      });
  }, [transcriptText]);

  if (!transcriptText) {
    return <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">No transcript available yet.</div>;
  }

  return (
    <div className="space-y-3">
      <Input placeholder="Search transcript..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-5">
        {lines.map((l, i) => {
          const matches = query && l.text.toLowerCase().includes(query.toLowerCase());
          return (
            <div key={i} className={cn("text-sm", matches && "rounded-md bg-accent-soft/60 p-2")}>
              {l.speaker && <span className="mr-2 font-semibold text-foreground">{l.speaker}:</span>}
              <span className="text-foreground/80">{l.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
