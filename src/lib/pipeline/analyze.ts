import { randomUUID } from "crypto";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveScorecardTemplate, toScorecardForPrompt } from "@/lib/data/scorecard";
import { runCallAnalysis, AnalysisValidationError, type ScorecardForPrompt } from "@/services/anthropic";
import { addManualCall, updateManualCall, getManualCallById } from "@/lib/data/manual-store";
import { FEDERICO } from "@/lib/demo/seed-data";
import type {
  CallAnalysisFull,
  CallWithRelations,
  BuyingSignal,
  CoachingInsight,
  CriterionScore,
  MissedOpportunity,
  NextAction,
  Objection,
} from "@/types/db";
import type { CallAnalysisResult } from "@/services/anthropic/schema";

// ============================================================================
// The analysis pipeline (Section 30):
// ingest -> normalize -> associate CRM -> validate transcript -> prepare AI context
// -> run analysis -> validate structured response -> store results -> (alerts are
// derived at read time from stored data, see lib/data/dashboard.ts)
//
// Source data (transcript text, CRM fields, call metadata) is never overwritten by
// AI interpretation (Section 31) — this function only ever creates new call_analyses
// rows; it never mutates the calls/contacts/deals tables' factual fields.
// ============================================================================

export interface ManualCallInput {
  contactFirstName: string;
  contactLastName: string;
  contactEmail?: string;
  contactPhone?: string;
  callType: string;
  dealName?: string;
  dealStage?: string;
  dealAmount?: number;
  dealStatus?: "open" | "closed_won" | "closed_lost";
  transcriptText: string;
}

export interface PipelineResult {
  callId: string;
  status: "completed" | "failed";
  error?: string;
}

export async function runManualCallPipeline(input: ManualCallInput): Promise<PipelineResult> {
  const transcriptText = input.transcriptText.trim();
  if (!transcriptText) {
    return { callId: "", status: "failed", error: "Transcript text is required." };
  }

  const scorecardTemplate = await getActiveScorecardTemplate();
  const scorecardForPrompt = toScorecardForPrompt(scorecardTemplate);

  if (isSupabaseConfigured()) {
    return runManualPipelineSupabase(input, transcriptText, scorecardTemplate.id, scorecardForPrompt);
  }
  return runManualPipelineDemo(input, transcriptText, scorecardTemplate.id, scorecardForPrompt);
}

export async function rerunAnalysisForCall(callId: string): Promise<PipelineResult> {
  const scorecardTemplate = await getActiveScorecardTemplate();
  const scorecardForPrompt = toScorecardForPrompt(scorecardTemplate);

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    if (!admin) return { callId, status: "failed", error: "Supabase admin client not configured." };
    const { data: call } = await admin
      .from("calls")
      .select("*, contact:contacts(*), deal:deals(*), sales_rep:sales_reps(*), transcript:call_transcripts(*)")
      .eq("id", callId)
      .maybeSingle();
    if (!call) return { callId, status: "failed", error: "Call not found." };
    const transcriptRow = Array.isArray(call.transcript) ? call.transcript[0] : call.transcript;
    if (!transcriptRow?.transcript_text) {
      return { callId, status: "failed", error: "No transcript available to analyze." };
    }
    return analyzeAndStoreSupabase(admin, callId, transcriptRow.transcript_text, call, scorecardTemplate.id, scorecardForPrompt);
  }

  const existing = getManualCallById(callId);
  if (!existing?.transcript?.transcript_text) {
    return { callId, status: "failed", error: "No transcript available to analyze." };
  }
  return analyzeAndStoreDemo(callId, existing, scorecardTemplate.id, scorecardForPrompt);
}

// ---------------------------------------------------------------------------
// Demo-mode (in-memory) path
// ---------------------------------------------------------------------------

async function runManualPipelineDemo(
  input: ManualCallInput,
  transcriptText: string,
  scorecardTemplateId: string,
  scorecardForPrompt: ScorecardForPrompt
): Promise<PipelineResult> {
  const callId = `manual-${randomUUID()}`;
  const now = new Date().toISOString();
  const contactId = `manual-contact-${randomUUID()}`;
  const dealId = input.dealName ? `manual-deal-${randomUUID()}` : null;

  const call: CallWithRelations = {
    id: callId,
    quo_call_id: null,
    contact_id: contactId,
    deal_id: dealId,
    sales_rep_id: "demo-rep-federico",
    call_type: input.callType,
    started_at: now,
    ended_at: now,
    duration_seconds: null,
    direction: "unknown",
    status: "completed",
    recording_url_or_reference: null,
    transcript_status: "ready",
    analysis_status: "pending",
    analysis_error: null,
    source: "manual",
    created_at: now,
    contact: {
      id: contactId,
      hubspot_contact_id: null,
      firstname: input.contactFirstName,
      lastname: input.contactLastName,
      email: input.contactEmail ?? null,
      phone: input.contactPhone ?? null,
      created_at: now,
      updated_at: now,
    },
    deal: dealId
      ? {
          id: dealId,
          hubspot_deal_id: null,
          contact_id: contactId,
          deal_name: input.dealName ?? null,
          stage: input.dealStage ?? null,
          pipeline: "Event Bookings",
          amount: input.dealAmount ?? null,
          status: input.dealStatus ?? "open",
          owner_id: "demo-rep-federico",
          close_date: null,
          created_at: now,
          updated_at: now,
        }
      : null,
    sales_rep: FEDERICO,
    transcript: {
      id: `manual-transcript-${callId}`,
      call_id: callId,
      transcript_text: transcriptText,
      transcript_json: null,
      source: "manual_paste",
      speaker_mapping: null,
      created_at: now,
    },
    analysis: null,
  };

  addManualCall(call);
  return analyzeAndStoreDemo(callId, call, scorecardTemplateId, scorecardForPrompt);
}

async function analyzeAndStoreDemo(
  callId: string,
  call: CallWithRelations,
  scorecardTemplateId: string,
  scorecardForPrompt: ScorecardForPrompt
): Promise<PipelineResult> {
  try {
    const { result, modelUsed, promptVersion, raw } = await runCallAnalysis({
      transcriptText: call.transcript!.transcript_text!,
      crmContext: {
        contactName: `${call.contact?.firstname ?? ""} ${call.contact?.lastname ?? ""}`.trim() || null,
        dealName: call.deal?.deal_name ?? null,
        dealStage: call.deal?.stage ?? null,
        pipeline: call.deal?.pipeline ?? null,
        dealAmount: call.deal?.amount ?? null,
        dealStatus: call.deal?.status ?? null,
        leadSource: null,
        closeDate: call.deal?.close_date ?? null,
        salesRepName: "Federico",
        callType: call.call_type,
        previousCallCount: 0,
      },
      scorecard: scorecardForPrompt,
    });

    const analysis = mapResultToAnalysisFull(callId, scorecardTemplateId, result, modelUsed, promptVersion, raw);
    updateManualCall(callId, (c) => ({ ...c, analysis_status: "completed", analysis }));
    return { callId, status: "completed" };
  } catch (err) {
    const message = err instanceof AnalysisValidationError ? err.message : String(err);
    updateManualCall(callId, (c) => ({ ...c, analysis_status: "failed", analysis_error: message }));
    return { callId, status: "failed", error: message };
  }
}

// ---------------------------------------------------------------------------
// Supabase (Postgres) path
// ---------------------------------------------------------------------------

async function runManualPipelineSupabase(
  input: ManualCallInput,
  transcriptText: string,
  scorecardTemplateId: string,
  scorecardForPrompt: ScorecardForPrompt
): Promise<PipelineResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { callId: "", status: "failed", error: "Supabase admin client not configured." };

  const { data: contact, error: contactErr } = await admin
    .from("contacts")
    .insert({
      firstname: input.contactFirstName,
      lastname: input.contactLastName,
      email: input.contactEmail ?? null,
      phone: input.contactPhone ?? null,
    })
    .select()
    .single();
  if (contactErr || !contact) return { callId: "", status: "failed", error: contactErr?.message ?? "Failed to create contact." };

  let dealId: string | null = null;
  if (input.dealName) {
    const { data: deal } = await admin
      .from("deals")
      .insert({
        contact_id: contact.id,
        deal_name: input.dealName,
        stage: input.dealStage ?? null,
        pipeline: "Event Bookings",
        amount: input.dealAmount ?? null,
        status: input.dealStatus ?? "open",
      })
      .select()
      .single();
    dealId = deal?.id ?? null;
  }

  const { data: repRow } = await admin.from("sales_reps").select("id").eq("name", "Federico").maybeSingle();

  const { data: call, error: callErr } = await admin
    .from("calls")
    .insert({
      contact_id: contact.id,
      deal_id: dealId,
      sales_rep_id: repRow?.id ?? null,
      call_type: input.callType,
      started_at: new Date().toISOString(),
      status: "completed",
      transcript_status: "ready",
      analysis_status: "pending",
      source: "manual",
    })
    .select()
    .single();
  if (callErr || !call) return { callId: "", status: "failed", error: callErr?.message ?? "Failed to create call." };

  await admin.from("call_transcripts").insert({
    call_id: call.id,
    transcript_text: transcriptText,
    source: "manual_paste",
  });

  const fullCall = {
    ...call,
    contact,
    deal: dealId ? { id: dealId, deal_name: input.dealName, stage: input.dealStage, pipeline: "Event Bookings", amount: input.dealAmount, status: input.dealStatus ?? "open", close_date: null } : null,
  };

  return analyzeAndStoreSupabase(admin, call.id, transcriptText, fullCall, scorecardTemplateId, scorecardForPrompt);
}

interface CallLike {
  call_type: string | null;
  contact?: { firstname?: string | null; lastname?: string | null } | null;
  deal?: {
    deal_name?: string | null;
    stage?: string | null;
    pipeline?: string | null;
    amount?: number | null;
    status?: string | null;
    close_date?: string | null;
  } | null;
  sales_rep?: { name?: string | null } | null;
}

async function analyzeAndStoreSupabase(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  callId: string,
  transcriptText: string,
  call: CallLike,
  scorecardTemplateId: string,
  scorecardForPrompt: ScorecardForPrompt
): Promise<PipelineResult> {
  try {
    const { result, modelUsed, promptVersion, raw } = await runCallAnalysis({
      transcriptText,
      crmContext: {
        contactName: `${call.contact?.firstname ?? ""} ${call.contact?.lastname ?? ""}`.trim() || null,
        dealName: call.deal?.deal_name ?? null,
        dealStage: call.deal?.stage ?? null,
        pipeline: call.deal?.pipeline ?? null,
        dealAmount: call.deal?.amount ?? null,
        dealStatus: call.deal?.status ?? null,
        leadSource: null,
        closeDate: call.deal?.close_date ?? null,
        salesRepName: call.sales_rep?.name ?? "Federico",
        callType: call.call_type,
        previousCallCount: 0,
      },
      scorecard: scorecardForPrompt,
    });

    const { data: analysisRow, error: analysisErr } = await admin
      .from("call_analyses")
      .insert({
        call_id: callId,
        scorecard_template_id: scorecardTemplateId,
        overall_score: result.overallScore,
        summary: result.summary,
        call_outcome: result.callOutcome,
        close_probability: result.closeProbability,
        sentiment: result.sentiment,
        customer_intent: result.customerIntent,
        coaching_summary: result.coachingRecommendations.map((c) => c.recommendation).join(" "),
        manager_summary: result.managerSummary,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        deal_risk_factors: result.dealRiskFactors,
        follow_up_assessment: result.followUpAssessment,
        raw_response: raw,
        model_used: modelUsed,
        prompt_version: promptVersion,
      })
      .select()
      .single();
    if (analysisErr || !analysisRow) throw new Error(analysisErr?.message ?? "Failed to store analysis.");

    const criterionRows = result.scorecard.flatMap((section) =>
      section.criteria.map((c) => ({
        call_analysis_id: analysisRow.id,
        section_name: section.section,
        criterion_name: c.criterion,
        score: c.score,
        max_score: c.maxScore,
        explanation: c.explanation,
        evidence: c.evidence,
      }))
    );
    if (criterionRows.length) await admin.from("criterion_scores").insert(criterionRows);

    if (result.objections.length) {
      await admin.from("objections").insert(
        result.objections.map((o) => ({
          call_analysis_id: analysisRow.id,
          objection_type: o.type,
          objection_text: o.description,
          evidence: o.evidence,
          severity: o.severity,
          handled: o.handled,
          handling_quality: o.handlingQuality,
          recommended_response: o.recommendedResponse,
        }))
      );
    }
    if (result.buyingSignals.length) {
      await admin.from("buying_signals").insert(
        result.buyingSignals.map((b) => ({
          call_analysis_id: analysisRow.id,
          type: b.type,
          evidence: b.evidence,
          strength: b.strength,
        }))
      );
    }
    if (result.missedOpportunities.length) {
      await admin.from("missed_opportunities").insert(
        result.missedOpportunities.map((m) => ({
          call_analysis_id: analysisRow.id,
          category: m.category,
          description: m.description,
          recommended_action: m.recommendedAction,
        }))
      );
    }
    if (result.nextActions.length) {
      await admin.from("next_actions").insert(
        result.nextActions.map((n) => ({
          call_analysis_id: analysisRow.id,
          action: n.action,
          owner: n.owner,
          due_date: n.dueDate ?? null,
          priority: n.priority,
        }))
      );
    }
    if (result.coachingRecommendations.length) {
      await admin.from("coaching_insights").insert(
        result.coachingRecommendations.map((c) => ({
          call_analysis_id: analysisRow.id,
          category: c.category,
          strength_or_weakness: c.type,
          insight: c.insight,
          recommendation: c.recommendation,
        }))
      );
    }

    await admin.from("calls").update({ analysis_status: "completed" }).eq("id", callId);
    return { callId, status: "completed" };
  } catch (err) {
    const message = err instanceof AnalysisValidationError ? err.message : String(err);
    await admin.from("calls").update({ analysis_status: "failed", analysis_error: message }).eq("id", callId);
    return { callId, status: "failed", error: message };
  }
}

function mapResultToAnalysisFull(
  callId: string,
  scorecardTemplateId: string,
  result: CallAnalysisResult,
  modelUsed: string,
  promptVersion: string,
  raw: unknown
): CallAnalysisFull {
  const analysisId = `manual-analysis-${callId}`;
  const criterionScores: CriterionScore[] = result.scorecard.flatMap((section, si) =>
    section.criteria.map((c, ci) => ({
      id: `${analysisId}-crit-${si}-${ci}`,
      call_analysis_id: analysisId,
      criterion_id: null,
      section_name: section.section,
      criterion_name: c.criterion,
      score: c.score,
      max_score: c.maxScore,
      explanation: c.explanation,
      evidence: c.evidence,
    }))
  );
  const objections: Objection[] = result.objections.map((o, i) => ({
    id: `${analysisId}-obj-${i}`,
    call_analysis_id: analysisId,
    objection_type: o.type,
    objection_text: o.description,
    evidence: o.evidence,
    severity: o.severity,
    handled: o.handled,
    handling_quality: o.handlingQuality,
    recommended_response: o.recommendedResponse,
  }));
  const buyingSignals: BuyingSignal[] = result.buyingSignals.map((b, i) => ({
    id: `${analysisId}-signal-${i}`,
    call_analysis_id: analysisId,
    type: b.type,
    evidence: b.evidence,
    strength: b.strength,
  }));
  const missedOpportunities: MissedOpportunity[] = result.missedOpportunities.map((m, i) => ({
    id: `${analysisId}-missed-${i}`,
    call_analysis_id: analysisId,
    category: m.category,
    description: m.description,
    recommended_action: m.recommendedAction,
  }));
  const nextActions: NextAction[] = result.nextActions.map((n, i) => ({
    id: `${analysisId}-action-${i}`,
    call_analysis_id: analysisId,
    action: n.action,
    owner: n.owner,
    due_date: n.dueDate ?? null,
    priority: n.priority,
    completed: false,
  }));
  const coachingInsights: CoachingInsight[] = result.coachingRecommendations.map((c, i) => ({
    id: `${analysisId}-coach-${i}`,
    call_analysis_id: analysisId,
    category: c.category,
    strength_or_weakness: c.type,
    insight: c.insight,
    recommendation: c.recommendation,
  }));

  return {
    id: analysisId,
    call_id: callId,
    scorecard_template_id: scorecardTemplateId,
    overall_score: result.overallScore,
    summary: result.summary,
    call_outcome: result.callOutcome,
    close_probability: result.closeProbability,
    sentiment: result.sentiment,
    customer_intent: result.customerIntent,
    coaching_summary: result.coachingRecommendations.map((c) => c.recommendation).join(" "),
    manager_summary: result.managerSummary,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    deal_risk_factors: result.dealRiskFactors,
    follow_up_assessment: result.followUpAssessment,
    raw_response: raw,
    analyzed_at: new Date().toISOString(),
    model_used: modelUsed,
    prompt_version: promptVersion,
    criterion_scores: criterionScores,
    objections,
    buying_signals: buyingSignals,
    missed_opportunities: missedOpportunities,
    next_actions: nextActions,
    coaching_insights: coachingInsights,
  };
}
