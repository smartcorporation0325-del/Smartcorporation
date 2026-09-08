import { getQuoService, isQuoConfigured } from "@/services/quo";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { findOrCreateLocalContact } from "@/lib/matching/associate";
import { rerunAnalysisForCall } from "@/lib/pipeline/analyze";
import { writeSyncLog } from "@/lib/data/sync-logs";
import type { QuoCallDetail, QuoTranscript } from "@/services/quo/types";

export interface IngestResult {
  callId: string | null;
  created: boolean;
  transcriptReady: boolean;
  error?: string;
}

/**
 * Ingests one Quo call (from a webhook payload or a manual sync page) into our own
 * schema: idempotent on quo_call_id, matches/creates a local contact via the
 * association engine, stores the transcript if ready (else marks it pending), and
 * kicks off analysis only once a transcript is available. Never creates a duplicate
 * analysis for a call we've already ingested (Section 20).
 */
export async function ingestQuoCall(
  call: QuoCallDetail,
  transcript: QuoTranscript | null,
  quoUserIdToRepId: (quoUserId: string | null) => Promise<string | null>
): Promise<IngestResult> {
  if (!isSupabaseConfigured()) {
    return { callId: null, created: false, transcriptReady: false, error: "Supabase not configured — demo mode has no durable call ingest target." };
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return { callId: null, created: false, transcriptReady: false, error: "Supabase admin client not configured." };

  const { data: existing } = await admin.from("calls").select("id, analysis_status, transcript_status").eq("quo_call_id", call.id).maybeSingle();

  if (existing) {
    // Idempotent: only act if the transcript just became ready and analysis hasn't run yet.
    if (transcript?.status === "ready" && existing.transcript_status !== "ready") {
      const transcriptText = transcript.segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
      await admin.from("call_transcripts").insert({ call_id: existing.id, transcript_text: transcriptText, source: "quo" });
      await admin.from("calls").update({ transcript_status: "ready", analysis_status: "pending" }).eq("id", existing.id);
      await rerunAnalysisForCall(existing.id);
    }
    return { callId: existing.id, created: false, transcriptReady: transcript?.status === "ready" };
  }

  const localContact = call.participantPhoneNumber
    ? await findOrCreateLocalContact({ phone: call.participantPhoneNumber })
    : null;
  const salesRepId = await quoUserIdToRepId(call.userId);

  const { data: newCall, error } = await admin
    .from("calls")
    .insert({
      quo_call_id: call.id,
      contact_id: localContact?.contactId ?? null,
      sales_rep_id: salesRepId,
      started_at: call.createdAt,
      duration_seconds: call.durationSeconds,
      direction: call.direction,
      status: call.status === "no-answer" || call.status === "abandoned" ? "missed" : (call.status as "completed" | "missed" | "voicemail" | "in_progress"),
      recording_url_or_reference: call.recordingUrl,
      transcript_status: transcript?.status === "ready" ? "ready" : "pending",
      analysis_status: "none",
      source: "quo",
    })
    .select()
    .single();

  if (error || !newCall) {
    return { callId: null, created: false, transcriptReady: false, error: error?.message ?? "Failed to create call." };
  }

  if (transcript?.status === "ready" && transcript.segments.length) {
    const transcriptText = transcript.segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    await admin.from("call_transcripts").insert({ call_id: newCall.id, transcript_text: transcriptText, source: "quo" });
    await admin.from("calls").update({ analysis_status: "pending" }).eq("id", newCall.id);
    await rerunAnalysisForCall(newCall.id);
    return { callId: newCall.id, created: true, transcriptReady: true };
  }

  return { callId: newCall.id, created: true, transcriptReady: false };
}

export interface SyncWindow {
  createdAfter: string; // ISO 8601 UTC
  createdBefore?: string; // ISO 8601 UTC, omitted means "up to now"
}

/**
 * Manual "Sync now" entry point (Settings > Integrations). Lists calls across every
 * known inbox within the given window and ingests any not already known to us.
 * Requires QUO_API_KEY; without it, returns a clear no-op result rather than
 * silently doing nothing. Defaults to the last 24 hours when no window is given.
 */
export async function syncRecentQuoCalls(
  window: SyncWindow = { createdAfter: new Date(Date.now() - 24 * 3600 * 1000).toISOString() }
): Promise<{ inspected: number; ingested: number; errors: string[] }> {
  if (!isQuoConfigured()) {
    const message = "QUO_API_KEY is not configured — nothing to sync. Demo data is already loaded.";
    await writeSyncLog({ provider: "quo", action: "sync_now", status: "error", errorMessage: message });
    return { inspected: 0, ingested: 0, errors: [message] };
  }

  const quo = getQuoService();
  const errors: string[] = [];
  let inspected = 0;
  let ingested = 0;

  try {
    const inboxes = await quo.listInboxes();
    const users = await quo.listUsers();
    const admin = isSupabaseConfigured() ? getSupabaseAdminClient() : null;

    const repIdForQuoUser = async (quoUserId: string | null): Promise<string | null> => {
      if (!quoUserId || !admin) return null;
      const { data } = await admin.from("sales_reps").select("id").eq("quo_user_id", quoUserId).maybeSingle();
      return data?.id ?? null;
    };

    const { createdAfter, createdBefore } = window;

    for (const inbox of inboxes) {
      const page = await quo.listCallsWithTranscripts({ inboxPhoneNumber: inbox.phoneNumber, createdAfter, createdBefore });
      for (const { call, transcript } of page.items) {
        inspected++;
        const result = await ingestQuoCall(call, transcript, repIdForQuoUser);
        if (result.error) errors.push(result.error);
        else if (result.created) ingested++;
      }
    }

    void users; // reserved for future user-level filtering/reporting

    await writeSyncLog({
      provider: "quo",
      action: "sync_now",
      status: errors.length ? "error" : "success",
      payloadReference: `inspected=${inspected} ingested=${ingested}`,
      errorMessage: errors[0] ?? null,
    });

    return { inspected, ingested, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeSyncLog({ provider: "quo", action: "sync_now", status: "error", errorMessage: message });
    return { inspected, ingested, errors: [message] };
  }
}
