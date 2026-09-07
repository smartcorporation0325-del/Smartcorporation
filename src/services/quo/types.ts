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
