"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { rerunAnalysisAction, attachTranscriptAction } from "@/app/(app)/calls/[id]/actions";

export function ManualActions({ callId, hasTranscript }: { callId: string; hasTranscript: boolean }) {
  const [open, setOpen] = useState(!hasTranscript);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleRerun() {
    setMessage(null);
    startTransition(async () => {
      const res = await rerunAnalysisAction(callId);
      setMessage(res.status === "completed" ? "Analysis complete." : `Failed: ${res.error}`);
    });
  }

  function handleAttach() {
    setMessage(null);
    startTransition(async () => {
      const res = await attachTranscriptAction(callId, text);
      setMessage(res.status === "completed" ? "Transcript saved and analyzed." : `Failed: ${res.error}`);
      if (res.status === "completed") {
        setText("");
        setOpen(false);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Paste / upload transcript"}
        </Button>
        {hasTranscript && (
          <Button variant="secondary" size="sm" onClick={handleRerun} disabled={pending}>
            {pending ? "Running…" : "Re-run analysis"}
          </Button>
        )}
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={8}
            placeholder="Paste the call transcript here, e.g.\nFederico: ...\nClient: ..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="file"
            accept=".txt"
            className="text-xs text-muted"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setText(await file.text());
            }}
          />
          <div>
            <Button size="sm" onClick={handleAttach} disabled={pending || !text.trim()}>
              {pending ? "Analyzing…" : "Save & run analysis"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
