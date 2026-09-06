import type { CallAnalysisResult } from "@/services/anthropic/schema";
import type { AnalysisCrmContext } from "@/services/anthropic/prompt";

/**
 * Deterministic, heuristic analysis used only when ANTHROPIC_API_KEY is not configured.
 * It scans the transcript for known Elite Marry Me friction keywords so the manual
 * "Run analysis" flow is demonstrable end-to-end without live credentials. This is
 * intentionally simple — it is not a substitute for the real Claude-driven analysis.
 */
export function buildDemoAnalysisForTranscript(
  transcriptText: string,
  crm: AnalysisCrmContext
): CallAnalysisResult {
  const text = transcriptText.toLowerCase();
  const has = (...kws: string[]) => kws.some((k) => text.includes(k));

  const objections: CallAnalysisResult["objections"] = [];
  if (has("expensive", "budget", "price", "$", "cost")) {
    objections.push({
      type: "price",
      description: "Customer expressed concern about price relative to expectations.",
      evidence: firstMatchingLine(transcriptText, ["expensive", "budget", "price", "cost"]),
      severity: "medium",
      handled: has("understand", "range", "comfortable", "work with"),
      handlingQuality: has("understand", "range") ? 6 : 3,
      recommendedResponse:
        "Acknowledge the concern, then ask what range would feel comfortable for the full experience before defending the price.",
    });
  }
  if (has("partner", "husband", "wife", "fiancé", "fiance", "family")) {
    objections.push({
      type: "partner/family approval",
      description: "Customer indicated they need to consult a partner or family member before deciding.",
      evidence: firstMatchingLine(transcriptText, ["partner", "husband", "wife", "fiancé", "fiance", "family"]),
      severity: "medium",
      handled: has("schedule", "follow up", "call you"),
      handlingQuality: has("schedule") ? 6 : 4,
      recommendedResponse:
        "Offer to send a short recap the partner can review, and schedule a specific follow-up call once both have discussed it.",
    });
  }
  if (has("weather", "rain", "season", "foliage")) {
    objections.push({
      type: "weather/seasonality",
      description: "Customer raised concerns about weather or seasonal appearance of the location.",
      evidence: firstMatchingLine(transcriptText, ["weather", "rain", "season", "foliage"]),
      severity: "low",
      handled: has("backup", "indoor", "guarantee"),
      handlingQuality: has("backup") ? 7 : 4,
      recommendedResponse:
        "Explain the backup/indoor contingency plan and how weather risk is handled contractually.",
    });
  }
  if (has("permit", "private", "privacy")) {
    objections.push({
      type: "permits/privacy",
      description: "Customer asked about permits or the privacy of the proposed location.",
      evidence: firstMatchingLine(transcriptText, ["permit", "private", "privacy"]),
      severity: "low",
      handled: has("handle", "included", "taken care"),
      handlingQuality: has("handle") ? 7 : 4,
      recommendedResponse:
        "Confirm that permits are handled by Elite Marry Me and clarify exactly how privacy is protected at the location.",
    });
  }

  const hasBuyingSignal = has("when can we", "how do we book", "deposit", "reserve", "sign up", "next step");
  const buyingSignals: CallAnalysisResult["buyingSignals"] = hasBuyingSignal
    ? [
        {
          type: "booking intent",
          evidence: firstMatchingLine(transcriptText, ["when can we", "how do we book", "deposit", "reserve", "sign up", "next step"]),
          strength: "medium",
        },
      ]
    : [];

  const askedForCommitment = has("would you like to move forward", "ready to book", "reserve your date", "put down a deposit");
  const closingScore = askedForCommitment ? 12 : hasBuyingSignal ? 8 : 5;
  const discoveryScore = has("budget", "date", "guests", "vision", "location") ? 15 : 10;

  const overallScore = clamp(
    Math.round(
      ((discoveryScore / 20) * 20 +
        (closingScore / 15) * 15 +
        10 + // opening baseline
        10 + // needs understanding baseline
        10 + // value presentation baseline
        (objections.length ? (objections.filter((o) => o.handled).length / objections.length) * 20 : 14) +
        4) // follow-up baseline
    ),
    0,
    100
  );

  const closeProbability = clamp(
    Math.round(30 + (hasBuyingSignal ? 20 : 0) + (askedForCommitment ? 15 : 0) - objections.filter((o) => !o.handled).length * 8),
    5,
    95
  );

  return {
    summary: `Demo-mode heuristic analysis of a ${crm.callType ?? "sales"} call with ${crm.contactName ?? "the customer"}. This is a keyword-based fallback shown because ANTHROPIC_API_KEY is not configured — connect it in Settings > Integrations for real AI analysis.`,
    callOutcome: askedForCommitment ? "follow_up_scheduled" : "follow_up_needed",
    overallScore,
    closeProbability,
    sentiment: objections.filter((o) => !o.handled).length > 1 ? "mixed" : "positive",
    customerIntent: hasBuyingSignal
      ? "Customer is showing active interest in moving forward."
      : "Customer is gathering information; commitment level unclear from transcript.",
    scorecard: [
      {
        section: "Opening & Professionalism",
        score: 8,
        maxScore: 10,
        criteria: [
          {
            criterion: "Professional introduction & rapport",
            score: 8,
            maxScore: 10,
            explanation: "Demo heuristic: baseline score, not evidence-scored per criterion.",
            evidence: "UNKNOWN — enable ANTHROPIC_API_KEY for per-criterion evidence.",
          },
        ],
      },
      {
        section: "Discovery",
        score: discoveryScore,
        maxScore: 20,
        criteria: [
          {
            criterion: "Identified event details (date, location, budget, vision)",
            score: discoveryScore,
            maxScore: 20,
            explanation: has("budget", "date", "guests", "vision", "location")
              ? "Transcript contains references to key discovery topics (budget/date/location/vision)."
              : "Transcript does not clearly show active discovery of key details.",
            evidence: firstMatchingLine(transcriptText, ["budget", "date", "guests", "vision", "location"]) || "UNKNOWN",
          },
        ],
      },
      {
        section: "Needs Understanding",
        score: 10,
        maxScore: 15,
        criteria: [
          {
            criterion: "Summarized and confirmed client needs",
            score: 10,
            maxScore: 15,
            explanation: "Demo heuristic: baseline score.",
            evidence: "UNKNOWN — enable ANTHROPIC_API_KEY for per-criterion evidence.",
          },
        ],
      },
      {
        section: "Value Presentation",
        score: 10,
        maxScore: 15,
        criteria: [
          {
            criterion: "Personalized recommendation before price",
            score: 10,
            maxScore: 15,
            explanation: "Demo heuristic: baseline score.",
            evidence: "UNKNOWN — enable ANTHROPIC_API_KEY for per-criterion evidence.",
          },
        ],
      },
      {
        section: "Objection Handling",
        score: objections.length
          ? Math.round((objections.filter((o) => o.handled).length / objections.length) * 20)
          : 14,
        maxScore: 20,
        criteria: objections.map((o) => ({
          criterion: `Handled ${o.type} objection`,
          score: o.handlingQuality,
          maxScore: 10,
          explanation: o.handled
            ? "Objection appears to have been acknowledged and addressed."
            : "Objection was raised but not clearly resolved in the transcript.",
          evidence: o.evidence,
        })),
      },
      {
        section: "Closing",
        score: closingScore,
        maxScore: 15,
        criteria: [
          {
            criterion: "Asked for commitment / clear next step",
            score: closingScore,
            maxScore: 15,
            explanation: askedForCommitment
              ? "Transcript shows a direct ask for commitment or booking."
              : "No clear ask for commitment found in transcript.",
            evidence: firstMatchingLine(transcriptText, ["move forward", "ready to book", "reserve your date", "deposit"]) || "UNKNOWN",
          },
        ],
      },
      {
        section: "Follow-Up Discipline",
        score: 4,
        maxScore: 5,
        criteria: [
          {
            criterion: "Specific next action with owner and timeframe",
            score: 4,
            maxScore: 5,
            explanation: "Demo heuristic: baseline score.",
            evidence: "UNKNOWN — enable ANTHROPIC_API_KEY for per-criterion evidence.",
          },
        ],
      },
    ],
    objections,
    buyingSignals,
    missedOpportunities: askedForCommitment
      ? []
      : [
          {
            category: "closing",
            description: "No direct ask for commitment or next booking step was found in the transcript.",
            recommendedAction:
              "End the call with a conditional close, e.g. 'If the location looks the way you expect in the video, would you be comfortable reserving the date?'",
          },
        ],
    strengths: ["Maintained a professional, warm tone throughout the call (demo heuristic)."],
    weaknesses: askedForCommitment
      ? []
      : ["Did not clearly ask for commitment or the next step (demo heuristic)."],
    coachingRecommendations: [
      {
        category: "Closing",
        type: askedForCommitment ? "strength" : "weakness",
        insight: askedForCommitment
          ? "Rep asked for a clear next step near the end of the call."
          : "Rep did not attempt a trial close or ask for commitment.",
        recommendation:
          "Practice a conditional close tied to the specific thing the customer is waiting on (photos, video, availability).",
      },
    ],
    nextActions: [
      {
        action: "Send follow-up recap and confirm next call time",
        owner: crm.salesRepName ?? "Sales Rep",
        dueDate: null,
        priority: "medium",
      },
    ],
    followUpAssessment: {
      hasScheduledFollowUp: has("follow up", "call you", "next week", "schedule"),
      quality: has("follow up", "call you") ? "vague" : "missing",
      notes: "Demo heuristic assessment based on keyword matching only.",
    },
    dealRiskFactors: objections.filter((o) => !o.handled).map((o) => `Unresolved ${o.type} objection`),
    managerSummary:
      "This is a DEMO-MODE analysis generated by keyword heuristics because no ANTHROPIC_API_KEY is configured. Connect Claude in Settings > Integrations to get real evidence-based scoring.",
  };
}

function firstMatchingLine(text: string, keywords: string[]): string {
  const lines = text.split(/\n+/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) return line.trim().slice(0, 240);
  }
  return "";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
