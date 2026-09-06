import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { AssociateContact } from "@/components/calls/associate-contact";
import type { CallWithRelations } from "@/types/db";

export function CrmContextTab({ call }: { call: CallWithRelations }) {
  const rows: [string, string][] = [
    ["Contact", `${call.contact?.firstname ?? ""} ${call.contact?.lastname ?? ""}`.trim() || "—"],
    ["Email", call.contact?.email ?? "—"],
    ["Phone", call.contact?.phone ?? "—"],
    ["Deal", call.deal?.deal_name ?? "—"],
    ["Pipeline", call.deal?.pipeline ?? "—"],
    ["Stage", call.deal?.stage ?? "—"],
    ["Amount", formatCurrency(call.deal?.amount)],
    ["Status", call.deal?.status ? titleCase(call.deal.status) : "—"],
    ["Close date", formatDate(call.deal?.close_date)],
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h4 className="mb-3 text-sm font-semibold">CRM Context (source data from HubSpot)</h4>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">
          Only fields relevant to scoring this call are sent to Claude — unrelated CRM notes and custom
          properties are intentionally excluded (see Settings &gt; Integrations for the HubSpot connection).
        </p>
      </Card>
      <AssociateContact callId={call.id} hasContact={Boolean(call.contact?.hubspot_contact_id)} />
    </div>
  );
}
