import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { AssociateContact } from "@/components/calls/associate-contact";
import { ApprovePushHubSpot } from "@/components/calls/approve-push-hubspot";
import { buildPushPreview } from "@/lib/pipeline/push-to-hubspot";
import { hubspotContactUrl, hubspotDealUrl, quoConversationUrl, quoTelUrl } from "@/lib/hubspot-links";
import type { CallWithRelations } from "@/types/db";

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">
      {label} ↗
    </a>
  );
}

export function CrmContextTab({ call }: { call: CallWithRelations }) {
  const contactName = `${call.contact?.firstname ?? ""} ${call.contact?.lastname ?? ""}`.trim() || "—";
  const quoLink =
    call.quo_inbox_id && call.quo_conversation_id
      ? { href: quoConversationUrl(call.quo_inbox_id, call.quo_conversation_id), label: "Open in Quo" }
      : call.contact?.phone
        ? { href: quoTelUrl(call.contact.phone), label: "Call via Quo" }
        : null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h4 className="mb-3 text-sm font-semibold">CRM Context (source data from HubSpot)</h4>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Contact</dt>
            <dd className="mt-0.5 font-medium">{contactName}</dd>
            {call.contact?.hubspot_contact_id && (
              <div className="mt-1">
                <ExternalLink href={hubspotContactUrl(call.contact.hubspot_contact_id)} label="Open in HubSpot" />
              </div>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-0.5 font-medium">{call.contact?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Phone</dt>
            <dd className="mt-0.5 font-medium">{call.contact?.phone ?? "—"}</dd>
            {quoLink && (
              <div className="mt-1">
                <ExternalLink href={quoLink.href} label={quoLink.label} />
              </div>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Deal</dt>
            <dd className="mt-0.5 font-medium">{call.deal?.deal_name ?? "—"}</dd>
            {call.deal?.hubspot_deal_id && (
              <div className="mt-1">
                <ExternalLink href={hubspotDealUrl(call.deal.hubspot_deal_id)} label="Open in HubSpot" />
              </div>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Pipeline</dt>
            <dd className="mt-0.5 font-medium">{call.deal?.pipeline ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Stage</dt>
            <dd className="mt-0.5 font-medium">{call.deal?.stage ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Amount</dt>
            <dd className="mt-0.5 font-medium">{formatCurrency(call.deal?.amount)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Status</dt>
            <dd className="mt-0.5 font-medium">{call.deal?.status ? titleCase(call.deal.status) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Close date</dt>
            <dd className="mt-0.5 font-medium">{formatDate(call.deal?.close_date)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          Only fields relevant to scoring this call are sent to Claude — unrelated CRM notes and custom
          properties are intentionally excluded (see Settings &gt; Integrations for the HubSpot connection).
          &ldquo;Open in Quo&rdquo; jumps straight to this call&apos;s conversation thread when we know it;
          otherwise &ldquo;Call via Quo&rdquo; opens the number in your default calling app instead.
        </p>
      </Card>
      <AssociateContact callId={call.id} hasContact={Boolean(call.contact?.hubspot_contact_id)} />
      {call.analysis && <ApprovePushHubSpot callId={call.id} preview={buildPushPreview(call)} />}
    </div>
  );
}
