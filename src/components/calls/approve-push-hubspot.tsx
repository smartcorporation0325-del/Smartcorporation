"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pushToHubSpotAction } from "@/app/(app)/calls/[id]/actions";
import type { PushableField, PushPreview } from "@/lib/pipeline/push-to-hubspot";
import { formatDateTime } from "@/lib/utils";

const FIELD_LABELS: Record<PushableField, string> = {
  summary: "AI Call Summary",
  objection: "Primary Objection",
  buyingIntent: "Buying Intent",
  nextAction: "Recommended Next Action",
  score: "AI Call Score",
  followUpTask: "Follow-Up Task",
};

export function ApprovePushHubSpot({ callId, preview }: { callId: string; preview: PushPreview }) {
  const [selected, setSelected] = useState<Set<PushableField>>(
    new Set(["summary", "objection", "buyingIntent", "nextAction", "score", "followUpTask"])
  );
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ status: string; message: string; noteId?: string | null; taskId?: string | null; syncedAt?: string | null } | null>(null);

  function toggle(field: PushableField) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function handlePush() {
    setResult(null);
    startTransition(async () => {
      const res = await pushToHubSpotAction(callId, Array.from(selected));
      setResult(res);
    });
  }

  const synced = result?.status === "success" || result?.status === "skipped" || preview.alreadySynced;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Approve &amp; Push to HubSpot</h4>
        {(preview.alreadySynced || synced) && <Badge tone="good">Synced</Badge>}
      </div>
      <p className="mb-3 text-xs text-muted">
        Nothing is written to HubSpot automatically. Review and deselect anything you don&apos;t want included, then push.
        Coaching notes stay internal — they are never written to HubSpot.
      </p>

      <div className="space-y-2">
        {(Object.keys(FIELD_LABELS) as PushableField[]).map((field) => (
          <label key={field} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.has(field)}
              onChange={() => toggle(field)}
              disabled={preview.alreadySynced}
            />
            <div>
              <div className="font-medium">{FIELD_LABELS[field]}</div>
              <div className="text-xs text-muted">{preview.fields[field]}</div>
            </div>
          </label>
        ))}
      </div>

      {preview.blockReason && !preview.alreadySynced && (
        <p className="mt-3 text-xs text-warn">{preview.blockReason}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={handlePush} disabled={pending || preview.alreadySynced || selected.size === 0}>
          {pending ? "Pushing…" : preview.alreadySynced ? "Already synced" : "Approve & Push to HubSpot"}
        </Button>
      </div>

      {result && (
        <div className="mt-3 rounded-lg bg-black/[0.02] p-3 text-xs">
          <div className={result.status === "failed" ? "text-bad" : "text-good"}>
            {result.status === "success" ? "Successfully synced to HubSpot" : result.message}
          </div>
          {result.syncedAt && <div className="mt-1 text-muted">{formatDateTime(result.syncedAt)}</div>}
          {result.taskId && <div className="text-muted">Task ID: {result.taskId}</div>}
          {result.noteId && <div className="text-muted">Note ID: {result.noteId}</div>}
        </div>
      )}

      {preview.alreadySynced && preview.syncedAt && !result && (
        <div className="mt-3 rounded-lg bg-good/5 p-3 text-xs text-good">
          Successfully synced to HubSpot — {formatDateTime(preview.syncedAt)}
        </div>
      )}
    </Card>
  );
}
