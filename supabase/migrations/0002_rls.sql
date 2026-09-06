-- Basic RLS: any authenticated user (Admin/Manager/Rep — MVP treats all as internal staff)
-- can read all rows. All writes go through server-side code using the service role key,
-- which bypasses RLS, so no write policies are defined here for MVP.

alter table sales_reps enable row level security;
alter table contacts enable row level security;
alter table deals enable row level security;
alter table calls enable row level security;
alter table call_transcripts enable row level security;
alter table scorecard_templates enable row level security;
alter table scorecard_sections enable row level security;
alter table scorecard_criteria enable row level security;
alter table call_analyses enable row level security;
alter table criterion_scores enable row level security;
alter table objections enable row level security;
alter table buying_signals enable row level security;
alter table missed_opportunities enable row level security;
alter table next_actions enable row level security;
alter table coaching_insights enable row level security;
alter table sync_logs enable row level security;
alter table integration_settings enable row level security;
alter table alerts enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'sales_reps','contacts','deals','calls','call_transcripts',
      'scorecard_templates','scorecard_sections','scorecard_criteria',
      'call_analyses','criterion_scores','objections','buying_signals',
      'missed_opportunities','next_actions','coaching_insights',
      'sync_logs','integration_settings','alerts'
    ])
  loop
    execute format(
      'create policy "authenticated_read_%1$s" on %1$s for select using (auth.role() = ''authenticated'');',
      t
    );
  end loop;
end $$;
