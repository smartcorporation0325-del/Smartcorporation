import { NextRequest, NextResponse } from "next/server";
import { getQuoService } from "@/services/quo";
import { ingestQuoCall } from "@/lib/sync/quo-sync";
import { writeSyncLog } from "@/lib/data/sync-logs";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { QuoCallDetail, QuoTranscript } from "@/services/quo/types";

// Quo (formerly OpenPhone) webhook receiver (Section 20). Verifies the signature,
// handles duplicate deliveries idempotently (see ingestQuoCall's quo_call_id check),
// and marks transcript_status = 'pending' when the transcript isn't ready yet rather
// than failing the whole ingest.
//
// Payload shape note: this environment cannot reach quo.com's docs to confirm the
// exact webhook body (see services/quo/index.ts header). We accept a reasonably
// shaped payload (a `call` object plus an optional `transcript` object) and log the
// raw payload_reference either way, so a mismatch is diagnosable from sync logs
// rather than a silent failure — adjust `parsePayload` once verified.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-quo-signature");

  const quo = getQuoService();
  if (!quo.verifyWebhookSignature(rawBody, signature)) {
    await writeSyncLog({ provider: "quo", action: "webhook", status: "error", errorMessage: "invalid signature" });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = parsePayload(payload);
  if (!parsed) {
    await writeSyncLog({ provider: "quo", action: "webhook", status: "error", errorMessage: "unrecognized payload shape", payloadReference: rawBody.slice(0, 500) });
    return NextResponse.json({ error: "unrecognized payload shape" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    // Demo mode has no durable call ingest target; acknowledge receipt without
    // pretending to process it so Quo doesn't retry indefinitely.
    return NextResponse.json({ received: true, note: "demo mode: no persistence configured" });
  }

  const admin = getSupabaseAdminClient();
  const repIdForQuoUser = async (quoUserId: string | null): Promise<string | null> => {
    if (!quoUserId || !admin) return null;
    const { data } = await admin.from("sales_reps").select("id").eq("quo_user_id", quoUserId).maybeSingle();
    return data?.id ?? null;
  };

  const result = await ingestQuoCall(parsed.call, parsed.transcript, repIdForQuoUser);

  await writeSyncLog({
    provider: "quo",
    action: `webhook:${parsed.eventType}`,
    status: result.error ? "error" : "success",
    payloadReference: parsed.call.id,
    errorMessage: result.error ?? null,
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ received: true, callId: result.callId, created: result.created });
}

function parsePayload(payload: unknown): { eventType: string; call: QuoCallDetail; transcript: QuoTranscript | null } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const call = p.call as Record<string, unknown> | undefined;
  if (!call || typeof call.id !== "string") return null;

  const callDetail: QuoCallDetail = {
    id: call.id,
    conversationId: (call.conversationId as string) ?? null,
    inboxPhoneNumber: (call.inboxPhoneNumber as string) ?? "",
    participantPhoneNumber: (call.participantPhoneNumber as string) ?? null,
    userId: (call.userId as string) ?? null,
    direction: (call.direction as "inbound" | "outbound") ?? "inbound",
    status: (call.status as QuoCallDetail["status"]) ?? "completed",
    createdAt: (call.createdAt as string) ?? new Date().toISOString(),
    durationSeconds: (call.durationSeconds as number) ?? null,
    recordingUrl: (call.recordingUrl as string) ?? null,
  };

  const rawTranscript = p.transcript as Record<string, unknown> | undefined;
  const transcript: QuoTranscript | null = rawTranscript
    ? {
        callId: call.id,
        status: (rawTranscript.status as QuoTranscript["status"]) ?? "pending",
        segments: Array.isArray(rawTranscript.segments) ? (rawTranscript.segments as QuoTranscript["segments"]) : [],
        aiSummary: (rawTranscript.aiSummary as string) ?? null,
      }
    : null;

  return { eventType: (p.type as string) ?? "unknown", call: callDetail, transcript };
}
