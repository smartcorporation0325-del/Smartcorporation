-- Elite Marry Me — Sales Call Intelligence Platform
-- Initial schema (Phase 1)

create extension if not exists "pgcrypto";

-- ============================================================
-- Core reference tables
-- ============================================================

create table sales_reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  quo_user_id text,
  hubspot_owner_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  hubspot_contact_id text unique,
  firstname text,
  lastname text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contacts_phone on contacts (phone);
create index idx_contacts_email on contacts (email);

create table deals (
  id uuid primary key default gen_random_uuid(),
  hubspot_deal_id text unique,
  contact_id uuid references contacts (id) on delete set null,
  deal_name text,
  stage text,
  pipeline text,
  amount numeric,
  status text check (status in ('open', 'closed_won', 'closed_lost')) default 'open',
  owner_id uuid references sales_reps (id) on delete set null,
  close_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deals_contact on deals (contact_id);
create index idx_deals_owner on deals (owner_id);
create index idx_deals_status on deals (status);

-- ============================================================
-- Calls
-- ============================================================

create table calls (
  id uuid primary key default gen_random_uuid(),
  quo_call_id text unique,
  contact_id uuid references contacts (id) on delete set null,
  deal_id uuid references deals (id) on delete set null,
  sales_rep_id uuid references sales_reps (id) on delete set null,
  call_type text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  direction text check (direction in ('inbound', 'outbound', 'unknown')) default 'unknown',
  status text check (status in ('completed', 'missed', 'voicemail', 'in_progress')) default 'completed',
  recording_url_or_reference text,
  transcript_status text check (transcript_status in ('none', 'pending', 'ready', 'failed')) default 'none',
  analysis_status text check (analysis_status in ('none', 'pending', 'completed', 'failed')) default 'none',
  analysis_error text,
  source text check (source in ('quo', 'manual')) default 'manual',
  created_at timestamptz not null default now()
);
create index idx_calls_rep on calls (sales_rep_id);
create index idx_calls_deal on calls (deal_id);
create index idx_calls_contact on calls (contact_id);
create index idx_calls_started_at on calls (started_at);
create index idx_calls_analysis_status on calls (analysis_status);

create table call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,
  transcript_text text,
  transcript_json jsonb,
  source text check (source in ('quo', 'manual_upload', 'manual_paste')) default 'manual_paste',
  speaker_mapping jsonb,
  created_at timestamptz not null default now()
);
create index idx_transcripts_call on call_transcripts (call_id);

-- ============================================================
-- Scorecards (versioned)
-- ============================================================

create table scorecard_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create table scorecard_sections (
  id uuid primary key default gen_random_uuid(),
  scorecard_template_id uuid not null references scorecard_templates (id) on delete cascade,
  name text not null,
  weight numeric not null,
  description text,
  sort_order integer not null default 0
);
create index idx_sections_template on scorecard_sections (scorecard_template_id);

create table scorecard_criteria (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references scorecard_sections (id) on delete cascade,
  name text not null,
  description text,
  max_score numeric not null default 10,
  guidance text,
  required boolean not null default true,
  sort_order integer not null default 0
);
create index idx_criteria_section on scorecard_criteria (section_id);

-- ============================================================
-- Analyses (AI interpretation layer — kept separate from source data)
-- ============================================================

create table call_analyses (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,
  scorecard_template_id uuid references scorecard_templates (id) on delete set null,
  overall_score numeric,
  summary text,
  call_outcome text,
  close_probability numeric,
  sentiment text,
  customer_intent text,
  coaching_summary text,
  manager_summary text,
  strengths jsonb,
  weaknesses jsonb,
  deal_risk_factors jsonb,
  follow_up_assessment jsonb,
  raw_response jsonb,
  analyzed_at timestamptz not null default now(),
  model_used text,
  prompt_version text
);
create index idx_analyses_call on call_analyses (call_id);

create table criterion_scores (
  id uuid primary key default gen_random_uuid(),
  call_analysis_id uuid not null references call_analyses (id) on delete cascade,
  criterion_id uuid references scorecard_criteria (id) on delete set null,
  section_name text,
  criterion_name text,
  score numeric,
  max_score numeric,
  explanation text,
  evidence text
);
create index idx_criterion_scores_analysis on criterion_scores (call_analysis_id);

create table objections (
  id uuid primary key default gen_random_uuid(),
  call_analysis_id uuid not null references call_analyses (id) on delete cascade,
  objection_type text,
  objection_text text,
  evidence text,
  severity text check (severity in ('low', 'medium', 'high')),
  handled boolean,
  handling_quality numeric,
  recommended_response text
);
create index idx_objections_analysis on objections (call_analysis_id);
create index idx_objections_type on objections (objection_type);

create table buying_signals (
  id uuid primary key default gen_random_uuid(),
  call_analysis_id uuid not null references call_analyses (id) on delete cascade,
  type text,
  evidence text,
  strength text check (strength in ('low', 'medium', 'high'))
);
create index idx_buying_signals_analysis on buying_signals (call_analysis_id);

create table missed_opportunities (
  id uuid primary key default gen_random_uuid(),
  call_analysis_id uuid not null references call_analyses (id) on delete cascade,
  category text,
  description text,
  recommended_action text
);
create index idx_missed_opps_analysis on missed_opportunities (call_analysis_id);

create table next_actions (
  id uuid primary key default gen_random_uuid(),
  call_analysis_id uuid not null references call_analyses (id) on delete cascade,
  action text,
  owner text,
  due_date date,
  priority text check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false
);
create index idx_next_actions_analysis on next_actions (call_analysis_id);

create table coaching_insights (
  id uuid primary key default gen_random_uuid(),
  call_analysis_id uuid not null references call_analyses (id) on delete cascade,
  category text,
  strength_or_weakness text check (strength_or_weakness in ('strength', 'weakness')),
  insight text,
  recommendation text
);
create index idx_coaching_insights_analysis on coaching_insights (call_analysis_id);

-- ============================================================
-- Integrations / Sync
-- ============================================================

create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  provider text check (provider in ('quo', 'hubspot', 'anthropic', 'supabase')) not null,
  action text not null,
  status text check (status in ('success', 'error', 'pending')) not null,
  payload_reference text,
  error_message text,
  created_at timestamptz not null default now()
);
create index idx_sync_logs_provider on sync_logs (provider, created_at desc);

create table integration_settings (
  id uuid primary key default gen_random_uuid(),
  provider text unique not null,
  enabled boolean not null default false,
  configuration_json jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz
);

-- ============================================================
-- Alerts (deterministic + AI-assisted rule evaluations)
-- ============================================================

create table alerts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references calls (id) on delete cascade,
  deal_id uuid references deals (id) on delete cascade,
  rule_key text not null,
  severity text check (severity in ('info', 'warning', 'critical')) not null default 'warning',
  title text not null,
  description text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_alerts_call on alerts (call_id);
create index idx_alerts_resolved on alerts (resolved);

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_contacts_updated_at before update on contacts
  for each row execute function set_updated_at();
create trigger trg_deals_updated_at before update on deals
  for each row execute function set_updated_at();
