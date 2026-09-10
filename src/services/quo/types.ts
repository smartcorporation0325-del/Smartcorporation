// Quo (formerly OpenPhone) adapter types.
//
// Grounded against Quo's actual API shape (confirmed via Quo's own MCP tool contracts
// and public docs snippets — direct doc fetches to quo.com/openphone.com are blocked
// by this environment's egress proxy, so this is the best-verified shape available):
//
// - Base URL https://api.openphone.com (override via QUO_API_BASE_URL), API-key auth
//   via `Authorization` header (no "Bearer" prefix), JSON over HTTPS, cursor-based
//   pagination (`pageToken`), rate limited ~10 req/s.
// - Calls are scoped by INBOX (a workspace phone number / "PN..." id), not fetched by
//   a global call-list endpoint. You list calls/transcripts for one inbox, optionally
//   filtered by participant phone number, user id ("US..."), and a created-at window.
// - Every call/activity id has the "AC..." prefix; conversation (thread) ids are
//   "CN...". Transcripts and voicemails are produced asynchronously — a call can be
//   returned before its transcript is ready ("pending"/"in-progress"), matching our
//   own transcript_status pending -> ready flow.
// - Webhooks: Quo supports a `call-transcripts` webhook topic (fires when a call's
//   transcript finishes processing) in addition to call-completed style events.

export interface QuoInbox {
  id: string; // "PN..."
  phoneNumber: string; // E.164
  assignedUserIds: string[];
}

export interface QuoUser {
  id: string; // "US..."
  name: string;
  email: string | null;
  role?: string;
}

export interface QuoCallSummary {
  id: string; // activity id, "AC..."
  conversationId: string | null; // "CN..."
  inboxId: string; // "PN..." — distinct from inboxPhoneNumber, needed to build a my.quo.com link
  inboxPhoneNumber: string;
  participantPhoneNumber: string | null;
  userId: string | null; // Quo user who handled the call, if any (null if AI-handled)
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "no-answer" | "abandoned" | "voicemail" | "in-progress";
  createdAt: string; // ISO 8601 UTC
  durationSeconds: number | null;
}

export interface QuoCallDetail extends QuoCallSummary {
  recordingUrl: string | null;
}

export interface QuoTranscriptSegment {
  speaker: string;
  text: string;
  startSeconds: number | null;
}

export interface QuoTranscript {
  callId: string; // activity id
  status: "pending" | "ready" | "failed";
  segments: QuoTranscriptSegment[];
  aiSummary: string | null;
}

export interface QuoListCallsParams {
  inboxPhoneNumber: string;
  participantPhoneNumber?: string;
  userId?: string;
  createdAfter?: string;
  createdBefore?: string;
  pageToken?: string;
  maxResults?: number;
  /** Absolute Date.now()-style deadline (ms). A wide window can involve many
   *  sequential Quo API calls; the conversation-discovery path stops and returns
   *  whatever it's gathered so far once this passes, rather than risk a hard
   *  serverless timeout that returns nothing at all. */
  deadline?: number;
  /** quo_call_id values we've already fully stored (transcript_status = 'ready').
   *  Every re-sync of the same window otherwise re-fetches the transcript + summary
   *  for calls we already have — confirmed as the dominant cost on a repeat sync
   *  (~2 HTTP calls per already-known call, every single click). Calls in this set
   *  get `transcript: null` without a fetch; the caller's idempotent ingest already
   *  no-ops on those, so nothing is lost by skipping. */
  skipTranscriptForCallIds?: Set<string>;
}

export interface QuoPage<T> {
  items: T[];
  nextPageToken: string | null;
}

export interface QuoWebhookEvent {
  id: string;
  type: string; // e.g. "call-transcripts.completed", "call.completed"
  callId: string;
  payload: unknown;
}
