"use server";

import { revalidatePath } from "next/cache";
import { getQuoService } from "@/services/quo";
import { getHubSpotService } from "@/services/hubspot";
import { writeSyncLog } from "@/lib/data/sync-logs";
import { syncRecentQuoCalls, backfillCallAssociations, type SyncWindow } from "@/lib/sync/quo-sync";

export type SyncRangePreset = "24h" | "3d" | "7d" | "14d" | "this_month" | "last_month" | "custom";

const DAY_MS = 24 * 3600 * 1000;

/** Resolves a sync range preset (Settings > Integrations) to a concrete UTC window. */
function resolveSyncWindow(preset: SyncRangePreset, customDate?: string): SyncWindow {
  const now = new Date();

  switch (preset) {
    case "24h":
      return { createdAfter: new Date(now.getTime() - DAY_MS).toISOString() };
    case "3d":
      return { createdAfter: new Date(now.getTime() - 3 * DAY_MS).toISOString() };
    case "7d":
      return { createdAfter: new Date(now.getTime() - 7 * DAY_MS).toISOString() };
    case "14d":
      return { createdAfter: new Date(now.getTime() - 14 * DAY_MS).toISOString() };
    case "this_month": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { createdAfter: start.toISOString() };
    }
    case "last_month": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { createdAfter: start.toISOString(), createdBefore: end.toISOString() };
    }
    case "custom": {
      if (!customDate) return { createdAfter: new Date(now.getTime() - DAY_MS).toISOString() };
      const start = new Date(`${customDate}T00:00:00.000Z`);
      const end = new Date(start.getTime() + DAY_MS);
      return { createdAfter: start.toISOString(), createdBefore: end.toISOString() };
    }
  }
}

export async function testQuoConnectionAction() {
  const result = await getQuoService().testConnection();
  await writeSyncLog({ provider: "quo", action: "test_connection", status: result.ok ? "success" : "error", errorMessage: result.ok ? null : result.detail });
  revalidatePath("/settings/sync");
  return result;
}

export async function testHubSpotConnectionAction() {
  const result = await getHubSpotService().testConnection();
  await writeSyncLog({ provider: "hubspot", action: "test_connection", status: result.ok ? "success" : "error", errorMessage: result.ok ? null : result.detail });
  revalidatePath("/settings/sync");
  return result;
}

export async function syncQuoNowAction(preset: SyncRangePreset = "24h", customDate?: string) {
  const result = await syncRecentQuoCalls(resolveSyncWindow(preset, customDate));
  revalidatePath("/settings/sync");
  revalidatePath("/calls");
  return result;
}

/**
 * Fills in contact_id/deal_id on calls ingested before findOrCreateLocalContact was
 * fixed to retry HubSpot instead of caching a blank match, and to resolve a deal at
 * all. Safe to click repeatedly (Section: backfill, one-time cleanup for existing data).
 */
export async function backfillCallAssociationsAction() {
  const result = await backfillCallAssociations();
  await writeSyncLog({
    provider: "quo",
    action: "backfill_associations",
    status: result.errors.length ? "error" : "success",
    errorMessage: result.errors[0] ?? null,
  });
  revalidatePath("/settings/sync");
  revalidatePath("/calls");
  return result;
}
