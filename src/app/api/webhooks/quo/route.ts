import { NextRequest, NextResponse } from "next/server";
import { getQuoService } from "@/services/quo";
import { rerunAnalysisForCall } from "@/lib/pipeline/analyze";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

// Quo (formerly OpenPhone) webhook receiver (Section 20). Verifies the signature,
// handles duplicate deliveries idempotently via quo_call_id uniqueness, and marks
// transcript_status = 'pending' when the transcript isn't ready yet rather than
// failing the whole ingest.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-quo-signature");

  const quo = getQuoService();
  if (!quo.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    // Demo mode has no durable call ingest target; acknowledge receipt without
    // pretending to process it so Quo doesn't retry indefinitely.
    return NextResponse.json({ received: true, note: "demo mode: no persistence configured" });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase admin not configured" }, { status: 500 });

  const event = payload as { id?: string; type?: string; callId?: string };
  if (!event.callId) return NextResponse.json({ error: "missing callId" }, { status: 400 });

  await admin.from("sync_logs").insert({
    provider: "quo",
    action: `webhook:${event.type ?? "unknown"}`,
    status: "success",
    payload_reference: event.callId,
  });

  // Idempotency: if this Quo call is already known, don't create a duplicate row or
  // re-trigger analysis.
  const { data: existing } = await admin.from("calls").select("id, analysis_status").eq("quo_call_id", event.callId).maybeSingle();

  if (existing) {
    if (existing.analysis_status === "pending") {
      await rerunAnalysisForCall(existing.id);
    }
    return NextResponse.json({ received: true, callId: existing.id, duplicate: true });
  }

  const call = await quo.getCall(event.callId);
  const transcript = await quo.getTranscript(event.callId);

  const { data: newCall, error } = await admin
    .from("calls")
    .insert({
      quo_call_id: event.callId,
      started_at: call?.startedAt ?? new Date().toISOString(),
      ended_at: call?.endedAt ?? null,
      duration_seconds: call?.durationSeconds ?? null,
      direction: call?.direction ?? "unknown",
      status: call?.status ?? "completed",
      recording_url_or_reference: call?.recordingReference ?? null,
      transcript_status: transcript?.status === "ready" ? "ready" : "pending",
      analysis_status: transcript?.status === "ready" ? "pending" : "none",
      source: "quo",
    })
    .select()
    .single();

  if (error || !newCall) {
    return NextResponse.json({ error: error?.message ?? "failed to create call" }, { status: 500 });
  }

  if (transcript?.status === "ready" && transcript.segments.length) {
    const transcriptText = transcript.segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    await admin.from("call_transcripts").insert({ call_id: newCall.id, transcript_text: transcriptText, source: "quo" });
    await rerunAnalysisForCall(newCall.id);
  }

  return NextResponse.json({ received: true, callId: newCall.id });
}
