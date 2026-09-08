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
  testConnection(): Promise<{ ok: boolean; detail: string }>;
  // Write capabilities. HubSpot is read-only everywhere in this app EXCEPT the
  // explicit, human-approved "Approve & Push to HubSpot" action (Section 8) — never
  // called from any automatic sync path.
  createNoteForContact(contactId: string, note: string): Promise<{ disabled: true } | { id: string }>;
  createTaskForContact(contactId: string, task: { subject: string; body: string; dueDate?: string | null; priority?: "low" | "medium" | "high" }): Promise<{ disabled: true } | { id: string }>;
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
    // HubSpot's own `phone`/`mobilephone` properties have no fixed storage format
    // (dashes, parentheses, with/without country code all occur in real portals), so
    // matching against them directly is unreliable — confirmed against a real portal
    // where a contact was findable via HubSpot's own UI search but not via our EQ or
    // CONTAINS_TOKEN filters on `phone`. HubSpot's documented fix is the hidden
    // `hs_searchable_calculated_phone_number` property, which HubSpot itself keeps
    // normalized to the national number (no country code) specifically for search.
    const digits = phone.replace(/\D/g, "");
    const nationalDigits = digits.length > 10 ? digits.slice(-10) : digits;
    return this.searchContact("hs_searchable_calculated_phone_number", nationalDigits);
  }

  private async searchContact(property: string, value: string, operator: string = "EQ"): Promise<HubSpotContact | null> {
    const body = {
      filterGroups: [{ filters: [{ propertyName: property, operator, value }] }],
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
    // The v4 associations response has no "id" field — each result carries the
    // related object's id as "toObjectId". Reading "id" (as this code previously did)
    // silently comes back undefined, which only surfaced once a real matched contact
    // actually had an associated deal: it built a request to
    // /crm/v3/objects/deals/undefined and HubSpot returned a 404.
    const assoc = await this.request<{ results: Array<{ toObjectId: number | string }> }>(
      `/crm/v4/objects/contacts/${contactId}/associations/deals`
    );
    const deals: HubSpotDeal[] = [];
    for (const { toObjectId } of assoc.results) {
      const deal = await this.request<{ id: string; properties: Record<string, string | null> }>(
        `/crm/v3/objects/deals/${toObjectId}?properties=${DEAL_PROPERTIES.join(",")}`
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

  // Real write, only ever invoked from the "Approve & Push to HubSpot" server action
  // after explicit manager confirmation — never from a sync/webhook path.
  async createNoteForContact(contactId: string, note: string): Promise<{ id: string }> {
    const created = await this.request<{ id: string }>("/crm/v3/objects/notes", {
      method: "POST",
      body: JSON.stringify({
        properties: { hs_note_body: note, hs_timestamp: Date.now() },
        associations: [
          {
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }], // note -> contact
          },
        ],
      }),
    });
    return { id: created.id };
  }

  async createTaskForContact(
    contactId: string,
    task: { subject: string; body: string; dueDate?: string | null; priority?: "low" | "medium" | "high" }
  ): Promise<{ id: string }> {
    const priorityMap = { low: "LOW", medium: "MEDIUM", high: "HIGH" } as const;
    const created = await this.request<{ id: string }>("/crm/v3/objects/tasks", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_task_subject: task.subject,
          hs_task_body: task.body,
          hs_task_status: "NOT_STARTED",
          hs_task_priority: priorityMap[task.priority ?? "medium"],
          hs_timestamp: task.dueDate ? new Date(task.dueDate).getTime() : Date.now(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }], // task -> contact
          },
        ],
      }),
    });
    return { id: created.id };
  }

  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    try {
      const data = await this.request<{ results: unknown[] }>("/crm/v3/owners/?limit=1");
      return { ok: true, detail: `Connected. ${data.results?.length ?? 0} owner(s) visible in a quick check.` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
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
  async createTaskForContact(): Promise<{ disabled: true }> {
    return { disabled: true };
  }
  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    return { ok: false, detail: "HUBSPOT_ACCESS_TOKEN is not configured." };
  }
}

export function getHubSpotService(): HubSpotService {
  return isHubSpotConfigured() ? new LiveHubSpotService() : new DemoHubSpotService();
}
