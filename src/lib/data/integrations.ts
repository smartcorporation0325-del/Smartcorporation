import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import { isAnthropicConfigured } from "@/services/anthropic";
import { isQuoConfigured } from "@/services/quo";
import { isHubSpotConfigured } from "@/services/hubspot";

export interface IntegrationStatus {
  provider: "quo" | "hubspot" | "anthropic" | "supabase";
  name: string;
  connected: boolean;
  detail: string;
  writeEnabled: boolean;
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      provider: "quo",
      name: "Quo (formerly OpenPhone)",
      connected: isQuoConfigured(),
      detail: isQuoConfigured()
        ? "QUO_API_KEY detected."
        : "Not connected. Add QUO_API_KEY to enable live call sync. Running on demo call data.",
      writeEnabled: false,
    },
    {
      provider: "hubspot",
      name: "HubSpot CRM",
      connected: isHubSpotConfigured(),
      detail: isHubSpotConfigured()
        ? "HUBSPOT_ACCESS_TOKEN detected. Read-only."
        : "Not connected. Add HUBSPOT_ACCESS_TOKEN to enable live CRM matching. Read-only by design.",
      writeEnabled: false,
    },
    {
      provider: "anthropic",
      name: "Claude (Anthropic)",
      connected: isAnthropicConfigured(),
      detail: isAnthropicConfigured()
        ? "ANTHROPIC_API_KEY detected. Real AI analysis is active."
        : "Not connected. Running on a deterministic demo-mode heuristic instead of real AI analysis.",
      writeEnabled: false,
    },
    {
      provider: "supabase",
      name: "Supabase",
      connected: isSupabaseConfigured(),
      detail: isSupabaseConfigured()
        ? isServiceRoleConfigured()
          ? "Connected with service role — persistence and analysis writes enabled."
          : "Connected (anon key only) — service role key missing, writes will fail."
        : "Not connected. Running on in-memory seeded demo data (resets on server restart).",
      writeEnabled: false,
    },
  ];
}
