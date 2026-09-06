/**
 * Loads the Elite Marry Me demo dataset (15 seed calls + the scorecard template) into
 * a real Supabase project. Run with: npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Safe to re-run: it checks for the "Elite Marry Me - Federico Call Audit" scorecard
 * and Federico's sales rep row before re-creating them, but will insert a fresh copy
 * of the 15 demo calls each run (intended for seeding a fresh dev/demo project, not
 * for repeated production use).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ELITE_MARRY_ME_SCORECARD, ELITE_MARRY_ME_SCORECARD_NAME } from "../src/lib/demo/scorecard";
import { DEMO_CALLS, FEDERICO } from "../src/lib/demo/seed-data";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to seed a real project.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log("Seeding sales rep (Federico)...");
  const { data: rep, error: repErr } = await admin
    .from("sales_reps")
    .upsert({ name: FEDERICO.name, email: FEDERICO.email, quo_user_id: FEDERICO.quo_user_id, hubspot_owner_id: FEDERICO.hubspot_owner_id, active: true }, { onConflict: "email" })
    .select()
    .single();
  if (repErr || !rep) throw new Error(repErr?.message ?? "Failed to upsert rep");

  console.log("Seeding scorecard template...");
  const { data: template, error: templateErr } = await admin
    .from("scorecard_templates")
    .insert({ name: ELITE_MARRY_ME_SCORECARD_NAME, description: "Elite Marry Me's standard sales call audit scorecard.", active: true, version: 1 })
    .select()
    .single();
  if (templateErr || !template) throw new Error(templateErr?.message ?? "Failed to insert scorecard template");

  for (let i = 0; i < ELITE_MARRY_ME_SCORECARD.length; i++) {
    const section = ELITE_MARRY_ME_SCORECARD[i];
    const { data: sectionRow, error: sectionErr } = await admin
      .from("scorecard_sections")
      .insert({ scorecard_template_id: template.id, name: section.name, weight: section.weight, description: section.description, sort_order: i })
      .select()
      .single();
    if (sectionErr || !sectionRow) throw new Error(sectionErr?.message ?? "Failed to insert section");

    const criteriaRows = section.criteria.map((c, j) => ({
      section_id: sectionRow.id,
      name: c.name,
      description: c.guidance,
      max_score: c.maxScore,
      guidance: c.guidance,
      required: true,
      sort_order: j,
    }));
    const { error: criteriaErr } = await admin.from("scorecard_criteria").insert(criteriaRows);
    if (criteriaErr) throw new Error(criteriaErr.message);
  }

  console.log(`Seeding ${DEMO_CALLS.length} demo calls...`);
  for (const call of DEMO_CALLS) {
    const { data: contact, error: contactErr } = await admin
      .from("contacts")
      .insert({
        firstname: call.contact?.firstname,
        lastname: call.contact?.lastname,
        email: call.contact?.email,
        phone: call.contact?.phone,
      })
      .select()
      .single();
    if (contactErr || !contact) throw new Error(contactErr?.message ?? "Failed to insert contact");

    let dealId: string | null = null;
    if (call.deal) {
      const { data: deal, error: dealErr } = await admin
        .from("deals")
        .insert({
          contact_id: contact.id,
          deal_name: call.deal.deal_name,
          stage: call.deal.stage,
          pipeline: call.deal.pipeline,
          amount: call.deal.amount,
          status: call.deal.status,
          owner_id: rep.id,
          close_date: call.deal.close_date,
        })
        .select()
        .single();
      if (dealErr || !deal) throw new Error(dealErr?.message ?? "Failed to insert deal");
      dealId = deal.id;
    }

    const { data: callRow, error: callErr } = await admin
      .from("calls")
      .insert({
        contact_id: contact.id,
        deal_id: dealId,
        sales_rep_id: rep.id,
        call_type: call.call_type,
        started_at: call.started_at,
        ended_at: call.ended_at,
        duration_seconds: call.duration_seconds,
        direction: call.direction,
        status: call.status,
        transcript_status: "ready",
        analysis_status: "completed",
        source: "manual",
      })
      .select()
      .single();
    if (callErr || !callRow) throw new Error(callErr?.message ?? "Failed to insert call");

    await admin.from("call_transcripts").insert({
      call_id: callRow.id,
      transcript_text: call.transcript?.transcript_text,
      transcript_json: call.transcript?.transcript_json,
      source: "manual_paste",
    });

    const a = call.analysis!;
    const { data: analysisRow, error: analysisErr } = await admin
      .from("call_analyses")
      .insert({
        call_id: callRow.id,
        scorecard_template_id: template.id,
        overall_score: a.overall_score,
        summary: a.summary,
        call_outcome: a.call_outcome,
        close_probability: a.close_probability,
        sentiment: a.sentiment,
        customer_intent: a.customer_intent,
        coaching_summary: a.coaching_summary,
        manager_summary: a.manager_summary,
        strengths: a.strengths,
        weaknesses: a.weaknesses,
        deal_risk_factors: a.deal_risk_factors,
        follow_up_assessment: a.follow_up_assessment,
        model_used: a.model_used,
        prompt_version: a.prompt_version,
      })
      .select()
      .single();
    if (analysisErr || !analysisRow) throw new Error(analysisErr?.message ?? "Failed to insert analysis");

    if (a.criterion_scores.length) {
      await admin.from("criterion_scores").insert(
        a.criterion_scores.map((cs) => ({
          call_analysis_id: analysisRow.id,
          section_name: cs.section_name,
          criterion_name: cs.criterion_name,
          score: cs.score,
          max_score: cs.max_score,
          explanation: cs.explanation,
          evidence: cs.evidence,
        }))
      );
    }
    if (a.objections.length) {
      await admin.from("objections").insert(
        a.objections.map((o) => ({
          call_analysis_id: analysisRow.id,
          objection_type: o.objection_type,
          objection_text: o.objection_text,
          evidence: o.evidence,
          severity: o.severity,
          handled: o.handled,
          handling_quality: o.handling_quality,
          recommended_response: o.recommended_response,
        }))
      );
    }
    if (a.buying_signals.length) {
      await admin.from("buying_signals").insert(
        a.buying_signals.map((b) => ({ call_analysis_id: analysisRow.id, type: b.type, evidence: b.evidence, strength: b.strength }))
      );
    }
    if (a.missed_opportunities.length) {
      await admin.from("missed_opportunities").insert(
        a.missed_opportunities.map((m) => ({
          call_analysis_id: analysisRow.id,
          category: m.category,
          description: m.description,
          recommended_action: m.recommended_action,
        }))
      );
    }
    if (a.next_actions.length) {
      await admin.from("next_actions").insert(
        a.next_actions.map((n) => ({
          call_analysis_id: analysisRow.id,
          action: n.action,
          owner: n.owner,
          due_date: n.due_date,
          priority: n.priority,
          completed: n.completed,
        }))
      );
    }
    if (a.coaching_insights.length) {
      await admin.from("coaching_insights").insert(
        a.coaching_insights.map((c) => ({
          call_analysis_id: analysisRow.id,
          category: c.category,
          strength_or_weakness: c.strength_or_weakness,
          insight: c.insight,
          recommendation: c.recommendation,
        }))
      );
    }

    console.log(`  ✓ ${call.contact?.firstname} ${call.contact?.lastname}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
