-- Seeds the "Elite Marry Me - Federico Call Audit" scorecard template (sections +
-- criteria) and the Federico sales rep row into a real Supabase project. Equivalent
-- to the scorecard/rep portion of scripts/seed-supabase.ts, for projects where running
-- `npm run seed` from a terminal isn't convenient. Safe to re-run only if you first
-- delete the previously-inserted template (it does not upsert the template itself).

do $$
declare
  v_rep_id uuid;
  v_template_id uuid;
  v_section_id uuid;
begin
  -- Sales rep (Federico) — upsert on email so this part is safe to re-run.
  insert into sales_reps (name, email, quo_user_id, hubspot_owner_id, active)
  values ('Federico', 'federico@elitemarryme.com', 'demo-federico', 'demo-owner-federico', true)
  on conflict (email) do update set name = excluded.name
  returning id into v_rep_id;

  -- Scorecard template
  insert into scorecard_templates (name, description, active, version)
  values (
    'Elite Marry Me - Federico Call Audit',
    'Elite Marry Me''s standard sales call audit scorecard.',
    true,
    1
  )
  returning id into v_template_id;

  -- Section 1: Opening & Professionalism (weight 10)
  insert into scorecard_sections (scorecard_template_id, name, weight, description, sort_order)
  values (v_template_id, 'Opening & Professionalism', 10, 'First impression, tone, rapport, and control of the conversation.', 0)
  returning id into v_section_id;
  insert into scorecard_criteria (section_id, name, description, max_score, guidance, required, sort_order) values
    (v_section_id, 'Professional introduction', 'Clear, confident self-introduction and company framing.', 2, 'Clear, confident self-introduction and company framing.', true, 0),
    (v_section_id, 'Warm and confident tone', 'Tone conveys warmth without sounding scripted or nervous.', 2, 'Tone conveys warmth without sounding scripted or nervous.', true, 1),
    (v_section_id, 'Rapport', 'Rep builds genuine connection before moving to business.', 2, 'Rep builds genuine connection before moving to business.', true, 2),
    (v_section_id, 'Clear agenda', 'Rep sets expectations for what the call will cover.', 2, 'Rep sets expectations for what the call will cover.', true, 3),
    (v_section_id, 'Control of conversation', 'Rep guides pacing without being pushy.', 2, 'Rep guides pacing without being pushy.', true, 4);

  -- Section 2: Discovery (weight 20)
  insert into scorecard_sections (scorecard_template_id, name, weight, description, sort_order)
  values (v_template_id, 'Discovery', 20, 'Whether Federico actively discovered — not merely received — key event details. Do not give credit merely because the client volunteered information.', 1)
  returning id into v_section_id;
  insert into scorecard_criteria (section_id, name, description, max_score, guidance, required, sort_order) values
    (v_section_id, 'Event type', 'Confirmed the type of event (proposal, gender reveal, etc.).', 2, 'Confirmed the type of event (proposal, gender reveal, etc.).', true, 0),
    (v_section_id, 'Event date', 'Actively asked for and confirmed a target date.', 2, 'Actively asked for and confirmed a target date.', true, 1),
    (v_section_id, 'Preferred location', 'Explored location preferences, not just accepted a default.', 2, 'Explored location preferences, not just accepted a default.', true, 2),
    (v_section_id, 'Client vision', 'Drew out the client''s vision for the experience.', 3, 'Drew out the client''s vision for the experience.', true, 3),
    (v_section_id, 'Budget', 'Actively discovered real budget range, not assumed.', 3, 'Actively discovered real budget range, not assumed.', true, 4),
    (v_section_id, 'Decision makers', 'Identified who else is involved in the decision.', 2, 'Identified who else is involved in the decision.', true, 5),
    (v_section_id, 'Timeline', 'Clarified urgency and decision timeline.', 2, 'Clarified urgency and decision timeline.', true, 6),
    (v_section_id, 'Must-have elements / barriers', 'Surfaced specific priorities and potential barriers.', 4, 'Surfaced specific priorities and potential barriers.', true, 7);

  -- Section 3: Needs Understanding (weight 15)
  insert into scorecard_sections (scorecard_template_id, name, weight, description, sort_order)
  values (v_template_id, 'Needs Understanding', 15, 'Whether Federico synthesized discovery into a clear understanding of needs.', 2)
  returning id into v_section_id;
  insert into scorecard_criteria (section_id, name, description, max_score, guidance, required, sort_order) values
    (v_section_id, 'Summarizes client needs', 'Plays back what was heard in the client''s own terms.', 4, 'Plays back what was heard in the client''s own terms.', true, 0),
    (v_section_id, 'Confirms understanding', 'Explicitly checks that the summary is correct.', 3, 'Explicitly checks that the summary is correct.', true, 1),
    (v_section_id, 'Prioritizes what matters most', 'Identifies the 1-2 things that matter most to this client.', 4, 'Identifies the 1-2 things that matter most to this client.', true, 2),
    (v_section_id, 'Wants vs requirements / connects recommendation to needs', 'Distinguishes nice-to-haves from must-haves and ties recommendations back to stated needs.', 4, 'Distinguishes nice-to-haves from must-haves and ties recommendations back to stated needs.', true, 3);

  -- Section 4: Value Presentation (weight 15)
  insert into scorecard_sections (scorecard_template_id, name, weight, description, sort_order)
  values (v_template_id, 'Value Presentation', 15, 'Whether Federico built value and personalized the pitch before discussing price.', 3)
  returning id into v_section_id;
  insert into scorecard_criteria (section_id, name, description, max_score, guidance, required, sort_order) values
    (v_section_id, 'Value before price', 'Explains value before jumping to numbers, when appropriate.', 4, 'Explains value before jumping to numbers, when appropriate.', true, 0),
    (v_section_id, 'Personalizes recommendations', 'Ties the recommendation to what this specific client said.', 4, 'Ties the recommendation to what this specific client said.', true, 1),
    (v_section_id, 'Explains package differences', 'Clarifies what''s different between options rather than just listing them.', 3, 'Clarifies what''s different between options rather than just listing them.', true, 2),
    (v_section_id, 'Builds confidence / uses expertise', 'Guides the client using expertise rather than just presenting a menu.', 4, 'Guides the client using expertise rather than just presenting a menu.', true, 3);

  -- Section 5: Objection Handling (weight 20)
  insert into scorecard_sections (scorecard_template_id, name, weight, description, sort_order)
  values (v_template_id, 'Objection Handling', 20, 'For each objection: did Federico acknowledge, clarify the real concern, isolate, respond, confirm resolution, and convert it into a next step?', 4)
  returning id into v_section_id;
  insert into scorecard_criteria (section_id, name, description, max_score, guidance, required, sort_order) values
    (v_section_id, 'Acknowledged objections', 'Did not dismiss or talk over the concern.', 3, 'Did not dismiss or talk over the concern.', true, 0),
    (v_section_id, 'Clarified the real concern', 'Asked a follow-up to understand what''s really behind the objection.', 4, 'Asked a follow-up to understand what''s really behind the objection.', true, 1),
    (v_section_id, 'Isolated the objection', 'Checked whether this is the only thing standing in the way.', 3, 'Checked whether this is the only thing standing in the way.', true, 2),
    (v_section_id, 'Answered the objection', 'Gave a substantive, relevant response.', 5, 'Gave a substantive, relevant response.', true, 3),
    (v_section_id, 'Confirmed resolution', 'Checked that the response actually resolved the concern.', 3, 'Checked that the response actually resolved the concern.', true, 4),
    (v_section_id, 'Converted into a next step', 'Used the resolved objection to move the deal forward.', 2, 'Used the resolved objection to move the deal forward.', true, 5);

  -- Section 6: Closing (weight 15)
  insert into scorecard_sections (scorecard_template_id, name, weight, description, sort_order)
  values (v_template_id, 'Closing', 15, 'Natural progression toward commitment — not aggressive closing.', 5)
  returning id into v_section_id;
  insert into scorecard_criteria (section_id, name, description, max_score, guidance, required, sort_order) values
    (v_section_id, 'Identified buying signals', 'Noticed and acted on signals of interest.', 3, 'Noticed and acted on signals of interest.', true, 0),
    (v_section_id, 'Trial close', 'Checked temperature before a full close attempt.', 2, 'Checked temperature before a full close attempt.', true, 1),
    (v_section_id, 'Asked for commitment', 'Made a direct, clear ask.', 4, 'Made a direct, clear ask.', true, 2),
    (v_section_id, 'Deposit discussion', 'Raised the deposit/reservation process when appropriate.', 2, 'Raised the deposit/reservation process when appropriate.', true, 3),
    (v_section_id, 'Conditional close / clear next step', 'Used a natural conditional close and left a clear next step.', 4, 'Used a natural conditional close and left a clear next step.', true, 4);

  -- Section 7: Follow-Up Discipline (weight 5)
  insert into scorecard_sections (scorecard_template_id, name, weight, description, sort_order)
  values (v_template_id, 'Follow-Up Discipline', 5, 'Concrete, owned, time-bound follow-up — never vague.', 6)
  returning id into v_section_id;
  insert into scorecard_criteria (section_id, name, description, max_score, guidance, required, sort_order) values
    (v_section_id, 'Clear next action with owner and timeframe', 'No ''I''ll follow up sometime'' commitments.', 3, 'No ''I''ll follow up sometime'' commitments.', true, 0),
    (v_section_id, 'Materials promised are documented', 'Anything promised (photos, proposal, video) is captured as a next action.', 2, 'Anything promised (photos, proposal, video) is captured as a next action.', true, 1);

end $$;
