import type { HubSpotContact, HubSpotDeal, HubSpotOwner, HubSpotTask } from "./types";

// ============================================================================
// HubSpotService — READ-ONLY adapter over the HubSpot CRM v3 API for Phase 1/2.
//
// Per spec: this integration must not write to HubSpot in the MVP. Write helpers
// below are stubbed and throw unless explicitly enabled later (Section 19).
//
// HubSpot's CRM v3 REST API (crm/v3/objects/*, crm/v3/objects/contacts/search, etc.)
// is stable public documentation, so live methods are implemented against it. If your
// portal uses custom property names for lead source / lifecycle, adjust the property
// list in `CONTACT_PROPERTIES` / `DEAL_PROPERTIES` below.
// ============================================================================

const HUBSPOT_API_BASE = "https://api.hubapi.com";

const CONTACT_PROPERTIES = ["firstname", "lastname", "email", "phone", "lifecyclestage"];
const DEAL_PROPERTIES = [
  "dealname",
  "pipeline",
  "dealstage",
  "amount",
  "hubspot_owner_id",
  "closedate",
  "dealstatus",
  "hs_analytics_source",
];

export function isHubSpotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
}

export interface HubSpotService {
  searchContactByEmail(email: string): Promise<HubSpotContact | null>;
  searchContactByPhone(phone: string): Promise<HubSpotContact | null>;
  getDealsForContact(contactId: string): Promise<HubSpotDeal[]>;
  getOwner(ownerId: string): Promise<HubSpotOwner | null>;
  getUpcomingTasksForContact(contactId: string): Promise<HubSpotTask[]>;
  // Write capabilities — architecture only, disabled by default (Section 19).
  createNoteForContact(contactId: string, note: string): Promise<{ disabled: true } | { id: string }>;
}

class LiveHubSpotService implements HubSpotService {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`HubSpot API error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async searchContactByEmail(email: string): Promise<HubSpotContact | null> {
    return this.searchContact("email", email);
  }

  async searchContactByPhone(phone: string): Promise<HubSpotContact | null> {
    return this.searchContact("phone", phone);
  }

  private async searchContact(property: string, value: string): Promise<HubSpotContact | null> {
    const body = {
      filterGroups: [{ filters: [{ propertyName: property, operator: "EQ", value }] }],
      properties: CONTACT_PROPERTIES,
      limit: 1,
    };
    const data = await this.request<{ results: Array<{ id: string; properties: Record<string, string | null> }> }>(
      "/crm/v3/objects/contacts/search",
      { method: "POST", body: JSON.stringify(body) }
    );
    const hit = data.results[0];
    if (!hit) return null;
    return {
      id: hit.id,
      firstname: hit.properties.firstname ?? null,
      lastname: hit.properties.lastname ?? null,
      email: hit.properties.email ?? null,
      phone: hit.properties.phone ?? null,
      lifecycleStage: hit.properties.lifecyclestage ?? null,
    };
  }

  async getDealsForContact(contactId: string): Promise<HubSpotDeal[]> {
    const assoc = await this.request<{ results: Array<{ id: string }> }>(
      `/crm/v4/objects/contacts/${contactId}/associations/deals`
    );
    const deals: HubSpotDeal[] = [];
    for (const { id } of assoc.results) {
      const deal = await this.request<{ id: string; properties: Record<string, string | null> }>(
        `/crm/v3/objects/deals/${id}?properties=${DEAL_PROPERTIES.join(",")}`
      );
      deals.push({
        id: deal.id,
        dealName: deal.properties.dealname ?? null,
        pipeline: deal.properties.pipeline ?? null,
        stage: deal.properties.dealstage ?? null,
        amount: deal.properties.amount ? Number(deal.properties.amount) : null,
        ownerId: deal.properties.hubspot_owner_id ?? null,
        closeDate: deal.properties.closedate ?? null,
        status: mapDealStatus(deal.properties.dealstage),
        leadSource: deal.properties.hs_analytics_source ?? null,
      });
    }
    return deals;
  }

  async getOwner(ownerId: string): Promise<HubSpotOwner | null> {
    const owner = await this.request<{ id: string; firstName?: string; lastName?: string; email?: string }>(
      `/crm/v3/owners/${ownerId}`
    );
    if (!owner) return null;
    return {
      id: owner.id,
      name: [owner.firstName, owner.lastName].filter(Boolean).join(" ") || "Unknown",
      email: owner.email ?? null,
    };
  }

  async getUpcomingTasksForContact(): Promise<HubSpotTask[]> {
    // Requires an associations + engagements query; left as a documented follow-up
    // for Phase 2 rather than guessing at the exact filter shape.
    return [];
  }

  async createNoteForContact(): Promise<{ disabled: true }> {
    return { disabled: true };
  }
}

function mapDealStatus(stage: string | null | undefined): "open" | "closed_won" | "closed_lost" {
  if (!stage) return "open";
  const s = stage.toLowerCase();
  if (s.includes("closedwon") || s.includes("closed_won")) return "closed_won";
  if (s.includes("closedlost") || s.includes("closed_lost")) return "closed_lost";
  return "open";
}

class DemoHubSpotService implements HubSpotService {
  async searchContactByEmail(): Promise<HubSpotContact | null> {
    return null;
  }
  async searchContactByPhone(): Promise<HubSpotContact | null> {
    return null;
  }
  async getDealsForContact(): Promise<HubSpotDeal[]> {
    return [];
  }
  async getOwner(): Promise<HubSpotOwner | null> {
    return null;
  }
  async getUpcomingTasksForContact(): Promise<HubSpotTask[]> {
    return [];
  }
  async createNoteForContact(): Promise<{ disabled: true }> {
    return { disabled: true };
  }
}

export function getHubSpotService(): HubSpotService {
  return isHubSpotConfigured() ? new LiveHubSpotService() : new DemoHubSpotService();
}
