import { getIntegrationStatuses } from "@/lib/data/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function IntegrationsSettingsPage() {
  const statuses = getIntegrationStatuses();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted">
          Connection status for each external system. All credentials are read from server-side environment
          variables only — see <code>.env.example</code>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {statuses.map((s) => (
          <Card key={s.provider}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{s.name}</CardTitle>
              <Badge tone={s.connected ? "good" : "warn"}>{s.connected ? "Connected" : "Not connected"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-foreground/80">
              <p>{s.detail}</p>
              {s.provider !== "supabase" && (
                <p className="text-xs text-muted">
                  Write-back to {s.name.split(" ")[0]} is architected but disabled by default in this MVP.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
