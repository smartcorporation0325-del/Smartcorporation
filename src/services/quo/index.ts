import { createHmac, timingSafeEqual } from "crypto";
import type {
  QuoCallDetail,
  QuoInbox,
  QuoListCallsParams,
  QuoPage,
  QuoTranscript,
  QuoUser,
} from "./types";

// ============================================================================
// QuoService — adapter layer over the Quo (formerly OpenPhone) API.
//
// Endpoint shapes below are grounded against Quo's public docs (openphone.com/docs,
// quo.com/docs — fetched via web search snippets, since this environment's egress
// proxy blocks direct access to both domains) and cross-checked against real
// workspace data returned by Quo's own MCP tools (confirmed id prefixes: PN... phone
// numbers, US... users, AC... calls, CN... conversations; confirmed phone-numbers and
// calls response field names). The one endpoint chain that couldn't be fully
// confirmed field-by-field is /v1/calls and /v1/call-transcripts directly (only
// reachable from a deployed environment with real network egress, not from here) —
// each read is defensive about alternate field names for that reason.
//
// Calls are scoped by INBOX (a workspace phone number), and Quo's /v1/calls endpoint
// requires a specific participant phone number rather than offering a single
// "all calls for this inbox" listing. So listCallsWithTranscripts first lists the
// inbox's conversations (which enumerate participants), then lists calls per
// participant — the same approach Quo's own call-transcripts tool documents taking
// when no single participant is specified.
//
// Until QUO_API_KEY is set, every method returns demo data so the rest of the product
// (matching, analysis, sync orchestration, dashboards) is fully buildable and testable.
// ============================================================================

const QUO_API_BASE = process.env.QUO_API_BASE_URL ?? "https://api.openphone.com";

export function isQuoConfigured(): boolean {
  return Boolean(process.env.QUO_API_KEY);
}

export interface QuoService {
  listInboxes(userId?: string): Promise<QuoInbox[]>;
  listUsers(): Promise<QuoUser[]>;
  /** Lists calls-with-transcripts for one inbox. Mirrors Quo's inbox-scoped, cursor-paginated model. */
  listCallsWithTranscripts(params: QuoListCallsParams): Promise<QuoPage<{ call: QuoCallDetail; transcript: QuoTranscript | null }>>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  testConnection(): Promise<{ ok: boolean; detail: string }>;
}

type QueryValue = string | number | string[] | undefined;

function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(`${key}[]`, v);
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

interface RawPhoneNumber {
  id: string;
  number: string;
  name?: string | null;
  users?: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null }[];
}

interface RawUser {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
}

interface RawConversation {
  id: string;
  phoneNumberId: string;
  participants: string[];
  lastActivityAt?: string | null;
  createdAt?: string | null;
}

interface RawCall {
  id: string;
  phoneNumberId: string;
  participants?: string[];
  userId?: string | null;
  direction?: "incoming" | "outgoing" | null;
  callRoute?: string | null;
  status?: string | null;
  createdAt: string;
  duration?: number | null;
}

interface RawTranscriptDialogue {
  content: string;
  start?: number | null;
  end?: number | null;
  identifier?: string | null;
  userId?: string | null;
}

interface RawTranscript {
  callId: string;
  status?: string | null;
  dialogue?: RawTranscriptDialogue[] | null;
}

interface RawCallSummary {
  callId: string;
  status?: string | null;
  summary?: string[] | null;
}

class LiveQuoService implements QuoService {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${QUO_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `${process.env.QUO_API_KEY}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Quo API error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  /** Returns null (rather than throwing) for a 404 — used where "not found yet" is an expected state (e.g. a transcript still processing). */
  private async requestOptional<T>(path: string): Promise<T | null> {
    const res = await fetch(`${QUO_API_BASE}${path}`, {
      headers: { Authorization: `${process.env.QUO_API_KEY}`, "Content-Type": "application/json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Quo API error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async listInboxes(userId?: string): Promise<QuoInbox[]> {
    const { data } = await this.request<{ data: RawPhoneNumber[] }>(`/v1/phone-numbers${buildQuery({ userId })}`);
    return data.map((pn) => ({
      id: pn.id,
      phoneNumber: pn.number,
      assignedUserIds: (pn.users ?? []).map((u) => u.id),
    }));
  }

  async listUsers(): Promise<QuoUser[]> {
    const users: QuoUser[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.request<{ data: RawUser[]; nextPageToken: string | null }>(
        `/v1/users${buildQuery({ maxResults: 50, pageToken })}`
      );
      for (const u of page.data) {
        const name = u.name ?? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || u.id);
        users.push({ id: u.id, name, email: u.email ?? null, role: u.role ?? undefined });
      }
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);
    return users;
  }

  private async fetchTranscript(callId: string): Promise<QuoTranscript | null> {
    const raw = await this.requestOptional<RawTranscript>(`/v1/call-transcripts/${callId}`);
    if (!raw) return null;

    let aiSummary: string | null = null;
    try {
      const summary = await this.requestOptional<RawCallSummary>(`/v1/call-summaries/${callId}`);
      if (summary?.summary?.length) aiSummary = summary.summary.join(" ");
    } catch {
      // Call summaries are a nice-to-have; never fail transcript retrieval because of them.
    }

    const status: QuoTranscript["status"] = raw.status === "completed" || raw.status === "ready" ? "ready" : raw.status === "failed" ? "failed" : "pending";
    return {
      callId,
      status,
      segments: (raw.dialogue ?? []).map((d) => ({
        speaker: d.userId ? "Rep" : d.identifier ?? "Caller",
        text: d.content,
        startSeconds: d.start ?? null,
      })),
      aiSummary,
    };
  }

  private toCallDetail(inboxPhoneNumber: string, raw: RawCall): QuoCallDetail {
    const direction: QuoCallDetail["direction"] = raw.direction === "incoming" ? "inbound" : "outbound";
    const status: QuoCallDetail["status"] =
      raw.status === "missed" || raw.status === "no-answer" || raw.status === "abandoned" || raw.status === "voicemail" || raw.status === "in-progress"
        ? raw.status
        : "completed";
    return {
      id: raw.id,
      conversationId: null,
      inboxPhoneNumber,
      participantPhoneNumber: raw.participants?.[0] ?? null,
      userId: raw.userId ?? null,
      direction,
      status,
      createdAt: raw.createdAt,
      durationSeconds: raw.duration ?? null,
      recordingUrl: null,
    };
  }

  async listCallsWithTranscripts(
    params: QuoListCallsParams
  ): Promise<QuoPage<{ call: QuoCallDetail; transcript: QuoTranscript | null }>> {
    const inboxes = await this.listInboxes();
    const inbox = inboxes.find((i) => i.phoneNumber === params.inboxPhoneNumber);
    if (!inbox) return { items: [], nextPageToken: null };

    // Single participant specified: query /v1/calls directly, with real pagination.
    if (params.participantPhoneNumber) {
      const page = await this.request<{ data: RawCall[]; nextPageToken: string | null }>(
        `/v1/calls${buildQuery({
          phoneNumberId: inbox.id,
          participants: [params.participantPhoneNumber],
          userId: params.userId,
          createdAfter: params.createdAfter,
          createdBefore: params.createdBefore,
          maxResults: params.maxResults ?? 20,
          pageToken: params.pageToken,
        })}`
      );
      const items = await Promise.all(
        page.data.map(async (raw) => {
          const call = this.toCallDetail(params.inboxPhoneNumber, raw);
          const transcript = await this.fetchTranscript(call.id);
          return { call, transcript };
        })
      );
      return { items, nextPageToken: page.nextPageToken };
    }

    // No participant specified: discover conversations for this inbox, then list calls
    // per participant. Quo has no single "all calls for this inbox" endpoint.
    const conversations = await this.request<{ data: RawConversation[] }>(
      `/v1/conversations${buildQuery({ phoneNumbers: [params.inboxPhoneNumber], maxResults: 50 })}`
    );

    const items: { call: QuoCallDetail; transcript: QuoTranscript | null }[] = [];
    const seenCallIds = new Set<string>();
    for (const convo of conversations.data) {
      if (params.createdAfter && convo.lastActivityAt && convo.lastActivityAt < params.createdAfter) continue;
      const participant = convo.participants.find((p) => p !== params.inboxPhoneNumber);
      if (!participant) continue;

      const callsPage = await this.request<{ data: RawCall[] }>(
        `/v1/calls${buildQuery({
          phoneNumberId: inbox.id,
          participants: [participant],
          userId: params.userId,
          createdAfter: params.createdAfter,
          createdBefore: params.createdBefore,
          maxResults: params.maxResults ?? 20,
        })}`
      );
      for (const raw of callsPage.data) {
        if (seenCallIds.has(raw.id)) continue;
        seenCallIds.add(raw.id);
        const call = this.toCallDetail(params.inboxPhoneNumber, raw);
        const transcript = await this.fetchTranscript(call.id);
        items.push({ call, transcript });
      }
    }

    return { items, nextPageToken: null };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    // Placeholder HMAC check structure — replace the algorithm with Quo's documented
    // scheme once verified. Never accept a webhook silently when a secret is configured.
    if (!process.env.WEBHOOK_SECRET) return true;
    if (!signatureHeader) return false;
    const expected = createHmac("sha256", process.env.WEBHOOK_SECRET).update(rawBody).digest("hex");
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    try {
      const users = await this.listUsers();
      return { ok: true, detail: `Connected. ${users.length} user(s) visible in a quick check.` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}

class DemoQuoService implements QuoService {
  async listInboxes(): Promise<QuoInbox[]> {
    return [{ id: "demo-inbox", phoneNumber: "+15555550100", assignedUserIds: ["demo-federico"] }];
  }
  async listUsers(): Promise<QuoUser[]> {
    return [{ id: "demo-federico", name: "Federico", email: "federico@elitemarryme.com", role: "member" }];
  }
  async listCallsWithTranscripts(): Promise<QuoPage<{ call: QuoCallDetail; transcript: QuoTranscript | null }>> {
    return { items: [], nextPageToken: null };
  }
  verifyWebhookSignature(): boolean {
    return true;
  }
  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    return { ok: false, detail: "QUO_API_KEY is not configured." };
  }
}

export function getQuoService(): QuoService {
  return isQuoConfigured() ? new LiveQuoService() : new DemoQuoService();
}
