import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import type { SyncLog } from "@/types/db";

// Demo-mode in-memory sync log store, mirroring lib/data/manual-store.ts, so
// Settings > Sync Logs and the "Sync now" / "Test connection" actions are
// demonstrable even without Supabase configured.
let demoLogs: SyncLog[] = [];

export async function writeSyncLog(entry: {
  provider: SyncLog["provider"];
  action: string;
  status: SyncLog["status"];
  payloadReference?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    if (admin) {
      await admin.from("sync_logs").insert({
        provider: entry.provider,
        action: entry.action,
        status: entry.status,
        payload_reference: entry.payloadReference ?? null,
        error_message: entry.errorMessage ?? null,
      });
      return;
    }
  }
  demoLogs.unshift({
    id: `demo-log-${demoLogs.length}-${Date.now()}`,
    provider: entry.provider,
    action: entry.action,
    status: entry.status,
    payload_reference: entry.payloadReference ?? null,
    error_message: entry.errorMessage ?? null,
    created_at: new Date().toISOString(),
  });
  demoLogs = demoLogs.slice(0, 100);
}

export async function getSyncLogs(): Promise<SyncLog[]> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.from("sync_logs").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    }
  }
  return demoLogs;
}
