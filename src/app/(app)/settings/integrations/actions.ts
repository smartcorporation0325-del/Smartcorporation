"use server";

import { revalidatePath } from "next/cache";
import { getQuoService } from "@/services/quo";
import { getHubSpotService } from "@/services/hubspot";
import { writeSyncLog } from "@/lib/data/sync-logs";
import { syncRecentQuoCalls } from "@/lib/sync/quo-sync";

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

export async function syncQuoNowAction() {
  const result = await syncRecentQuoCalls();
  revalidatePath("/settings/sync");
  revalidatePath("/calls");
  return result;
}
