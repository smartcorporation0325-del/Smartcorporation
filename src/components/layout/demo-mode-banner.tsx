import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAnthropicConfigured } from "@/services/anthropic";
import { isQuoConfigured } from "@/services/quo";
import { isHubSpotConfigured } from "@/services/hubspot";
import { Badge } from "@/components/ui/badge";

export function DemoModeBanner() {
  const supabase = isSupabaseConfigured();
  const anthropic = isAnthropicConfigured();
  const quo = isQuoConfigured();
  const hubspot = isHubSpotConfigured();

  if (supabase && anthropic && quo && hubspot) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent-soft/60 px-6 py-2 text-xs text-foreground/80">
      <Badge tone="accent">Demo Mode</Badge>
      <span>
        Running on seeded data.{" "}
        {!supabase && "Connect Supabase for persistence. "}
        {!anthropic && "Connect Anthropic for real AI analysis. "}
        {!quo && "Connect Quo to sync live calls. "}
        {!hubspot && "Connect HubSpot to sync CRM context. "}
      </span>
      <a href="/settings/integrations" className="font-medium text-accent underline underline-offset-2">
        Configure integrations
      </a>
    </div>
  );
}
