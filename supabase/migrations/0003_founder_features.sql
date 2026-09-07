-- Founder-facing features: buying intent, smart next actions, suggested follow-up
-- messages, "why this matters", and the approve-and-push-to-HubSpot audit trail.
-- Deal risk and call quality badges are intentionally NOT stored columns — they are
-- computed at read time from existing fields by simple, readable rule functions
-- (see src/lib/rules/*.ts), per the "no black-box score" requirement.

alter table call_analyses
  add column if not exists buying_intent text check (buying_intent in ('low', 'medium', 'high')),
  add column if not exists why_this_matters text,
  add column if not exists follow_up_sms text,
  add column if not exists follow_up_email text,
  add column if not exists hubspot_synced_at timestamptz,
  add column if not exists hubspot_note_id text,
  add column if not exists hubspot_task_id text,
  add column if not exists hubspot_pushed_fields jsonb;

alter table next_actions
  add column if not exists action_type text check (
    action_type in ('send_material', 'call', 'email', 'text', 'schedule_meeting', 'internal_task', 'other')
  ),
  add column if not exists due_time text,
  add column if not exists close_strategy text;
