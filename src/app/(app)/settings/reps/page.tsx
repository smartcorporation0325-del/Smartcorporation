import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_SALES_REPS } from "@/lib/demo/seed-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SalesRep } from "@/types/db";

export default async function SalesRepsSettingsPage() {
  let reps: SalesRep[] = DEMO_SALES_REPS;
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.from("sales_reps").select("*").order("created_at");
      if (data?.length) reps = data;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sales Reps</h1>
        <p className="text-sm text-muted">
          Currently analyzing Federico. The schema and pipeline support additional reps without changes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reps</CardTitle>
          <CardDescription>Mapped to Quo user IDs and HubSpot owner IDs for call/deal attribution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {reps.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted">{r.email}</div>
              </div>
              <Badge tone={r.active ? "good" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
