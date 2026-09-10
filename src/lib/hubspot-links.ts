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

// Quo (formerly OpenPhone) has no documented deep-link URL for a specific contact's
// record page (direct doc fetches to quo.com/openphone.com are blocked from this
// environment, so the exact scheme couldn't be confirmed) — a tel: link is the one
// interaction guaranteed to work everywhere: it opens the number in a calling app,
// which on a machine with Quo set up is exactly how you'd "go to" that contact.
export function quoTelUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
