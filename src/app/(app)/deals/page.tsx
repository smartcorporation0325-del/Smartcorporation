import { getHubSpotService, isHubSpotConfigured } from "@/services/hubspot";
import { hubspotDealUrl } from "@/lib/hubspot-links";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";

// Full HubSpot pipeline browser (Section: Pipeline view). Deliberately independent of
// our calls table: it lists every deal in the given created-date window straight from
// HubSpot, including deals with no matching call/contact recorded locally — unlike
// Revenue Intelligence (intelligence/page.tsx), which is anchored to calls and only
// ever shows deals reachable through a matched call's contact.

type RangePreset = "30d" | "90d" | "this_month" | "last_month" | "all";

const DAY_MS = 24 * 3600 * 1000;

function resolveWindow(preset: RangePreset): { createdAfter?: string; createdBefore?: string } {
  const now = new Date();
  switch (preset) {
    case "30d":
      return { createdAfter: new Date(now.getTime() - 30 * DAY_MS).toISOString() };
    case "90d":
      return { createdAfter: new Date(now.getTime() - 90 * DAY_MS).toISOString() };
    case "this_month": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { createdAfter: start.toISOString() };
    }
    case "last_month": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { createdAfter: start.toISOString(), createdBefore: end.toISOString() };
    }
    case "all":
      return {};
  }
}

const STATUS_TONE = { open: "neutral", closed_won: "good", closed_lost: "bad" } as const;

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const preset = (params.range as RangePreset) || "30d";
  const window = resolveWindow(preset);

  if (!isHubSpotConfigured()) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Deals</h1>
          <p className="text-sm text-muted">Full HubSpot pipeline, independent of call matching.</p>
        </div>
        <Card className="p-6 text-sm text-muted">
          HubSpot is not connected — add HUBSPOT_ACCESS_TOKEN in Settings &gt; Integrations to browse deals here.
        </Card>
      </div>
    );
  }

  const hubspot = getHubSpotService();
  const { deals, total } = await hubspot.listDeals({ ...window, limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Deals</h1>
        <p className="text-sm text-muted">
          {total} deal(s) in HubSpot for this window ({deals.length} shown) — read directly from HubSpot, not
          limited to deals tied to a recorded call.
        </p>
      </div>

      <Card className="p-4">
        <form className="flex items-end gap-3" method="get">
          <div className="flex-1 max-w-xs">
            <Select name="range" defaultValue={preset}>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="all">All time</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Deal</th>
              <th className="px-4 py-3">Pipeline</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Close date</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {deals.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium">{d.dealName ?? "—"}</td>
                <td className="px-4 py-3">{d.pipeline ?? "—"}</td>
                <td className="px-4 py-3">{d.stage ?? "—"}</td>
                <td className="px-4 py-3">{formatCurrency(d.amount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[d.status]}>{titleCase(d.status)}</Badge>
                </td>
                <td className="px-4 py-3">{formatDate(d.closeDate)}</td>
                <td className="px-4 py-3">{formatDate(d.createdAt)}</td>
                <td className="px-4 py-3">
                  <a
                    href={hubspotDealUrl(d.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    View in HubSpot ↗
                  </a>
                </td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted">
                  No deals in this window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
