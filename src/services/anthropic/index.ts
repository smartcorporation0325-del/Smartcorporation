import Anthropic from "@anthropic-ai/sdk";
import {
  callAnalysisResultSchema,
  type CallAnalysisResult,
} from "./schema";
import {
  SYSTEM_PROMPT,
  PROMPT_VERSION,
  JSON_SHAPE_DESCRIPTION,
  buildCrmContextBlock,
  buildScorecardPromptSection,
  buildUserPrompt,
  type AnalysisCrmContext,
} from "./prompt";
import { buildDemoAnalysisForTranscript } from "@/lib/demo/analysis-fallback";

const MODEL = "claude-sonnet-5";

export interface ScorecardForPrompt {
  name: string;
  sections: {
    name: string;
    weight: number;
    criteria: { name: string; maxScore: number; guidance?: string | null }[];
  }[];
}

export interface RunAnalysisParams {
  transcriptText: string;
  crmContext: AnalysisCrmContext;
  scorecard: ScorecardForPrompt;
}

export interface RunAnalysisResult {
  result: CallAnalysisResult;
  modelUsed: string;
  promptVersion: string;
  raw: unknown;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Runs the structured call analysis. Falls back to a deterministic demo analysis when
 * ANTHROPIC_API_KEY is not configured, so the pipeline (validate -> store -> alerts)
 * is fully exercisable without live credentials.
 */
export async function runCallAnalysis(
  params: RunAnalysisParams
): Promise<RunAnalysisResult> {
  if (!isAnthropicConfigured()) {
    const demo = buildDemoAnalysisForTranscript(params.transcriptText, params.crmContext);
    return {
      result: demo,
      modelUsed: "demo-mode (no ANTHROPIC_API_KEY)",
      promptVersion: PROMPT_VERSION,
      raw: demo,
    };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = buildUserPrompt({
    scorecardBlock: buildScorecardPromptSection(params.scorecard),
    crmContextBlock: buildCrmContextBlock(params.crmContext),
    transcriptText: params.transcriptText,
    jsonSchemaDescription: JSON_SHAPE_DESCRIPTION,
  });

  // A real ~15-minute call (hundreds of dialogue segments, full scorecard + objections
  // + coaching JSON) can still exceed 16000 output tokens — confirmed in production
  // (Malik Thompson call, 15:29, truncated at 16000). Raised the cap and switched to
  // streaming, since a non-streaming request this large risks an HTTP timeout.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const message = await stream.finalMessage();

  const textBlock = message.content.find((b) => b.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

  if (message.stop_reason === "max_tokens") {
    throw new AnalysisValidationError(
      "Claude's response was cut off (hit the max_tokens limit) before finishing the analysis JSON.",
      rawText
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJson(rawText));
  } catch {
    throw new AnalysisValidationError(
      "Claude response was not valid JSON",
      rawText
    );
  }

  const validated = callAnalysisResultSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AnalysisValidationError(
      `Claude response failed schema validation: ${validated.error.message}`,
      parsedJson
    );
  }

  return {
    result: validated.data,
    modelUsed: MODEL,
    promptVersion: PROMPT_VERSION,
    raw: parsedJson,
  };
}

/**
 * Answers a natural-language question about a bounded, pre-retrieved set of calls
 * (Section 17 — Ask Your Calls). Never receives the full database; the caller is
 * responsible for retrieval (see lib/data/ask.ts).
 */
export async function answerQuestionAboutCalls(params: {
  question: string;
  contextBlock: string;
}): Promise<string> {
  if (!isAnthropicConfigured()) {
    return `Demo mode: connect ANTHROPIC_API_KEY in Settings > Integrations to get a real answer to "${params.question}". Based on the retrieved calls, here is the raw context that would be sent to Claude:\n\n${params.contextBlock.slice(0, 1200)}${params.contextBlock.length > 1200 ? "\n..." : ""}`;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      "You are a sales operations analyst answering questions about Elite Marry Me's sales calls. Only use the call data provided below — never invent calls, numbers, or quotes that are not present. If the provided calls don't contain enough information to answer, say so explicitly. Be concise and specific, citing call contacts/dates where relevant.",
    messages: [
      {
        role: "user",
        content: `## Retrieved calls\n${params.contextBlock}\n\n## Question\n${params.question}`,
      },
    ],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "No answer generated.";
}

export class AnalysisValidationError extends Error {
  raw: unknown;
  constructor(message: string, raw: unknown) {
    super(message);
    this.name = "AnalysisValidationError";
    this.raw = raw;
  }
}

// Claude occasionally wraps JSON in prose or fences despite instructions; this recovers
// the object defensively rather than failing the whole analysis.
function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}
