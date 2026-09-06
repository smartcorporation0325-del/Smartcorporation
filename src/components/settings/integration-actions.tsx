"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { testQuoConnectionAction, testHubSpotConnectionAction, syncQuoNowAction } from "@/app/(app)/settings/integrations/actions";

export function IntegrationActions({ provider }: { provider: "quo" | "hubspot" | "anthropic" | "supabase" }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

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
      const result = await syncQuoNowAction();
      setMessage(
        result.errors.length
          ? `Sync failed: ${result.errors[0]}`
          : `Inspected ${result.inspected} call(s), ingested ${result.ingested} new.`
      );
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={testConnection} disabled={pending}>
          {pending ? "Checking…" : "Test connection"}
        </Button>
        {provider === "quo" && (
          <Button size="sm" variant="secondary" onClick={syncNow} disabled={pending}>
            {pending ? "Syncing…" : "Sync now"}
          </Button>
        )}
      </div>
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}
