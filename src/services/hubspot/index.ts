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
  "createdate",
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
  getDealById(dealId: string): Promise<HubSpotDeal | null>;
  /**
   * Lists deals directly by created-date window, independent of whether any of them
   * are tied to a call we've recorded (Section: Pipeline view). Deliberately separate
   * from getDealsForContact's call-anchored path — this exists so the full HubSpot
   * pipeline is browsable even for deals with no matching call/contact locally.
   */
  listDeals(params: { createdAfter?: string; createdBefore?: string; limit?: number }): Promise<{ deals: HubSpotDeal[]; total: number }>;
  getOwner(ownerId: string): Promise<HubSpotOwner | null>;
  getUpcomingTasksForContact(contactId: string): Promise<HubSpotTask[]>;
  testConnection(): Promise<{ ok: boolean; detail: string }>;
  // Write capabilities. HubSpot is read-only everywhere in this app EXCEPT the
  // explicit, human-approved "Approve & Push to HubSpot" action (Section 8) — never
  // called from any automatic sync path.
  createNoteForContact(contactId: string, note: string): Promise<{ disabled: true } | { id: string }>;
  createTaskForContact(contactId: string, task: { subject: string; body: string; dueDate?: string | null; priority?: "low" | "medium" | "high"; ownerId?: string | null }): Promise<{ disabled: true } | { id: string }>;
}

interface PipelineStageInfo {
  label: string;
  isClosed: boolean;
  probability: number;
}

interface PipelineInfo {
  label: string;
  stages: Map<string, PipelineStageInfo>;
}

// Module-level cache (not per-instance): pipelines/stages change rarely, and every
// getDealsForContact call otherwise re-fetches the same portal-wide pipeline
// definitions to translate one deal's IDs. Shared across LiveHubSpotService
// instances within a single serverless invocation's lifetime.
let pipelinesCache: Map<string, PipelineInfo> | null = null;
let pipelinesCacheAt = 0;
const PIPELINES_CACHE_TTL_MS = 10 * 60 * 1000;

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

  // Like request(), but a 404 (e.g. a deal deleted in HubSpot since we stored its id)
  // resolves to null instead of throwing.
  private async requestOptional<T>(path: string, init?: RequestInit): Promise<T | null> {
    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 404) return null;
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

  // dealstage/pipeline are enumeration properties: HubSpot stores and returns the
  // internal option id (e.g. "951755830"), not the human label ("Deposit Recieved") —
  // confirmed against the real portal, where every custom-pipeline deal (Elite Marry
  // Me, Elite Gender Reveal) showed its raw numeric stage id in the UI instead of a
  // name. /crm/v3/pipelines/deals is the documented way to resolve both the label and
  // whether a stage is actually closed (metadata.isClosed/probability) — string-
  // matching "closedwon"/"closedlost" against the id (the old mapDealStatus) only
  // works for the one default pipeline that happens to use those literal ids; every
  // custom pipeline's own closed stages use portal-specific numeric ids and would
  // otherwise be reported as "open" forever.
  private async loadPipelines(): Promise<Map<string, PipelineInfo>> {
    if (pipelinesCache && Date.now() - pipelinesCacheAt < PIPELINES_CACHE_TTL_MS) return pipelinesCache;
    const data = await this.request<{
      results: Array<{
        id: string;
        label: string;
        stages: Array<{ id: string; label: string; metadata?: { isClosed?: string | boolean; probability?: string | number } }>;
      }>;
    }>("/crm/v3/pipelines/deals");
    const map = new Map<string, PipelineInfo>();
    for (const pipeline of data.results) {
      const stages = new Map<string, PipelineStageInfo>();
      for (const stage of pipeline.stages) {
        stages.set(stage.id, {
          label: stage.label,
          isClosed: stage.metadata?.isClosed === true || stage.metadata?.isClosed === "true",
          probability: Number(stage.metadata?.probability ?? 0),
        });
      }
      map.set(pipeline.id, { label: pipeline.label, stages });
    }
    pipelinesCache = map;
    pipelinesCacheAt = Date.now();
    return map;
  }

  private async mapDealResponse(
    deal: { id: string; properties: Record<string, string | null> },
    pipelines: Map<string, PipelineInfo>
  ): Promise<HubSpotDeal> {
    const pipelineId = deal.properties.pipeline;
    const stageId = deal.properties.dealstage;
    const pipelineInfo = pipelineId ? pipelines.get(pipelineId) : undefined;
    const stageInfo = stageId ? pipelineInfo?.stages.get(stageId) : undefined;
    return {
      id: deal.id,
      dealName: deal.properties.dealname ?? null,
      pipeline: pipelineInfo?.label ?? pipelineId ?? null,
      stage: stageInfo?.label ?? stageId ?? null,
      amount: deal.properties.amount ? Number(deal.properties.amount) : null,
      ownerId: deal.properties.hubspot_owner_id ?? null,
      closeDate: deal.properties.closedate ?? null,
      createdAt: deal.properties.createdate ?? null,
      status: mapDealStatus(stageInfo),
      leadSource: deal.properties.hs_analytics_source ?? null,
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
    const pipelines = await this.loadPipelines();
    const deals: HubSpotDeal[] = [];
    for (const { toObjectId } of assoc.results) {
      const deal = await this.request<{ id: string; properties: Record<string, string | null> }>(
        `/crm/v3/objects/deals/${toObjectId}?properties=${DEAL_PROPERTIES.join(",")}`
      );
      deals.push(await this.mapDealResponse(deal, pipelines));
    }
    return deals;
  }

  async getDealById(dealId: string): Promise<HubSpotDeal | null> {
    const pipelines = await this.loadPipelines();
    const deal = await this.requestOptional<{ id: string; properties: Record<string, string | null> }>(
      `/crm/v3/objects/deals/${dealId}?properties=${DEAL_PROPERTIES.join(",")}`
    );
    if (!deal) return null;
    return this.mapDealResponse(deal, pipelines);
  }

  async listDeals(params: { createdAfter?: string; createdBefore?: string; limit?: number }): Promise<{ deals: HubSpotDeal[]; total: number }> {
    const filters: Array<{ propertyName: string; operator: string; value: string }> = [];
    if (params.createdAfter) filters.push({ propertyName: "createdate", operator: "GTE", value: String(new Date(params.createdAfter).getTime()) });
    if (params.createdBefore) filters.push({ propertyName: "createdate", operator: "LTE", value: String(new Date(params.createdBefore).getTime()) });

    const body = {
      filterGroups: filters.length ? [{ filters }] : [],
      properties: DEAL_PROPERTIES,
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      limit: Math.min(params.limit ?? 100, 100),
    };
    const data = await this.request<{ total: number; results: Array<{ id: string; properties: Record<string, string | null> }> }>(
      "/crm/v3/objects/deals/search",
      { method: "POST", body: JSON.stringify(body) }
    );
    const pipelines = await this.loadPipelines();
    const deals = await Promise.all(data.results.map((deal) => this.mapDealResponse(deal, pipelines)));
    return { deals, total: data.total };
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
    task: { subject: string; body: string; dueDate?: string | null; priority?: "low" | "medium" | "high"; ownerId?: string | null }
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
          ...(task.ownerId ? { hubspot_owner_id: task.ownerId } : {}),
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

function mapDealStatus(stage: PipelineStageInfo | undefined): "open" | "closed_won" | "closed_lost" {
  if (!stage?.isClosed) return "open";
  return stage.probability >= 1 ? "closed_won" : "closed_lost";
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
  async getDealById(): Promise<HubSpotDeal | null> {
    return null;
  }
  async listDeals(): Promise<{ deals: HubSpotDeal[]; total: number }> {
    return { deals: [], total: 0 };
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
