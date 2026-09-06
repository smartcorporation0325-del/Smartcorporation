import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSyncLogs } from "@/lib/data/sync-logs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function SyncLogsPage() {
  const logs = await getSyncLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sync Logs</h1>
        <p className="text-sm text-muted">History of synchronization attempts across Quo, HubSpot, and Claude.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            {isSupabaseConfigured()
              ? "Reading from the sync_logs table."
              : "Demo mode: logs are held in memory for this server process. Use Test Connection / Sync Now on Settings > Integrations to generate entries."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted">No sync activity recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <span className="font-medium capitalize">{l.provider}</span> — {l.action}
                    {l.error_message && <div className="text-xs text-bad">{l.error_message}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={l.status === "success" ? "good" : l.status === "error" ? "bad" : "warn"}>{l.status}</Badge>
                    <span className="text-xs text-muted">{formatDateTime(l.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
