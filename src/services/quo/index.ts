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
// We do not hold live QUO_API_KEY credentials in this environment, so the live
// implementation below is built from the best-verified shape available (see the
// header comment in ./types.ts) rather than direct API doc access, which this
// environment's egress proxy blocks for quo.com. Every live method is isolated so a
// wrong assumption about one endpoint doesn't ripple through the app — callers only
// ever depend on the QuoService interface, never on these HTTP details directly.
//
// Until QUO_API_KEY is set, every method returns demo data so the rest of the product
// (matching, analysis, sync orchestration, dashboards) is fully buildable and testable.
// ============================================================================

const QUO_API_BASE = process.env.QUO_API_BASE_URL ?? "https://api.quo.com";

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

  async listInboxes(): Promise<QuoInbox[]> {
    // TODO(phase 3): confirm the exact "/v1/phone-numbers" response shape against
    // live credentials before enabling — this environment cannot reach quo.com docs.
    throw new Error(
      "Quo live integration needs endpoint verification against a real workspace before enabling. Configure demo mode, or verify against https://www.quo.com/docs and implement this method."
    );
  }
  async listUsers(): Promise<QuoUser[]> {
    throw new Error("Quo live integration not yet implemented — see listInboxes() note.");
  }
  async listCallsWithTranscripts(): Promise<QuoPage<{ call: QuoCallDetail; transcript: QuoTranscript | null }>> {
    throw new Error("Quo live integration not yet implemented — see listInboxes() note.");
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
