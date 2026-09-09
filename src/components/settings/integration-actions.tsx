"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import {
  testQuoConnectionAction,
  testHubSpotConnectionAction,
  syncQuoNowAction,
  backfillCallAssociationsAction,
  type SyncRangePreset,
} from "@/app/(app)/settings/integrations/actions";

const RANGE_OPTIONS: { value: SyncRangePreset; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Specific date…" },
];

export function IntegrationActions({ provider }: { provider: "quo" | "hubspot" | "anthropic" | "supabase" }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [range, setRange] = useState<SyncRangePreset>("24h");
  const [customDate, setCustomDate] = useState("");

  if (provider === "anthropic" || provider === "supabase") return null;

  function testConnection() {
    setMessage(null);
    startTransition(async () => {
      const result = provider === "quo" ? await testQuoConnectionAction() : await testHubSpotConnectionAction();
      setMessage(result.detail);
    });
  }

  function syncNow() {
    setMessage(null);
    startTransition(async () => {
      const result = await syncQuoNowAction(range, range === "custom" ? customDate : undefined);
      const base = `Inspected ${result.inspected} call(s), ingested ${result.ingested} new, analyzed ${result.analyzed}.`;
      const pending = result.pendingAnalysis > 0 ? ` ${result.pendingAnalysis} still need analysis — click Sync now again to continue.` : "";
      setMessage(result.errors.length ? `Sync failed: ${result.errors[0]}` : base + pending);
    });
  }

  function backfillAssociations() {
    setMessage(null);
    startTransition(async () => {
      const result = await backfillCallAssociationsAction();
      const base = `Filled in contact/deal on ${result.updated} call(s), ${result.stillUnresolved} still unresolved (no match found).`;
      const remaining = result.remaining > 0 ? ` ${result.remaining} more queued — click again to continue.` : "";
      setMessage(result.errors.length ? `Backfill failed: ${result.errors[0]}` : base + remaining);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={testConnection} disabled={pending}>
          {pending ? "Checking…" : "Test connection"}
        </Button>
        {provider === "quo" && (
          <>
            <Select className="h-9 w-40" value={range} onChange={(e) => setRange(e.target.value as SyncRangePreset)} disabled={pending}>
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            {range === "custom" && (
              <Input
                type="date"
                className="h-9 w-40"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                disabled={pending}
              />
            )}
            <Button size="sm" variant="secondary" onClick={syncNow} disabled={pending || (range === "custom" && !customDate)}>
              {pending ? "Syncing…" : "Sync now"}
            </Button>
            <Button size="sm" variant="outline" onClick={backfillAssociations} disabled={pending}>
              {pending ? "Working…" : "Fill in missing contacts/deals"}
            </Button>
          </>
        )}
      </div>
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}
