// The Elite Marry Me — Federico Call Audit scorecard (Section 7 of the spec).
// This is the seed definition used both for the demo dataset and for what gets
// inserted into scorecard_templates/sections/criteria when a real Supabase project
// is connected (see scripts/seed-supabase.ts).

export interface ScorecardCriterionSeed {
  name: string;
  maxScore: number;
  guidance: string;
}

export interface ScorecardSectionSeed {
  name: string;
  weight: number; // percent of total 100
  description: string;
  criteria: ScorecardCriterionSeed[];
}

export const ELITE_MARRY_ME_SCORECARD_NAME = "Elite Marry Me - Federico Call Audit";

export const ELITE_MARRY_ME_SCORECARD: ScorecardSectionSeed[] = [
  {
    name: "Opening & Professionalism",
    weight: 10,
    description: "First impression, tone, rapport, and control of the conversation.",
    criteria: [
      { name: "Professional introduction", maxScore: 2, guidance: "Clear, confident self-introduction and company framing." },
      { name: "Warm and confident tone", maxScore: 2, guidance: "Tone conveys warmth without sounding scripted or nervous." },
      { name: "Rapport", maxScore: 2, guidance: "Rep builds genuine connection before moving to business." },
      { name: "Clear agenda", maxScore: 2, guidance: "Rep sets expectations for what the call will cover." },
      { name: "Control of conversation", maxScore: 2, guidance: "Rep guides pacing without being pushy." },
    ],
  },
  {
    name: "Discovery",
    weight: 20,
    description:
      "Whether Federico actively discovered — not merely received — key event details. Do not give credit merely because the client volunteered information.",
    criteria: [
      { name: "Event type", maxScore: 2, guidance: "Confirmed the type of event (proposal, gender reveal, etc.)." },
      { name: "Event date", maxScore: 2, guidance: "Actively asked for and confirmed a target date." },
      { name: "Preferred location", maxScore: 2, guidance: "Explored location preferences, not just accepted a default." },
      { name: "Client vision", maxScore: 3, guidance: "Drew out the client's vision for the experience." },
      { name: "Budget", maxScore: 3, guidance: "Actively discovered real budget range, not assumed." },
      { name: "Decision makers", maxScore: 2, guidance: "Identified who else is involved in the decision." },
      { name: "Timeline", maxScore: 2, guidance: "Clarified urgency and decision timeline." },
      { name: "Must-have elements / barriers", maxScore: 4, guidance: "Surfaced specific priorities and potential barriers." },
    ],
  },
  {
    name: "Needs Understanding",
    weight: 15,
    description: "Whether Federico synthesized discovery into a clear understanding of needs.",
    criteria: [
      { name: "Summarizes client needs", maxScore: 4, guidance: "Plays back what was heard in the client's own terms." },
      { name: "Confirms understanding", maxScore: 3, guidance: "Explicitly checks that the summary is correct." },
      { name: "Prioritizes what matters most", maxScore: 4, guidance: "Identifies the 1-2 things that matter most to this client." },
      { name: "Wants vs requirements / connects recommendation to needs", maxScore: 4, guidance: "Distinguishes nice-to-haves from must-haves and ties recommendations back to stated needs." },
    ],
  },
  {
    name: "Value Presentation",
    weight: 15,
    description: "Whether Federico built value and personalized the pitch before discussing price.",
    criteria: [
      { name: "Value before price", maxScore: 4, guidance: "Explains value before jumping to numbers, when appropriate." },
      { name: "Personalizes recommendations", maxScore: 4, guidance: "Ties the recommendation to what this specific client said." },
      { name: "Explains package differences", maxScore: 3, guidance: "Clarifies what's different between options rather than just listing them." },
      { name: "Builds confidence / uses expertise", maxScore: 4, guidance: "Guides the client using expertise rather than just presenting a menu." },
    ],
  },
  {
    name: "Objection Handling",
    weight: 20,
    description:
      "For each objection: did Federico acknowledge, clarify the real concern, isolate, respond, confirm resolution, and convert it into a next step?",
    criteria: [
      { name: "Acknowledged objections", maxScore: 3, guidance: "Did not dismiss or talk over the concern." },
      { name: "Clarified the real concern", maxScore: 4, guidance: "Asked a follow-up to understand what's really behind the objection." },
      { name: "Isolated the objection", maxScore: 3, guidance: "Checked whether this is the only thing standing in the way." },
      { name: "Answered the objection", maxScore: 5, guidance: "Gave a substantive, relevant response." },
      { name: "Confirmed resolution", maxScore: 3, guidance: "Checked that the response actually resolved the concern." },
      { name: "Converted into a next step", maxScore: 2, guidance: "Used the resolved objection to move the deal forward." },
    ],
  },
  {
    name: "Closing",
    weight: 15,
    description: "Natural progression toward commitment — not aggressive closing.",
    criteria: [
      { name: "Identified buying signals", maxScore: 3, guidance: "Noticed and acted on signals of interest." },
      { name: "Trial close", maxScore: 2, guidance: "Checked temperature before a full close attempt." },
      { name: "Asked for commitment", maxScore: 4, guidance: "Made a direct, clear ask." },
      { name: "Deposit discussion", maxScore: 2, guidance: "Raised the deposit/reservation process when appropriate." },
      { name: "Conditional close / clear next step", maxScore: 4, guidance: "Used a natural conditional close and left a clear next step." },
    ],
  },
  {
    name: "Follow-Up Discipline",
    weight: 5,
    description: "Concrete, owned, time-bound follow-up — never vague.",
    criteria: [
      { name: "Clear next action with owner and timeframe", maxScore: 3, guidance: "No 'I'll follow up sometime' commitments." },
      { name: "Materials promised are documented", maxScore: 2, guidance: "Anything promised (photos, proposal, video) is captured as a next action." },
    ],
  },
];

export const SCORECARD_TOTAL_WEIGHT = ELITE_MARRY_ME_SCORECARD.reduce((sum, s) => sum + s.weight, 0);
