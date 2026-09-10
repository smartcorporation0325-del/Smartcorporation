// Deep links into the connected HubSpot portal, so the read-only CRM data shown in
// this app can be opened directly in HubSpot with one click instead of requiring a
// manual search there. HUBSPOT_PORTAL_ID defaults to this deployment's own portal
// (confirmed via HubSpot's user/account info) so links work without extra setup;
// override it if this codebase is ever pointed at a different portal.
const DEFAULT_PORTAL_ID = "44791447";

function portalId(): string {
  return process.env.HUBSPOT_PORTAL_ID || DEFAULT_PORTAL_ID;
}

export function hubspotContactUrl(hubspotContactId: string): string {
  return `https://app.hubspot.com/contacts/${portalId()}/record/0-1/${hubspotContactId}`;
}

export function hubspotDealUrl(hubspotDealId: string): string {
  return `https://app.hubspot.com/contacts/${portalId()}/record/0-3/${hubspotDealId}`;
}

// Confirmed directly from a real my.quo.com URL (quo.com/openphone.com's own docs
// are blocked from this environment, so this couldn't be verified any other way):
// https://my.quo.com/inbox/{inboxId}/c/{conversationId} opens that exact conversation
// thread. Both ids are only known for a call reached via the conversation-discovery
// sync path (see services/quo/index.ts) — a call ingested via a direct per-call fetch
// (webhook, backfill) has neither until a later bulk sync fills them in.
export function quoConversationUrl(inboxId: string, conversationId: string): string {
  return `https://my.quo.com/inbox/${inboxId}/c/${conversationId}`;
}

// Fallback for a call whose conversation id isn't known yet: a tel: link opens the
// number in a calling app, which is at least a way to reach the same contact.
export function quoTelUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
