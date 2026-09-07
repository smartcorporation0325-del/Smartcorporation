import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Badge } from "@/components/ui/badge";

// Founder Demo Mode indicator (Section 13) — subtle, so nobody mistakes seeded demo
// data for production data once Supabase is connected.
export function DemoDataTag() {
  if (isSupabaseConfigured()) return null;
  return <Badge tone="neutral">Demo Data</Badge>;
}
