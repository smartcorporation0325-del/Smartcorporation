// Hand-written domain types mirroring supabase/migrations/0001_init.sql.
// Kept separate from the Zod-validated AI output types (see services/anthropic/schema.ts):
// these are SOURCE DATA + stored AI interpretation rows, never the raw model response.

export type DealStatus = "open" | "closed_won" | "closed_lost";
export type CallDirection = "inbound" | "outbound" | "unknown";
export type CallStatus = "completed" | "missed" | "voicemail" | "in_progress";
export type TranscriptStatus = "none" | "pending" | "ready" | "failed";
export type AnalysisStatus = "none" | "pending" | "completed" | "failed";
export type CallSource = "quo" | "manual";
export type Severity = "low" | "medium" | "high";
export type Priority = "low" | "medium" | "high";

export interface SalesRep {
  id: string;
  name: string;
  email: string | null;
  quo_user_id: string | null;
  hubspot_owner_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  hubspot_contact_id: string | null;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  hubspot_deal_id: string | null;
  contact_id: string | null;
  deal_name: string | null;
  stage: string | null;
  pipeline: string | null;
  amount: number | null;
  status: DealStatus;
  owner_id: string | null;
  close_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  quo_call_id: string | null;
  quo_inbox_id: string | null;
  quo_conversation_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  sales_rep_id: string | null;
  call_type: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  direction: CallDirection;
  status: CallStatus;
  recording_url_or_reference: string | null;
  transcript_status: TranscriptStatus;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
  source: CallSource;
  created_at: string;
}

export interface CallTranscript {
  id: string;
  call_id: string;
  transcript_text: string | null;
  transcript_json: unknown;
  source: "quo" | "manual_upload" | "manual_paste";
  speaker_mapping: unknown;
  created_at: string;
}

export interface ScorecardTemplate {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  version: number;
  created_at: string;
}

export interface ScorecardSection {
  id: string;
  scorecard_template_id: string;
  name: string;
  weight: number;
  description: string | null;
  sort_order: number;
}

export interface ScorecardCriterion {
  id: string;
  section_id: string;
  name: string;
  description: string | null;
  max_score: number;
  guidance: string | null;
  required: boolean;
  sort_order: number;
}

export interface CallAnalysis {
  id: string;
  call_id: string;
  scorecard_template_id: string | null;
  overall_score: number | null;
  summary: string | null;
  call_outcome: string | null;
  close_probability: number | null;
  sentiment: string | null;
  buying_intent: "low" | "medium" | "high" | null;
  customer_intent: string | null;
  coaching_summary: string | null;
  manager_summary: string | null;
  why_this_matters: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  deal_risk_factors: string[] | null;
  follow_up_assessment: Record<string, unknown> | null;
  follow_up_sms: string | null;
  follow_up_email: string | null;
  hubspot_synced_at: string | null;
  hubspot_note_id: string | null;
  hubspot_task_id: string | null;
  hubspot_pushed_fields: string[] | null;
  raw_response: unknown;
  analyzed_at: string;
  model_used: string | null;
  prompt_version: string | null;
}

export interface CriterionScore {
  id: string;
  call_analysis_id: string;
  criterion_id: string | null;
  section_name: string | null;
  criterion_name: string | null;
  score: number | null;
  max_score: number | null;
  explanation: string | null;
  evidence: string | null;
}

export interface Objection {
  id: string;
  call_analysis_id: string;
  objection_type: string | null;
  objection_text: string | null;
  evidence: string | null;
  severity: Severity | null;
  handled: boolean | null;
  handling_quality: number | null;
  recommended_response: string | null;
}

export interface BuyingSignal {
  id: string;
  call_analysis_id: string;
  type: string | null;
  evidence: string | null;
  strength: Severity | null;
}

export interface MissedOpportunity {
  id: string;
  call_analysis_id: string;
  category: string | null;
  description: string | null;
  recommended_action: string | null;
}

export type ActionType = "send_material" | "call" | "email" | "text" | "schedule_meeting" | "internal_task" | "other";

export interface NextAction {
  id: string;
  call_analysis_id: string;
  action_type: ActionType | null;
  action: string | null;
  owner: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: Priority | null;
  close_strategy: string | null;
  completed: boolean;
}

export interface CoachingInsight {
  id: string;
  call_analysis_id: string;
  category: string | null;
  strength_or_weakness: "strength" | "weakness" | null;
  insight: string | null;
  recommendation: string | null;
}

export interface SyncLog {
  id: string;
  provider: "quo" | "hubspot" | "anthropic" | "supabase";
  action: string;
  status: "success" | "error" | "pending";
  payload_reference: string | null;
  error_message: string | null;
  created_at: string;
}

export interface IntegrationSetting {
  id: string;
  provider: string;
  enabled: boolean;
  configuration_json: Record<string, unknown>;
  last_sync_at: string | null;
}

export interface Alert {
  id: string;
  call_id: string | null;
  deal_id: string | null;
  rule_key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string | null;
  resolved: boolean;
  created_at: string;
}

// Composite shape used throughout the UI: a call plus everything needed to render it
// without a dozen separate round trips.
export interface CallWithRelations extends Call {
  contact: Contact | null;
  deal: Deal | null;
  sales_rep: SalesRep | null;
  transcript: CallTranscript | null;
  analysis: CallAnalysisFull | null;
}

export interface CallAnalysisFull extends CallAnalysis {
  criterion_scores: CriterionScore[];
  objections: Objection[];
  buying_signals: BuyingSignal[];
  missed_opportunities: MissedOpportunity[];
  next_actions: NextAction[];
  coaching_insights: CoachingInsight[];
}
