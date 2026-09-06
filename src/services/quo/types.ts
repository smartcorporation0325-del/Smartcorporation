// Quo (formerly OpenPhone) adapter types.
// NOTE: exact endpoint shapes are not hardcoded from memory — see index.ts header comment.
// This module defines the abstraction our app depends on; the real HTTP calls can be
// filled in against Quo's official API docs without touching any calling code.

export interface QuoCallSummary {
  id: string;
  quoUserId: string; // maps to sales_reps.quo_user_id
  direction: "inbound" | "outbound";
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  participantPhoneNumbers: string[];
  status: "completed" | "missed" | "voicemail" | "in_progress";
}

export interface QuoCallDetail extends QuoCallSummary {
  recordingReference: string | null;
  aiSummary: string | null;
}

export interface QuoTranscriptSegment {
  speaker: string;
  text: string;
  startSeconds: number | null;
}

export interface QuoTranscript {
  callId: string;
  status: "pending" | "ready" | "failed";
  segments: QuoTranscriptSegment[];
}

export interface QuoUser {
  id: string;
  name: string;
  email: string | null;
}

export interface QuoWebhookEvent {
  id: string;
  type: string;
  callId: string;
  payload: unknown;
}
