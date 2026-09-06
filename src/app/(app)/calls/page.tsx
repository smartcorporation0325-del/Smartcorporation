import Link from "next/link";
import { getCalls, callNeedsAttention, type CallFilters } from "@/lib/data/calls";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatDate, formatDuration, titleCase } from "@/lib/utils";

const OUTCOMES = [
  "closed_won",
  "closed_lost",
  "follow_up_scheduled",
  "follow_up_needed",
  "unresponsive",
  "decision_pending",
];

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters: CallFilters = {
    outcome: params.outcome || undefined,
    status: (params.status as CallFilters["status"]) || undefined,
    search: params.search || undefined,
    minScore: params.minScore ? Number(params.minScore) : undefined,
    needsAttention: params.attention === "1" ? true : undefined,
  };

  const calls = await getCalls(filters);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Calls</h1>
          <p className="text-sm text-muted">{calls.length} calls matching current filters.</p>
        </div>
        <Link href="/calls/new">
          <Button variant="secondary">Add manual call</Button>
        </Link>
      </div>

      <Card className="p-4">
        <form className="grid grid-cols-2 gap-3 md:grid-cols-5" method="get">
          <Input name="search" placeholder="Search contact..." defaultValue={params.search ?? ""} />
          <Select name="outcome" defaultValue={params.outcome ?? ""}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {titleCase(o)}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={params.status ?? ""}>
            <option value="">All deal statuses</option>
            <option value="open">Open</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </Select>
          <Select name="minScore" defaultValue={params.minScore ?? ""}>
            <option value="">Any score</option>
            <option value="80">80+</option>
            <option value="60">60+</option>
            <option value="40">40+</option>
          </Select>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="attention" value="1" defaultChecked={params.attention === "1"} />
              Needs attention
            </label>
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Rep</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Deal</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">AI Close Likelihood</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
              <th className="px-4 py-3 font-medium">Top Objection</th>
              <th className="px-4 py-3 font-medium">Follow-Up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {calls.map((c) => {
              const topObjection = c.analysis?.objections[0];
              const followUp = c.analysis?.follow_up_assessment as { quality?: string } | null;
              return (
                <tr key={c.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/calls/${c.id}`} className="block">
                      {formatDate(c.started_at)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/calls/${c.id}`} className="font-medium hover:underline">
                      {c.contact?.firstname} {c.contact?.lastname}
                    </Link>
                    {callNeedsAttention(c) && (
                      <Badge tone="warn" className="ml-2">
                        Attention
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.sales_rep?.name ?? "Federico"}</td>
                  <td className="px-4 py-3">{formatDuration(c.duration_seconds)}</td>
                  <td className="px-4 py-3">{c.deal?.deal_name ?? "—"}</td>
                  <td className="px-4 py-3">{c.deal?.stage ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.analysis?.overall_score != null ? (
                      <Badge tone={c.analysis.overall_score >= 75 ? "good" : c.analysis.overall_score >= 55 ? "warn" : "bad"}>
                        {c.analysis.overall_score}/100
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{c.analysis?.close_probability != null ? `${c.analysis.close_probability}%` : "—"}</td>
                  <td className="px-4 py-3">{c.analysis?.call_outcome ? titleCase(c.analysis.call_outcome) : "—"}</td>
                  <td className="px-4 py-3">
                    {topObjection ? (
                      <Badge tone={topObjection.handled ? "neutral" : "bad"}>{titleCase(topObjection.objection_type ?? "")}</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={followUp?.quality === "clear" ? "good" : followUp?.quality === "vague" ? "warn" : "bad"}>
                      {titleCase(followUp?.quality ?? "missing")}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {calls.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted">
                  No calls match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
