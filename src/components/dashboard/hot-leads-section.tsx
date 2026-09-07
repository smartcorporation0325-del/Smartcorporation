import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { hotLeadNeedsAction } from "@/lib/rules/hot-lead";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CallWithRelations } from "@/types/db";

export function HotLeadsSection({ hotLeads }: { hotLeads: CallWithRelations[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hot Leads Requiring Attention</CardTitle>
        <CardDescription>High buying intent, deal still open.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {hotLeads.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">No hot leads right now.</div>
        ) : (
          <ul className="divide-y divide-border">
            {hotLeads.map((c) => {
              const needsAction = hotLeadNeedsAction(c);
              return (
                <li key={c.id}>
                  <Link href={`/calls/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-black/[0.02]">
                    <div>
                      <div className="text-sm font-medium">
                        {c.contact?.firstname} {c.contact?.lastname}
                      </div>
                      <div className="text-xs text-muted">
                        {c.deal?.deal_name} • {formatDate(c.started_at)} • {formatCurrency(c.deal?.amount)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="accent">Hot Lead</Badge>
                      {needsAction && <Badge tone="bad">Action Required</Badge>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
