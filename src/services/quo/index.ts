import { createHmac, timingSafeEqual } from "crypto";
import type {
  QuoCallDetail,
  QuoCallSummary,
  QuoTranscript,
  QuoUser,
} from "./types";

// ============================================================================
// QuoService — adapter layer over the Quo (formerly OpenPhone) API.
//
// IMPORTANT: We do not have Quo API credentials or verified endpoint documentation
// in this environment. Rather than guessing at request/response shapes and baking
// wrong assumptions into the app, this adapter exposes the CAPABILITIES the rest of
// the app depends on (list calls, get transcript, etc.) behind a stable interface.
//
// When QUO_API_KEY is configured, `httpRequest()` below is the single place that
// needs a real base URL + auth header wired in per Quo's official docs. Until then,
// every method returns demo data so the rest of the product (matching, analysis,
// dashboards) is fully buildable and testable.
// ============================================================================

const QUO_API_BASE = process.env.QUO_API_BASE_URL ?? "https://api.quo.com"; // placeholder, verify against docs

export function isQuoConfigured(): boolean {
  return Boolean(process.env.QUO_API_KEY);
}

export interface QuoService {
  listRecentCalls(params: { since?: string; limit?: number }): Promise<QuoCallSummary[]>;
  getCall(callId: string): Promise<QuoCallDetail | null>;
  getTranscript(callId: string): Promise<QuoTranscript | null>;
  listUsers(): Promise<QuoUser[]>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
}

class LiveQuoService implements QuoService {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${QUO_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.QUO_API_KEY}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Quo API error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async listRecentCalls(): Promise<QuoCallSummary[]> {
    // TODO: wire to the real "list calls" endpoint once confirmed against Quo docs.
    throw new Error(
      "Quo live integration not yet implemented against verified API docs. Configure demo mode or implement this method."
    );
  }
  async getCall(): Promise<QuoCallDetail | null> {
    throw new Error("Quo live integration not yet implemented.");
  }
  async getTranscript(): Promise<QuoTranscript | null> {
    throw new Error("Quo live integration not yet implemented.");
  }
  async listUsers(): Promise<QuoUser[]> {
    throw new Error("Quo live integration not yet implemented.");
  }
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    // Placeholder HMAC check structure — replace the algorithm with Quo's documented
    // scheme once available. Never accept a webhook silently when a secret is configured.
    if (!process.env.WEBHOOK_SECRET) return true;
    if (!signatureHeader) return false;
    const expected = createHmac("sha256", process.env.WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }
}

class DemoQuoService implements QuoService {
  async listRecentCalls(): Promise<QuoCallSummary[]> {
    return [];
  }
  async getCall(): Promise<QuoCallDetail | null> {
    return null;
  }
  async getTranscript(): Promise<QuoTranscript | null> {
    return null;
  }
  async listUsers(): Promise<QuoUser[]> {
    return [{ id: "demo-federico", name: "Federico", email: "federico@elitemarryme.com" }];
  }
  verifyWebhookSignature(): boolean {
    return true;
  }
}

export function getQuoService(): QuoService {
  return isQuoConfigured() ? new LiveQuoService() : new DemoQuoService();
}
