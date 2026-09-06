import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAllCalls, getManualCallById } from "@/lib/data/manual-store";
import type { CallAnalysisFull, CallWithRelations } from "@/types/db";

const CALL_SELECT = `
  *,
  contact:contacts(*),
  deal:deals(*),
  sales_rep:sales_reps(*),
  transcript:call_transcripts(*),
  analysis:call_analyses(
    *,
    criterion_scores(*),
    objections(*),
    buying_signals(*),
    missed_opportunities(*),
    next_actions(*),
    coaching_insights(*)
  )
`;

export interface CallFilters {
  repId?: string;
  stage?: string;
  outcome?: string;
  minScore?: number;
  maxScore?: number;
  objectionType?: string;
  status?: "open" | "closed_won" | "closed_lost";
  search?: string;
  needsAttention?: boolean;
}

type RawJoinRow = Record<string, unknown>;

function normalizeCall(row: RawJoinRow): CallWithRelations {
  const rawAnalysis = row.analysis;
  const analysisRow = (Array.isArray(rawAnalysis) ? rawAnalysis[0] : rawAnalysis) as RawJoinRow | null | undefined;
  const rawTranscript = row.transcript;
  const transcript = (Array.isArray(rawTranscript) ? rawTranscript[0] : rawTranscript) as RawJoinRow | null | undefined;

  return {
    ...row,
    transcript: transcript ?? null,
    analysis: analysisRow
      ? ({
          ...analysisRow,
          criterion_scores: analysisRow.criterion_scores ?? [],
          objections: analysisRow.objections ?? [],
          buying_signals: analysisRow.buying_signals ?? [],
          missed_opportunities: analysisRow.missed_opportunities ?? [],
          next_actions: analysisRow.next_actions ?? [],
          coaching_insights: analysisRow.coaching_insights ?? [],
        } as CallAnalysisFull)
      : null,
  } as CallWithRelations;
}

function applyDemoFilters(calls: CallWithRelations[], filters: CallFilters): CallWithRelations[] {
  return calls.filter((c) => {
    if (filters.repId && c.sales_rep_id !== filters.repId) return false;
    if (filters.stage && c.deal?.stage !== filters.stage) return false;
    if (filters.outcome && c.analysis?.call_outcome !== filters.outcome) return false;
    if (filters.status && c.deal?.status !== filters.status) return false;
    if (filters.minScore != null && (c.analysis?.overall_score ?? 0) < filters.minScore) return false;
    if (filters.maxScore != null && (c.analysis?.overall_score ?? 100) > filters.maxScore) return false;
    if (filters.objectionType && !c.analysis?.objections.some((o) => o.objection_type === filters.objectionType))
      return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const name = `${c.contact?.firstname ?? ""} ${c.contact?.lastname ?? ""}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    if (filters.needsAttention && !callNeedsAttention(c)) return false;
    return true;
  });
}

export function callNeedsAttention(c: CallWithRelations): boolean {
  const a = c.analysis;
  if (!a) return false;
  const hasOpenNextAction = a.next_actions.some((n) => !n.completed);
  const hotNoNextStep = (a.close_probability ?? 0) >= 75 && !hasOpenNextAction && c.deal?.status === "open";
  const closingSection = a.criterion_scores.find((cs) => cs.section_name === "Closing");
  const noClosingAttempt =
    a.buying_signals.length > 0 &&
    closingSection != null &&
    (closingSection.max_score ?? 0) > 0 &&
    (closingSection.score ?? 0) / (closingSection.max_score ?? 1) < 0.5;
  const strongPriceObjection = a.objections.some((o) => o.objection_type === "price" && o.severity === "high" && !o.handled);
  const highValueLowScore = (c.deal?.amount ?? 0) >= 6000 && (a.overall_score ?? 100) < 60;
  const followUpOverdue =
    a.follow_up_assessment && (a.follow_up_assessment as { quality?: string }).quality !== "clear" && c.deal?.status === "open";
  return Boolean(hotNoNextStep || noClosingAttempt || strongPriceObjection || highValueLowScore || followUpOverdue);
}

export async function getCalls(filters: CallFilters = {}): Promise<CallWithRelations[]> {
  if (!isSupabaseConfigured()) {
    return applyDemoFilters(getAllCalls(), filters).sort(
      (a, b) => new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime()
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase.from("calls").select(CALL_SELECT).order("started_at", { ascending: false });
  if (filters.repId) query = query.eq("sales_rep_id", filters.repId);

  const { data, error } = await query;
  if (error) {
    console.error("getCalls query failed", error.message);
    return [];
  }
  const normalized = (data ?? []).map(normalizeCall);
  return applyDemoFilters(normalized, filters);
}

export async function getCallById(id: string): Promise<CallWithRelations | null> {
  if (!isSupabaseConfigured()) {
    return getManualCallById(id) ?? null;
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("calls").select(CALL_SELECT).eq("id", id).maybeSingle();
  if (error || !data) {
    if (error) console.error("getCallById query failed", error.message);
    return null;
  }
  return normalizeCall(data);
}
