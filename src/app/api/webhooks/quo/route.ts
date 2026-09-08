import { NextRequest, NextResponse } from "next/server";
import { getQuoService } from "@/services/quo";
import { ingestQuoCall } from "@/lib/sync/quo-sync";
import { writeSyncLog } from "@/lib/data/sync-logs";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

// Quo (formerly OpenPhone) webhook receiver (Section 20). Verifies the signature,
// handles duplicate deliveries idempotently (see ingestQuoCall's quo_call_id check),
// and marks transcript_status = 'pending' when the transcript isn't ready yet rather
// than failing the whole ingest.
//
// Real event shape confirmed via docs: { type: "callTranscript", data: { object: {
// callId, dialogue, duration, status } } } — it does NOT include the call's inbox,
// participant, direction, or rep, so on receipt we fetch the full call record via
// GET /v1/calls/{callId} (QuoService.getCallWithTranscript) rather than trusting the
// webhook body for anything beyond "this callId's transcript is ready".
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("openphone-signature");

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

  const callId = extractCallId(payload);
  if (!callId) {
    await writeSyncLog({ provider: "quo", action: "webhook", status: "error", errorMessage: "unrecognized payload shape", payloadReference: rawBody.slice(0, 500) });
    return NextResponse.json({ error: "unrecognized payload shape" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    // Demo mode has no durable call ingest target; acknowledge receipt without
    // pretending to process it so Quo doesn't retry indefinitely.
    return NextResponse.json({ received: true, note: "demo mode: no persistence configured" });
  }

  const fetched = await quo.getCallWithTranscript(callId);
  if (!fetched) {
    await writeSyncLog({ provider: "quo", action: "webhook", status: "error", errorMessage: `call ${callId} not found`, payloadReference: callId });
    return NextResponse.json({ error: "call not found" }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();
  const repIdForQuoUser = async (quoUserId: string | null): Promise<string | null> => {
    if (!quoUserId || !admin) return null;
    const { data } = await admin.from("sales_reps").select("id").eq("quo_user_id", quoUserId).maybeSingle();
    return data?.id ?? null;
  };

  const result = await ingestQuoCall(fetched.call, fetched.transcript, repIdForQuoUser);

  await writeSyncLog({
    provider: "quo",
    action: "webhook:callTranscript",
    status: result.error ? "error" : "success",
    payloadReference: callId,
    errorMessage: result.error ?? null,
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ received: true, callId: result.callId, created: result.created });
}

// Quo's docs show the payload's own `type` field as "callTranscript", but the
// workspace UI names the subscribable event "call.transcript.completed" — accept
// either since we can't confirm which one the live payload actually sends.
const CALL_TRANSCRIPT_EVENT_TYPES = new Set(["callTranscript", "call.transcript.completed"]);

function extractCallId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.type !== "string" || !CALL_TRANSCRIPT_EVENT_TYPES.has(p.type)) return null;
  const data = p.data as Record<string, unknown> | undefined;
  const object = data?.object as Record<string, unknown> | undefined;
  return typeof object?.callId === "string" ? object.callId : null;
}
