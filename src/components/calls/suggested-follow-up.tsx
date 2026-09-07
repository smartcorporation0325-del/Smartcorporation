"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground/80">{text}</p>
    </div>
  );
}

export function SuggestedFollowUp({ sms, email }: { sms: string | null; email: string | null }) {
  if (!sms && !email) return null;
  return (
    <Card className="p-5">
      <h4 className="mb-1 text-sm font-semibold">Suggested Follow-Up</h4>
      <p className="mb-3 text-xs text-muted">Ready to review and send manually — nothing goes out automatically.</p>
      <div className="space-y-3">
        {sms && <CopyBlock label="SMS" text={sms} />}
        {email && <CopyBlock label="Email" text={email} />}
      </div>
    </Card>
  );
}
