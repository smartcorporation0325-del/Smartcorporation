import { z } from "zod";

// Structured output contract for call analysis. Claude's response is validated against
// this schema before anything is persisted — an invalid response is treated as a failed
// analysis (analysis_status = 'failed'), never partially trusted.

export const criterionScoreSchema = z.object({
  criterion: z.string(),
  score: z.number(),
  maxScore: z.number(),
  explanation: z.string(),
  evidence: z.string(),
});

export const scorecardSectionResultSchema = z.object({
  section: z.string(),
  score: z.number(),
  maxScore: z.number(),
  criteria: z.array(criterionScoreSchema),
});

export const objectionResultSchema = z.object({
  type: z.string(),
  description: z.string(),
  evidence: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  handled: z.boolean(),
  handlingQuality: z.number(),
  recommendedResponse: z.string(),
});

export const buyingSignalResultSchema = z.object({
  type: z.string(),
  evidence: z.string(),
  strength: z.enum(["low", "medium", "high"]),
});

export const missedOpportunityResultSchema = z.object({
  category: z.string(),
  description: z.string(),
  recommendedAction: z.string(),
});

export const nextActionResultSchema = z.object({
  action: z.string(),
  owner: z.string(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
});

export const coachingRecommendationSchema = z.object({
  category: z.string(),
  type: z.enum(["strength", "weakness"]),
  insight: z.string(),
  recommendation: z.string(),
});

export const callAnalysisResultSchema = z.object({
  summary: z.string(),
  callOutcome: z.enum([
    "closed_won",
    "closed_lost",
    "follow_up_scheduled",
    "follow_up_needed",
    "unresponsive",
    "decision_pending",
    "unknown",
  ]),
  overallScore: z.number().min(0).max(100),
  closeProbability: z.number().min(0).max(100),
  sentiment: z.enum(["positive", "neutral", "mixed", "negative"]),
  customerIntent: z.string(),
  scorecard: z.array(scorecardSectionResultSchema),
  objections: z.array(objectionResultSchema),
  buyingSignals: z.array(buyingSignalResultSchema),
  missedOpportunities: z.array(missedOpportunityResultSchema),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  coachingRecommendations: z.array(coachingRecommendationSchema),
  nextActions: z.array(nextActionResultSchema),
  followUpAssessment: z.object({
    hasScheduledFollowUp: z.boolean(),
    quality: z.enum(["clear", "vague", "missing"]),
    notes: z.string(),
  }),
  dealRiskFactors: z.array(z.string()),
  managerSummary: z.string(),
});

export type CallAnalysisResult = z.infer<typeof callAnalysisResultSchema>;
