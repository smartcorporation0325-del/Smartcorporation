import { getQuoService, isQuoConfigured } from "@/services/quo";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { findOrCreateLocalContact, getPrimaryDealIdForContact, refreshStoredDealLabels } from "@/lib/matching/associate";
import { rerunAnalysisForCall } from "@/lib/pipeline/analyze";
import { writeSyncLog } from "@/lib/data/sync-logs";
import type { QuoCallDetail, QuoTranscript } from "@/services/quo/types";

// Our calls.status check constraint only allows 'completed' | 'missed' | 'voicemail' |
// 'in_progress' (underscore). Quo's own statuses include a couple of near-misses
// ("in-progress" with a hyphen, "no-answer", "abandoned") that look like exact matches
// but aren't — confirmed in production: "in-progress" alone violated the constraint
// and silently aborted an otherwise-successful sync.
function mapQuoCallStatus(status: QuoCallDetail["status"]): "completed" | "missed" | "voicemail" | "in_progress" {
  switch (status) {
    case "missed":
    case "no-answer":
    case "abandoned":
      return "missed";
    case "voicemail":
      return "voicemail";
    case "in-progress":
      return "in_progress";
    default:
      return "completed";
  }
}

export interface IngestResult {
  callId: string | null;
  created: boolean;
  transcriptReady: boolean;
  /** True when a transcript is now ready but analysis was deliberately deferred (see skipAnalysis). */
  needsAnalysis: boolean;
  error?: string;
}

/**
 * Ingests one Quo call (from a webhook payload or a manual sync page) into our own
 * schema: idempotent on quo_call_id, matches/creates a local contact via the
 * association engine, stores the transcript if ready (else marks it pending), and
 * kicks off analysis only once a transcript is available. Never creates a duplicate
 * analysis for a call we've already ingested (Section 20).
 *
 * `skipAnalysis` (default false): the webhook receiver processes exactly one call per
 * request, so it can safely run analysis inline. A bulk "Sync now" over a wide date
 * range can touch dozens of calls in one request — running Claude on every one of them
 * synchronously blew past Vercel's function timeout (confirmed in production: a
 * 14-day sync of ~30 calls was killed mid-run after 300s, silently leaving whichever
 * calls hadn't been reached yet without a transcript or analysis). Bulk sync passes
 * skipAnalysis: true to keep ingestion fast, then runs a separate time-boxed analysis
 * pass afterward (see analyzePendingCalls).
 */
export async function ingestQuoCall(
  call: QuoCallDetail,
  transcript: QuoTranscript | null,
  quoUserIdToRepId: (quoUserId: string | null) => Promise<string | null>,
  options?: { skipAnalysis?: boolean }
): Promise<IngestResult> {
  const skipAnalysis = options?.skipAnalysis ?? false;
  if (!isSupabaseConfigured()) {
    return { callId: null, created: false, transcriptReady: false, needsAnalysis: false, error: "Supabase not configured — demo mode has no durable call ingest target." };
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return { callId: null, created: false, transcriptReady: false, needsAnalysis: false, error: "Supabase admin client not configured." };

  const { data: existing } = await admin
    .from("calls")
    .select("id, analysis_status, transcript_status, duration_seconds, status")
    .eq("quo_call_id", call.id)
    .maybeSingle();

  if (existing) {
    // A call first seen while still ringing/in-progress got its duration_seconds=0 and
    // status='in_progress' frozen in at insert time — nothing ever revisited those
    // fields afterward, only transcript/analysis status. Confirmed in production: a
    // real 15-minute completed call sat in the list looking like a 0-second call
    // forever. Every re-sync now refreshes duration/status from the latest Quo data.
    const freshStatus = mapQuoCallStatus(call.status);
    if (existing.duration_seconds !== call.durationSeconds || existing.status !== freshStatus) {
      await admin.from("calls").update({ duration_seconds: call.durationSeconds, status: freshStatus }).eq("id", existing.id);
    }

    // Idempotent: only act if the transcript just became ready and analysis hasn't run yet.
    if (transcript?.status === "ready" && existing.transcript_status !== "ready") {
      const transcriptText = transcript.segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
      await admin.from("call_transcripts").insert({ call_id: existing.id, transcript_text: transcriptText, source: "quo" });
      await admin.from("calls").update({ transcript_status: "ready", analysis_status: "pending" }).eq("id", existing.id);
      if (!skipAnalysis) await rerunAnalysisForCall(existing.id);
      return { callId: existing.id, created: false, transcriptReady: true, needsAnalysis: skipAnalysis };
    }
    // A transcript that's ready but whose analysis previously failed (e.g. an
    // Anthropic billing error) otherwise stays stuck forever — analyzePendingCalls
    // only picks up 'pending', never 'failed'. Requeue it so a re-sync retries.
    if (transcript?.status === "ready" && existing.analysis_status === "failed") {
      await admin.from("calls").update({ analysis_status: "pending" }).eq("id", existing.id);
      if (!skipAnalysis) await rerunAnalysisForCall(existing.id);
      return { callId: existing.id, created: false, transcriptReady: true, needsAnalysis: skipAnalysis };
    }
    return { callId: existing.id, created: false, transcriptReady: transcript?.status === "ready", needsAnalysis: false };
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
      deal_id: localContact?.dealId ?? null,
      sales_rep_id: salesRepId,
      started_at: call.createdAt,
      duration_seconds: call.durationSeconds,
      direction: call.direction,
      status: mapQuoCallStatus(call.status),
      recording_url_or_reference: call.recordingUrl,
      transcript_status: transcript?.status === "ready" ? "ready" : "pending",
      analysis_status: "none",
      source: "quo",
    })
    .select()
    .single();

  if (error || !newCall) {
    return { callId: null, created: false, transcriptReady: false, needsAnalysis: false, error: error?.message ?? "Failed to create call." };
  }

  if (transcript?.status === "ready" && transcript.segments.length) {
    const transcriptText = transcript.segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    await admin.from("call_transcripts").insert({ call_id: newCall.id, transcript_text: transcriptText, source: "quo" });
    await admin.from("calls").update({ analysis_status: "pending" }).eq("id", newCall.id);
    if (!skipAnalysis) await rerunAnalysisForCall(newCall.id);
    return { callId: newCall.id, created: true, transcriptReady: true, needsAnalysis: skipAnalysis };
  }

  return { callId: newCall.id, created: true, transcriptReady: false, needsAnalysis: false };
}

/**
 * Runs analysis for calls left in analysis_status='pending' by a skipAnalysis ingest,
 * stopping once the given time budget is spent rather than a fixed count — an 8-minute
 * call's analysis takes much longer than a 30-second one, so a count-based cap under-
 * or over-shoots the real risk (another 300s timeout). Callers re-invoke (e.g. the user
 * clicking "Sync now" again) to keep working through the backlog.
 */
export async function analyzePendingCalls(timeBudgetMs = 200_000): Promise<{ analyzed: number; remaining: number; errors: string[] }> {
  if (!isSupabaseConfigured()) return { analyzed: 0, remaining: 0, errors: [] };
  const admin = getSupabaseAdminClient();
  if (!admin) return { analyzed: 0, remaining: 0, errors: [] };

  // Include 'failed' alongside 'pending' as a safety net — most failures retry via the
  // ingest-time requeue above, but this catches any that reach 'failed' another way
  // (e.g. a direct "Re-run analysis" click that failed) without getting stuck forever.
  const { data: pending } = await admin
    .from("calls")
    .select("id")
    .eq("transcript_status", "ready")
    .in("analysis_status", ["pending", "failed"])
    .order("started_at", { ascending: false });

  const errors: string[] = [];
  let analyzed = 0;
  const startedAt = Date.now();
  const queue = pending ?? [];

  for (const { id } of queue) {
    if (Date.now() - startedAt > timeBudgetMs) break;
    try {
      const result = await rerunAnalysisForCall(id);
      if (result.status === "failed" && result.error) errors.push(result.error);
    } catch (err) {
      errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    analyzed++;
  }

  return { analyzed, remaining: queue.length - analyzed, errors };
}

/**
 * Cleans up contacts that were created from our own Quo inbox number instead of the
 * real caller — a bug in toCallDetail (services/quo/index.ts) took raw.participants[0]
 * without excluding the inbox's own number, so a call could get "matched" to itself
 * (confirmed in production: a call's stored contact phone was the "Elite Gender
 * Reveal" inbox number, not the caller). Unlinks any call pointing at such a contact
 * (nulling contact_id/deal_id so backfillCallAssociations below can re-resolve it with
 * the corrected participant), then deletes the bogus contact row itself — but only
 * when it never matched HubSpot (hubspot_contact_id null); a real HubSpot contact
 * that coincidentally shares a phone number with an inbox is left untouched.
 */
async function cleanupInboxNumberContacts(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>
): Promise<{ callsUnlinked: number; contactsRemoved: number }> {
  if (!isQuoConfigured()) return { callsUnlinked: 0, contactsRemoved: 0 };
  const inboxes = await getQuoService().listInboxes();
  const inboxNumbers = inboxes.map((i) => i.phoneNumber);
  if (!inboxNumbers.length) return { callsUnlinked: 0, contactsRemoved: 0 };

  const { data: badContacts } = await admin
    .from("contacts")
    .select("id, hubspot_contact_id")
    .in("phone", inboxNumbers);

  let callsUnlinked = 0;
  let contactsRemoved = 0;
  for (const contact of badContacts ?? []) {
    const { data: affectedCalls } = await admin.from("calls").select("id").eq("contact_id", contact.id);
    if (affectedCalls?.length) {
      await admin.from("calls").update({ contact_id: null, deal_id: null }).eq("contact_id", contact.id);
      callsUnlinked += affectedCalls.length;
    }
    if (!contact.hubspot_contact_id) {
      await admin.from("contacts").delete().eq("id", contact.id);
      contactsRemoved++;
    }
  }
  return { callsUnlinked, contactsRemoved };
}

/**
 * One-time backfill for calls ingested before findOrCreateLocalContact learned to
 * (a) retry a stale HubSpot-less local contact instead of caching it blank forever,
 * and (b) resolve a deal_id at all. Those calls already exist with contact_id and/or
 * deal_id null and nothing re-touches them on an ordinary re-sync (the "already
 * exists" path in ingestQuoCall only refreshes duration/status/transcript). Safe to
 * call repeatedly — every call it processes is one it can already prove needs work,
 * and it only ever fills in currently-null fields.
 *
 * Also runs cleanupInboxNumberContacts first, so a call previously mismatched to our
 * own inbox number gets unlinked and is picked up by the loop below in the same pass.
 *
 * Time-boxed like analyzePendingCalls: a call missing its contact needs a live Quo
 * lookup (participant phone isn't stored on our calls row) plus a HubSpot search, so
 * a large backlog can't safely run unbounded in one serverless invocation. Re-invoke
 * (e.g. clicking the button again) to keep working through what's left.
 */
export async function backfillCallAssociations(
  timeBudgetMs = 200_000
): Promise<{
  updated: number;
  stillUnresolved: number;
  remaining: number;
  callsUnlinked: number;
  contactsRemoved: number;
  dealsRelabeled: number;
  errors: string[];
}> {
  const empty = { updated: 0, stillUnresolved: 0, remaining: 0, callsUnlinked: 0, contactsRemoved: 0, dealsRelabeled: 0, errors: [] as string[] };
  if (!isSupabaseConfigured()) return empty;
  const admin = getSupabaseAdminClient();
  if (!admin) return empty;

  const { callsUnlinked, contactsRemoved } = await cleanupInboxNumberContacts(admin);
  const { updated: dealsRelabeled, errors: dealLabelErrors } = await refreshStoredDealLabels();

  const { data: candidates } = await admin
    .from("calls")
    .select("id, quo_call_id, contact_id, deal_id")
    .or("contact_id.is.null,deal_id.is.null")
    .not("quo_call_id", "is", null)
    .order("started_at", { ascending: false });

  const queue = candidates ?? [];
  const errors: string[] = [];
  let updated = 0;
  let stillUnresolved = 0;
  const startedAt = Date.now();
  const quo = isQuoConfigured() ? getQuoService() : null;

  for (const row of queue) {
    if (Date.now() - startedAt > timeBudgetMs) break;
    try {
      if (row.contact_id) {
        // Contact already resolved, just deal_id is missing — no Quo call needed.
        const dealId = await getPrimaryDealIdForContact(admin, row.contact_id);
        if (dealId) {
          await admin.from("calls").update({ deal_id: dealId }).eq("id", row.id);
          updated++;
        } else {
          stillUnresolved++;
        }
        continue;
      }

      if (!quo) {
        stillUnresolved++;
        continue;
      }
      const fetched = await quo.getCallWithTranscript(row.quo_call_id as string);
      const phone = fetched?.call.participantPhoneNumber ?? null;
      if (!phone) {
        stillUnresolved++;
        continue;
      }
      const localContact = await findOrCreateLocalContact({ phone });
      if (localContact) {
        await admin
          .from("calls")
          .update({ contact_id: localContact.contactId, deal_id: localContact.dealId })
          .eq("id", row.id);
        updated++;
      } else {
        stillUnresolved++;
      }
    } catch (err) {
      errors.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const processed = updated + stillUnresolved + errors.length;
  return {
    updated,
    stillUnresolved,
    remaining: queue.length - processed,
    callsUnlinked,
    contactsRemoved,
    dealsRelabeled,
    errors: [...dealLabelErrors, ...errors],
  };
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
): Promise<{ inspected: number; ingested: number; analyzed: number; pendingAnalysis: number; errors: string[] }> {
  if (!isQuoConfigured()) {
    const message = "QUO_API_KEY is not configured — nothing to sync. Demo data is already loaded.";
    await writeSyncLog({ provider: "quo", action: "sync_now", status: "error", errorMessage: message });
    return { inspected: 0, ingested: 0, analyzed: 0, pendingAnalysis: 0, errors: [message] };
  }

  const quo = getQuoService();
  const errors: string[] = [];
  let inspected = 0;
  let ingested = 0;

  // Vercel kills this whole request at 300s. A wide window (e.g. 14 days) can involve
  // dozens of sequential Quo API calls just to ingest — confirmed in production, that
  // alone ate the full 300s and left zero budget for analysis, timing out with nothing
  // recorded at all. Split the budget explicitly: ingestion gets up to 150s, leaving
  // the rest (capped at 120s) for analysis, with margin before the hard 300s cutoff.
  const syncStartedAt = Date.now();
  const ingestionDeadline = syncStartedAt + 150_000;

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

    // A repeat sync of the same window otherwise re-fetches the transcript + summary
    // for every call it's already stored, every single click — confirmed as the
    // dominant time cost on a re-sync (2 HTTP calls per already-known call). Skip
    // those; ingestQuoCall's idempotent check already no-ops on them regardless.
    const knownReadyCallIds = new Set<string>();
    if (admin) {
      const { data: knownReady } = await admin.from("calls").select("quo_call_id").eq("transcript_status", "ready").not("quo_call_id", "is", null);
      for (const row of knownReady ?? []) if (row.quo_call_id) knownReadyCallIds.add(row.quo_call_id);
    }

    // Ingestion only (no Claude calls here) — a wide date range can cover dozens of
    // calls, and running analysis inline for every one of them blew past Vercel's
    // request timeout. See ingestQuoCall's skipAnalysis doc for the full story.
    inboxLoop: for (const inbox of inboxes) {
      const page = await quo.listCallsWithTranscripts({
        inboxPhoneNumber: inbox.phoneNumber,
        createdAfter,
        createdBefore,
        deadline: ingestionDeadline,
        skipTranscriptForCallIds: knownReadyCallIds,
      });
      for (const { call, transcript } of page.items) {
        if (Date.now() > ingestionDeadline) break inboxLoop;
        inspected++;
        // One bad call (e.g. an unexpected HubSpot response while matching) must not
        // abort the rest of a multi-call batch — confirmed in production: a single
        // unhandled error here silently killed an entire 30-call sync.
        try {
          const result = await ingestQuoCall(call, transcript, repIdForQuoUser, { skipAnalysis: true });
          if (result.error) errors.push(result.error);
          else if (result.created) ingested++;
        } catch (err) {
          errors.push(`${call.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    void users; // reserved for future user-level filtering/reporting

    // Now spend whatever's left of the request budget (capped at 120s) analyzing what
    // just got ingested, plus anything left pending from an earlier sync.
    // Ingestion is near-instant once nothing new needs fetching (the common case on a
    // repeat sync), so most of the request's remaining time is free for analysis —
    // the old 120s cap left most of a 300s request unused and meant a large pending
    // backlog only cleared one call per click. Give analysis nearly everything that's
    // left, capped short of the hard 300s Vercel limit for overhead margin.
    const analysisBudgetMs = Math.max(0, 270_000 - (Date.now() - syncStartedAt));
    const { analyzed, remaining, errors: analysisErrors } = await analyzePendingCalls(analysisBudgetMs);
    errors.push(...analysisErrors);

    await writeSyncLog({
      provider: "quo",
      action: "sync_now",
      status: errors.length ? "error" : "success",
      payloadReference: `inspected=${inspected} ingested=${ingested} analyzed=${analyzed} pending=${remaining}`,
      errorMessage: errors[0] ?? null,
    });

    return { inspected, ingested, analyzed, pendingAnalysis: remaining, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeSyncLog({ provider: "quo", action: "sync_now", status: "error", errorMessage: message });
    return { inspected, ingested, analyzed: 0, pendingAnalysis: 0, errors: [message] };
  }
}
