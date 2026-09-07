export const PROMPT_VERSION = "elite-marry-me-v1";

export const SYSTEM_PROMPT = `You are an expert sales QA analyst and sales coach for Elite Marry Me, a luxury proposal and event planning company.

Your job is not to be nice to the salesperson. Your job is to accurately evaluate the sales behavior in this call using ONLY evidence present in the transcript and the CRM context provided.

Rules:
- A high score must be earned. Do not default to generous scoring.
- Do not penalize a rep for criteria that are not relevant to this specific call.
- Do not reward behavior simply because the deal outcome was positive. A lost deal can contain an excellent sales call. A closed deal can contain poor sales execution. Separate process quality from final outcome.
- For every objection identified, determine whether the representative: acknowledged it, clarified the real concern, isolated it, responded to it, confirmed resolution, and advanced the deal.
- Never hallucinate customer motivations, budget figures, or facts not stated in the transcript or CRM context.
- When information is unknown or not discussed, say so explicitly (use "UNKNOWN" or an empty array) rather than inventing it.
- Every score and every coaching criticism must cite a specific piece of evidence (a paraphrase or quote from the transcript), not a generic statement.
- "Close probability" is an estimate based on conversation signals, not a guarantee. Be conservative.
- For "nextActions": be operational and specific (e.g. "Send the Midtown rooftop video today and call the client tomorrow at 6 PM"), never a generic "follow up with the client." NEVER invent a dueDate or dueTime the client did not actually give you — leave them null rather than guessing.
- For "followUpMessages": write a ready-to-send SMS and email in a concise, warm, premium tone appropriate for a luxury event planning brand. Reference only what was actually discussed on the call.
- For "whyThisMatters": one or two sentences of business impact for a manager skimming the call, not generic coaching language.
- Return ONLY valid JSON matching the exact schema you are given. No markdown fences, no commentary.`;

export function buildScorecardPromptSection(scorecard: {
  name: string;
  sections: {
    name: string;
    weight: number;
    criteria: { name: string; maxScore: number; guidance?: string | null }[];
  }[];
}): string {
  const lines: string[] = [`Scorecard: ${scorecard.name}`, ""];
  for (const section of scorecard.sections) {
    lines.push(`### ${section.name} (weight: ${section.weight}%)`);
    for (const c of section.criteria) {
      lines.push(`- ${c.name} (max ${c.maxScore})${c.guidance ? `: ${c.guidance}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export interface AnalysisCrmContext {
  contactName: string | null;
  dealName: string | null;
  dealStage: string | null;
  pipeline: string | null;
  dealAmount: number | null;
  dealStatus: string | null;
  leadSource: string | null;
  closeDate: string | null;
  salesRepName: string | null;
  callType: string | null;
  previousCallCount: number;
}

// Centralized minimum-context builder (Section 29 — privacy). Only fields relevant to
// scoring a sales conversation are ever sent to the model; unrelated CRM notes, full
// contact records, or unrelated custom properties are intentionally excluded.
export function buildCrmContextBlock(ctx: AnalysisCrmContext): string {
  return [
    `Contact: ${ctx.contactName ?? "UNKNOWN"}`,
    `Sales Rep: ${ctx.salesRepName ?? "UNKNOWN"}`,
    `Call type: ${ctx.callType ?? "UNKNOWN"}`,
    `Deal: ${ctx.dealName ?? "UNKNOWN"}`,
    `Pipeline / Stage: ${ctx.pipeline ?? "UNKNOWN"} / ${ctx.dealStage ?? "UNKNOWN"}`,
    `Deal amount: ${ctx.dealAmount != null ? `$${ctx.dealAmount}` : "UNKNOWN"}`,
    `Deal status: ${ctx.dealStatus ?? "UNKNOWN"}`,
    `Lead source: ${ctx.leadSource ?? "UNKNOWN"}`,
    `Close date: ${ctx.closeDate ?? "UNKNOWN"}`,
    `Previous calls with this contact: ${ctx.previousCallCount}`,
  ].join("\n");
}

export function buildUserPrompt(params: {
  scorecardBlock: string;
  crmContextBlock: string;
  transcriptText: string;
  jsonSchemaDescription: string;
}): string {
  return `## CRM Context (source data — do not treat as sales performance evidence)
${params.crmContextBlock}

## Scorecard to apply
${params.scorecardBlock}

## Transcript
${params.transcriptText}

## Output
Return a single JSON object with this exact shape (types, not literal values):
${params.jsonSchemaDescription}

Known objection categories to watch for specifically (Elite Marry Me recurring friction points): price/budget, location rental cost, permits, privacy, weather/seasonality/foliage, visual uncertainty (need photos/video before committing), comparing multiple locations, unbundling services to cut cost, need to consult partner/family, delayed decision-making, interest without commitment, too many options presented without narrowing, failure to discover real budget, failure to identify decision-maker.`;
}

export const JSON_SHAPE_DESCRIPTION = `{
  "summary": string,
  "callOutcome": "closed_won"|"closed_lost"|"follow_up_scheduled"|"follow_up_needed"|"unresponsive"|"decision_pending"|"unknown",
  "overallScore": number (0-100),
  "closeProbability": number (0-100),
  "sentiment": "positive"|"neutral"|"mixed"|"negative",
  "buyingIntent": "low"|"medium"|"high",
  "customerIntent": string,
  "scorecard": [{ "section": string, "score": number, "maxScore": number, "criteria": [{ "criterion": string, "score": number, "maxScore": number, "explanation": string, "evidence": string }] }],
  "objections": [{ "type": string, "description": string, "evidence": string, "severity": "low"|"medium"|"high", "handled": boolean, "handlingQuality": number (0-10), "recommendedResponse": string }],
  "buyingSignals": [{ "type": string, "evidence": string, "strength": "low"|"medium"|"high" }],
  "missedOpportunities": [{ "category": string, "description": string, "recommendedAction": string }],
  "strengths": [string],
  "weaknesses": [string],
  "coachingRecommendations": [{ "category": string, "type": "strength"|"weakness", "insight": string, "recommendation": string }],
  "nextActions": [{ "actionType": "send_material"|"call"|"email"|"text"|"schedule_meeting"|"internal_task"|"other", "actionDescription": string, "dueDate": string|null, "dueTime": string|null, "owner": string, "priority": "low"|"medium"|"high", "closeStrategy": string }],
  "followUpAssessment": { "hasScheduledFollowUp": boolean, "quality": "clear"|"vague"|"missing", "notes": string },
  "dealRiskFactors": [string],
  "managerSummary": string,
  "whyThisMatters": string,
  "followUpMessages": { "sms": string, "email": string }
}`;
