import type {
  Alert,
  BuyingSignal,
  CallAnalysisFull,
  CallTranscript,
  CallWithRelations,
  CoachingInsight,
  Contact,
  CriterionScore,
  Deal,
  MissedOpportunity,
  NextAction,
  Objection,
  SalesRep,
} from "@/types/db";
import { ELITE_MARRY_ME_SCORECARD, ELITE_MARRY_ME_SCORECARD_NAME } from "./scorecard";

// ============================================================================
// Demo dataset for Elite Marry Me — 15 fictional calls for Federico.
// No real customer data. Used whenever Supabase is not configured (isSupabaseConfigured()
// === false), and can also be loaded into a real Supabase project via
// scripts/seed-supabase.ts so the same scenarios are available either way.
//
// Simplification vs. live analysis: criterion_scores here are recorded at SECTION
// granularity (one row per scorecard section) rather than full per-criterion detail,
// to keep the seed file maintainable. A real Claude-driven analysis (services/anthropic)
// always returns full per-criterion scores per the Zod schema — this is a demo-data
// shortcut only, not a product limitation.
// ============================================================================

const NOW = new Date("2026-09-06T12:00:00Z");
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86400000).toISOString();
}

export const DEMO_SCORECARD_TEMPLATE_ID = "demo-scorecard-v1";

export const FEDERICO: SalesRep = {
  id: "demo-rep-federico",
  name: "Federico",
  email: "federico@elitemarryme.com",
  quo_user_id: "demo-federico",
  hubspot_owner_id: "demo-owner-federico",
  active: true,
  created_at: daysAgo(400),
};

export const DEMO_SALES_REPS: SalesRep[] = [FEDERICO];

interface Scenario {
  key: string;
  contact: { firstname: string; lastname: string; email: string; phone: string };
  callType: string;
  daysAgo: number;
  durationSeconds: number;
  direction: "inbound" | "outbound";
  deal: {
    name: string;
    stage: string;
    pipeline: string;
    amount: number;
    status: "open" | "closed_won" | "closed_lost";
    closeDate: string | null;
    leadSource: string;
  };
  outcome:
    | "closed_won"
    | "closed_lost"
    | "follow_up_scheduled"
    | "follow_up_needed"
    | "unresponsive"
    | "decision_pending";
  sectionScores: number[]; // 7 values matching ELITE_MARRY_ME_SCORECARD order, out of each section's weight
  closeProbability: number;
  sentiment: "positive" | "neutral" | "mixed" | "negative";
  customerIntent: string;
  summary: string;
  managerSummary: string;
  coachingSummary: string;
  strengths: string[];
  weaknesses: string[];
  dealRiskFactors: string[];
  followUp: { hasScheduledFollowUp: boolean; quality: "clear" | "vague" | "missing"; notes: string };
  transcript: { speaker: "Federico" | "Client"; text: string }[];
  objections: Array<{
    type: string;
    text: string;
    evidence: string;
    severity: "low" | "medium" | "high";
    handled: boolean;
    handlingQuality: number;
    recommendedResponse: string;
  }>;
  buyingSignals: Array<{ type: string; evidence: string; strength: "low" | "medium" | "high" }>;
  missedOpportunities: Array<{ category: string; description: string; recommendedAction: string }>;
  coachingInsights: Array<{
    category: string;
    kind: "strength" | "weakness";
    insight: string;
    recommendation: string;
  }>;
  nextActions: Array<{ action: string; owner: string; dueDate: string | null; priority: "low" | "medium" | "high" }>;
}

const scenarios: Scenario[] = [
  {
    key: "c01",
    contact: { firstname: "Marcus", lastname: "Reyes", email: "marcus.reyes@example.com", phone: "+15555550101" },
    callType: "Proposal Planning",
    daysAgo: 4,
    durationSeconds: 1860,
    direction: "outbound",
    deal: { name: "Reyes — Central Park Proposal", stage: "Closed Won", pipeline: "Event Bookings", amount: 6800, status: "closed_won", closeDate: daysAgo(2), leadSource: "Instagram" },
    outcome: "closed_won",
    sectionScores: [9, 18, 13, 13, 17, 13, 5],
    closeProbability: 88,
    sentiment: "positive",
    customerIntent: "Ready to book; comparing two locations but leaning toward Central Park.",
    summary:
      "Marcus is planning a surprise proposal for his partner and wants a photogenic, semi-private outdoor location. Federico ran a thorough discovery, actively surfaced the real budget ($6,500-$8,000) instead of accepting the first vague answer, and closed with a conditional close tied to the location video.",
    managerSummary: "Strong call — model example of discovery-to-close. Use as a coaching reference for Federico's peers once other reps are onboarded.",
    coachingSummary: "Federico's best closing example this month: he isolated the price objection, resolved it, then used a conditional close tied to a concrete next step (the location video) rather than pressuring for an immediate yes.",
    strengths: [
      "Actively re-asked for budget after Marcus gave a vague first answer, uncovering the real range.",
      "Used a natural conditional close: 'If the video looks the way you're picturing it, would you be comfortable reserving the date?'",
    ],
    weaknesses: ["Spent slightly long on rapport-building (6 minutes) before moving into discovery."],
    dealRiskFactors: [],
    followUp: { hasScheduledFollowUp: true, quality: "clear", notes: "Video walkthrough promised within 48 hours; deposit call scheduled for Thursday 3pm." },
    transcript: [
      { speaker: "Federico", text: "Marcus, thanks for hopping on — I saw your inquiry about a proposal setup, congratulations! Tell me a bit about her and what you're picturing." },
      { speaker: "Client", text: "Thanks! We've been together 5 years, she loves anything with a skyline view. I don't really know what's realistic budget-wise." },
      { speaker: "Federico", text: "Totally fine — a lot of guys start there. Just so I don't waste your time showing you options outside your range, if the perfect setup landed somewhere between $5,000 and $9,000, would that work, or should we be looking lower?" },
      { speaker: "Client", text: "Honestly I could go up to around $7,500 if it's really special." },
      { speaker: "Federico", text: "That's really helpful, thank you for being direct. Is anyone else weighing in on this with you — a friend, family member?" },
      { speaker: "Client", text: "No, just me, I want it to be a surprise even for my friends until after." },
      { speaker: "Federico", text: "Got it. Do you have a date in mind, and is there a deadline pushing that — anniversary, trip, anything like that?" },
      { speaker: "Client", text: "We're going to Paris in 8 weeks, I wanted to do it before that trip if possible." },
      { speaker: "Federico", text: "Perfect, that gives us a clear window. Based on what you've told me — skyline view, private enough to feel intimate, before your trip — I'd put together two options: the Central Park terrace and the Midtown rooftop." },
      { speaker: "Client", text: "The rooftop looks great in photos but I'm worried it might feel expensive for what it is." },
      { speaker: "Federico", text: "Fair concern — can I ask, is it the price itself, or more that you're not sure it's worth it compared to the park option?" },
      { speaker: "Client", text: "I guess it's more that I'm not sure it's worth $1,200 more than the park." },
      { speaker: "Federico", text: "That makes sense. The rooftop includes a private elevator hold and a 45-minute exclusive window with no other bookings overlapping — the park has some foot traffic even in the reserved area. Given she loves that quiet, undisturbed moment, does that difference change how you're weighing it?" },
      { speaker: "Client", text: "Yeah, actually that matters a lot, she'd hate strangers walking by." },
      { speaker: "Federico", text: "Then I'd lean rooftop for you. I'll send you a 90-second video of the exact spot at golden hour so you can see it for yourself before committing anything." },
      { speaker: "Client", text: "That would help a lot." },
      { speaker: "Federico", text: "I'll have that to you within 48 hours. If it looks the way you're picturing it, would you be comfortable reserving the date with a deposit at that point?" },
      { speaker: "Client", text: "Yeah, if it looks like that, let's do it." },
      { speaker: "Federico", text: "Great — I'll call you Thursday at 3pm once you've had a chance to watch it, and we can lock in the reservation then." },
    ],
    objections: [
      {
        type: "price",
        text: "I'm worried it might feel expensive for what it is / not sure it's worth $1,200 more than the park.",
        evidence: "Client: 'I guess it's more that I'm not sure it's worth $1,200 more than the park.'",
        severity: "medium",
        handled: true,
        handlingQuality: 9,
        recommendedResponse: "(Already handled well) Isolated the real concern (value vs. price) before answering, then tied the answer directly to what the client said mattered — privacy.",
      },
    ],
    buyingSignals: [
      { type: "direct interest in specific location", evidence: "Client: 'The rooftop looks great in photos'", strength: "medium" },
      { type: "agreement to conditional close", evidence: "Client: 'Yeah, if it looks like that, let's do it.'", strength: "high" },
    ],
    missedOpportunities: [],
    coachingInsights: [
      { category: "Discovery", kind: "strength", insight: "Re-asked for a budget range instead of accepting 'I don't know'.", recommendation: "Keep using the range-anchoring technique ('between $X and $Y') on every discovery call." },
      { category: "Objection Handling", kind: "strength", insight: "Isolated whether the objection was price or value before responding.", recommendation: "Continue asking 'is it the price itself, or...' before defending price." },
    ],
    nextActions: [
      { action: "Send 90-second location video", owner: "Federico", dueDate: daysAgo(2), priority: "high" },
      { action: "Follow-up call to collect deposit", owner: "Federico", dueDate: daysAgo(-1), priority: "high" },
    ],
  },
  {
    key: "c02",
    contact: { firstname: "Priya", lastname: "Nair", email: "priya.nair@example.com", phone: "+15555550102" },
    callType: "Gender Reveal",
    daysAgo: 9,
    durationSeconds: 1500,
    direction: "inbound",
    deal: { name: "Nair — Backyard Gender Reveal", stage: "Closed Won", pipeline: "Event Bookings", amount: 3200, status: "closed_won", closeDate: daysAgo(6), leadSource: "Referral" },
    outcome: "closed_won",
    sectionScores: [9, 17, 12, 12, 16, 12, 5],
    closeProbability: 82,
    sentiment: "positive",
    customerIntent: "Wants a simple, elegant backyard setup for close family; ready to move quickly.",
    summary: "Priya called in already warm from a referral. Federico confirmed guest count, decor style, and date, handled a light setup-logistics objection, and closed with a clear next step.",
    managerSummary: "Solid, efficient call. Nothing to flag.",
    coachingSummary: "Good example of a fast, well-run call with a warm lead — Federico still ran full discovery instead of rushing to close.",
    strengths: ["Ran full discovery even though the lead was already warm and eager to book.", "Confirmed decision-maker (joint decision with spouse) early."],
    weaknesses: ["Did not explore backup plan in detail for weather, though outdoor event."],
    dealRiskFactors: [],
    followUp: { hasScheduledFollowUp: true, quality: "clear", notes: "Proposal PDF to be sent same day; confirmation call in 3 days." },
    transcript: [
      { speaker: "Federico", text: "Priya, hi! Rina mentioned you might be reaching out — congratulations on the pregnancy. What are you picturing for the reveal?" },
      { speaker: "Client", text: "Thank you! We want something simple in our backyard, just close family, maybe 20 people." },
      { speaker: "Federico", text: "Love that. Is this a decision you and your partner are making together, or are you scouting first?" },
      { speaker: "Client", text: "We're deciding together, he trusts me to pick but he'll want to see it." },
      { speaker: "Federico", text: "Makes sense, I'll make sure you get something you can both look at. Do you have a date locked in?" },
      { speaker: "Client", text: "Three weeks from Saturday." },
      { speaker: "Federico", text: "Good, that's workable. Since it's your own backyard, are you thinking we bring in a full setup — arch, florals, powder cannon — or something more minimal?" },
      { speaker: "Client", text: "Florals and the powder cannon for sure, we don't need a huge arch." },
      { speaker: "Federico", text: "Got it. One thing I want to flag — since it's a backyard setup, is there anything about the space itself that might make setup tricky, like uneven ground or limited access?" },
      { speaker: "Client", text: "There's a side gate but it's a little narrow, is that a problem?" },
      { speaker: "Federico", text: "Not a dealbreaker, our team just needs the measurement ahead of time so we bring the right equipment — I'll send you a quick guide for that today." },
      { speaker: "Client", text: "Perfect, that's easy." },
      { speaker: "Federico", text: "I'll put together a proposal today with the florals and powder cannon package and send it over so you and your partner can look at it together." },
      { speaker: "Client", text: "Sounds great, thank you!" },
      { speaker: "Federico", text: "I'll call you in three days to answer any questions and get it locked in." },
    ],
    objections: [
      {
        type: "logistics/setup",
        text: "Narrow side gate access for the backyard.",
        evidence: "Client: 'There's a side gate but it's a little narrow, is that a problem?'",
        severity: "low",
        handled: true,
        handlingQuality: 8,
        recommendedResponse: "(Already handled) Reassured and gave a concrete, low-friction action (send a measurement guide).",
      },
    ],
    buyingSignals: [{ type: "specific package request", evidence: "Client: 'Florals and the powder cannon for sure'", strength: "high" }],
    missedOpportunities: [
      { category: "discovery", description: "Outdoor backyard event but no discussion of a weather contingency plan.", recommendedAction: "Ask about a rain backup plan on every outdoor residential setup, regardless of forecast." },
    ],
    coachingInsights: [
      { category: "Discovery", kind: "strength", insight: "Identified the spouse as joint decision-maker early rather than assuming Priya alone decides.", recommendation: "Keep asking 'is this a joint decision' on every call, even warm referrals." },
    ],
    nextActions: [
      { action: "Send florals + powder cannon proposal PDF", owner: "Federico", dueDate: daysAgo(6), priority: "high" },
      { action: "Confirmation call", owner: "Federico", dueDate: daysAgo(3), priority: "medium" },
    ],
  },
  {
    key: "c03",
    contact: { firstname: "Daniel", lastname: "Okafor", email: "daniel.okafor@example.com", phone: "+15555550103" },
    callType: "Location Consultation",
    daysAgo: 14,
    durationSeconds: 1320,
    direction: "outbound",
    deal: { name: "Okafor — Lakeside Proposal", stage: "Closed Lost", pipeline: "Event Bookings", amount: 5400, status: "closed_lost", closeDate: daysAgo(5), leadSource: "Website" },
    outcome: "closed_lost",
    sectionScores: [7, 12, 9, 8, 8, 6, 2],
    closeProbability: 20,
    sentiment: "negative",
    customerIntent: "Comparing three vendors on price; sensitive to cost.",
    summary: "Daniel was budget-sensitive from the start. Federico never got a real number from him and led with price rather than value, then failed to isolate the objection when it came up, listing more package options instead of addressing the actual concern.",
    managerSummary: "Lost deal with clear process gaps in objection handling and discovery. Good coaching case — pair with call c01 as a contrast example.",
    coachingSummary: "Federico led with price before establishing value, and never got a straight budget number — when the objection came, he responded by listing more packages rather than clarifying the real concern, which likely reinforced the client's price sensitivity instead of resolving it.",
    strengths: ["Maintained a professional tone even as the call became tense."],
    weaknesses: [
      "Never obtained a real budget figure — accepted 'not sure yet' without a follow-up.",
      "Led with pricing before establishing what made the location special to this client.",
      "When the price objection came, responded with more options instead of isolating the concern.",
    ],
    dealRiskFactors: ["Lost to a competitor on price framing, not necessarily true budget mismatch.", "No follow-up scheduled after the objection surfaced."],
    followUp: { hasScheduledFollowUp: false, quality: "missing", notes: "Call ended without a next step after the objection." },
    transcript: [
      { speaker: "Federico", text: "Daniel, thanks for calling in. So we have a few packages — the lakeside package starts at $4,200, and then there's an upgraded version at $5,400 with the full floral wall." },
      { speaker: "Client", text: "Okay... that's more than I expected honestly." },
      { speaker: "Federico", text: "Sure, I can also show you our $3,000 tier if that's more comfortable, it just has less decor." },
      { speaker: "Client", text: "I mean, I'm also talking to two other companies, one quoted me $2,800 for something similar." },
      { speaker: "Federico", text: "We do include full setup and breakdown in our pricing, some companies charge that separately." },
      { speaker: "Client", text: "Maybe, I'd have to check. I'm honestly not sure what I want to spend yet." },
      { speaker: "Federico", text: "No worries — want me to send over all three tiers so you can compare?" },
      { speaker: "Client", text: "Sure, that's fine." },
      { speaker: "Federico", text: "I'll get that to you. Let me know if you have questions." },
      { speaker: "Client", text: "Will do, thanks." },
    ],
    objections: [
      {
        type: "price",
        text: "That's more than I expected / another company quoted $2,800 for something similar.",
        evidence: "Client: 'I'm also talking to two other companies, one quoted me $2,800 for something similar.'",
        severity: "high",
        handled: false,
        handlingQuality: 3,
        recommendedResponse: "Acknowledge, then isolate: 'Is the $2,800 quote for the same exclusivity window and full setup/breakdown, or a bare-bones version? And what would make this feel worth it regardless of the other quote?' — clarify the real concern before offering more options.",
      },
      {
        type: "competitor comparison",
        text: "Client is comparing against two other vendors, one significantly cheaper.",
        evidence: "Client: 'I'm also talking to two other companies'",
        severity: "high",
        handled: false,
        handlingQuality: 2,
        recommendedResponse: "Ask what specifically the client liked about the competitor's offer before responding with pricing, to understand if it's truly price or a feature difference.",
      },
    ],
    buyingSignals: [],
    missedOpportunities: [
      { category: "discovery", description: "Never established a real budget range or what mattered most about the lakeside location to Daniel.", recommendedAction: "Ask an anchoring budget-range question before presenting any prices." },
      { category: "closing", description: "No next step or follow-up call scheduled after sending the three tiers.", recommendedAction: "Always end with a scheduled follow-up, never 'let me know if you have questions'." },
    ],
    coachingInsights: [
      { category: "Value Presentation", kind: "weakness", insight: "Led with numbers in the first response of the call.", recommendation: "Practice a value-first opener before any pricing is mentioned, even when asked directly." },
      { category: "Objection Handling", kind: "weakness", insight: "Responded to a price objection with more options instead of clarifying the concern.", recommendation: "Roleplay isolating objections: 'is it the price, or something else' before responding." },
    ],
    nextActions: [{ action: "Send all three pricing tiers", owner: "Federico", dueDate: daysAgo(13), priority: "low" }],
  },
  {
    key: "c04",
    contact: { firstname: "Sofia", lastname: "Martins", email: "sofia.martins@example.com", phone: "+15555550104" },
    callType: "Package Consultation",
    daysAgo: 3,
    durationSeconds: 1740,
    direction: "outbound",
    deal: { name: "Martins — Vineyard Proposal", stage: "Proposal Sent", pipeline: "Event Bookings", amount: 7200, status: "open", closeDate: null, leadSource: "Instagram" },
    outcome: "follow_up_scheduled",
    sectionScores: [8, 16, 12, 12, 14, 10, 4],
    closeProbability: 55,
    sentiment: "positive",
    customerIntent: "Excited but needs partner's sign-off before committing.",
    summary: "Strong call overall; the main open item is that Sofia needs to discuss with her partner before deciding. Federico handled this well by offering a recap document and scheduling a joint call.",
    managerSummary: "Healthy pipeline call — needs a scheduled joint follow-up, already in motion.",
    coachingSummary: "Good handling of the 'need to check with partner' objection — Federico didn't just accept it, he offered a concrete artifact (recap + video) to bring into that conversation.",
    strengths: ["Offered a shareable recap so the partner conversation had something concrete to react to.", "Scheduled a specific joint follow-up call rather than leaving it open-ended."],
    weaknesses: ["Could have asked what the partner's biggest likely concern would be, to prepare for it proactively."],
    dealRiskFactors: ["Deal depends on a conversation Federico isn't present for."],
    followUp: { hasScheduledFollowUp: true, quality: "clear", notes: "Joint call scheduled in 5 days once partner has reviewed the recap." },
    transcript: [
      { speaker: "Federico", text: "Sofia, great talking through the vineyard option with you. How are you feeling about it?" },
      { speaker: "Client", text: "I love it honestly, it's exactly the vibe we wanted. I just need to run it by my partner before we commit to anything." },
      { speaker: "Federico", text: "Totally understandable, this is a big decision. What do you think matters most to him about a location like this?" },
      { speaker: "Client", text: "Probably that it doesn't feel over the top, he's more low-key." },
      { speaker: "Federico", text: "Good to know. I'll put together a short recap with photos and pricing that speaks to that — understated but still special — so you have something concrete to show him rather than trying to describe it." },
      { speaker: "Client", text: "That would help a lot." },
      { speaker: "Federico", text: "When do you think you two will get a chance to talk about it?" },
      { speaker: "Client", text: "Probably this weekend." },
      { speaker: "Federico", text: "Let's plan a quick call together early next week then, so I can answer anything he's wondering about directly." },
      { speaker: "Client", text: "Yeah, let's do that." },
    ],
    objections: [
      {
        type: "partner/family approval",
        text: "Needs to check with partner before committing.",
        evidence: "Client: 'I just need to run it by my partner before we commit to anything.'",
        severity: "medium",
        handled: true,
        handlingQuality: 8,
        recommendedResponse: "(Already handled well) Prepared a targeted recap addressing the partner's likely concern and scheduled a joint follow-up.",
      },
    ],
    buyingSignals: [{ type: "explicit enthusiasm", evidence: "Client: 'I love it honestly, it's exactly the vibe we wanted.'", strength: "high" }],
    missedOpportunities: [],
    coachingInsights: [
      { category: "Objection Handling", kind: "strength", insight: "Turned a 'need to check with partner' objection into a scheduled joint call instead of an open-ended pause.", recommendation: "Keep this pattern: recap artifact + specific joint follow-up time." },
    ],
    nextActions: [
      { action: "Send understated-vibe recap with photos and pricing", owner: "Federico", dueDate: daysAgo(2), priority: "high" },
      { action: "Joint call with Sofia and partner", owner: "Federico", dueDate: daysAgo(-4), priority: "high" },
    ],
  },
  {
    key: "c05",
    contact: { firstname: "Trevor", lastname: "Lin", email: "trevor.lin@example.com", phone: "+15555550105" },
    callType: "Proposal Planning",
    daysAgo: 21,
    durationSeconds: 900,
    direction: "outbound",
    deal: { name: "Lin — Beach Proposal", stage: "Discovery Call", pipeline: "Event Bookings", amount: 4500, status: "open", closeDate: null, leadSource: "Website" },
    outcome: "unresponsive",
    sectionScores: [7, 10, 8, 8, 8, 5, 1],
    closeProbability: 15,
    sentiment: "neutral",
    customerIntent: "Unclear — call ended without a firm next step, no response since.",
    summary: "Short call with light discovery. Federico presented one option without much personalization and closed with a vague 'I'll follow up sometime' commitment. No response from Trevor in 3 weeks.",
    managerSummary: "Stalled deal, likely lost to inaction. Follow-up discipline is the clear gap here.",
    coachingSummary: "The follow-up commitment was vague ('I'll touch base soon') with no specific date — that's very likely why this went cold. Needs a concrete next-step habit.",
    strengths: ["Friendly, low-pressure tone."],
    weaknesses: [
      "Follow-up commitment was vague with no specific date or channel.",
      "Only presented one location option without probing what Trevor was comparing it against.",
    ],
    dealRiskFactors: ["No activity in 3 weeks on a discovery-stage deal.", "No scheduled next contact."],
    followUp: { hasScheduledFollowUp: false, quality: "missing", notes: "Federico said 'I'll touch base soon' with no date attached." },
    transcript: [
      { speaker: "Federico", text: "Trevor, thanks for the call. So for a beach proposal, we usually do a small setup with an arch and some florals, runs around $4,500." },
      { speaker: "Client", text: "Okay, got it. I'm still pretty early in planning honestly." },
      { speaker: "Federico", text: "No worries, happy to send some info over whenever you're ready to move forward." },
      { speaker: "Client", text: "Sure, sounds good." },
      { speaker: "Federico", text: "I'll touch base soon then. Talk later!" },
    ],
    objections: [],
    buyingSignals: [],
    missedOpportunities: [
      { category: "follow-up", description: "No specific date or method for the next touchpoint.", recommendedAction: "Always commit to a specific date/time for the next contact, even with early-stage leads." },
      { category: "discovery", description: "Did not ask what 'early in planning' meant — no timeline, budget, or vision captured.", recommendedAction: "Run at least a light discovery pass even on short calls." },
    ],
    coachingInsights: [
      { category: "Follow-Up Discipline", kind: "weakness", insight: "'I'll touch base soon' with no date is exactly the vague commitment the scorecard flags.", recommendation: "Replace with a specific date: 'I'll call you next Tuesday at 2pm to check in.'" },
    ],
    nextActions: [{ action: "Follow up with Trevor", owner: "Federico", dueDate: null, priority: "low" }],
  },
  {
    key: "c06",
    contact: { firstname: "Amara", lastname: "Boyd", email: "amara.boyd@example.com", phone: "+15555550106" },
    callType: "Location Consultation",
    daysAgo: 6,
    durationSeconds: 1620,
    direction: "inbound",
    deal: { name: "Boyd — Botanical Garden Proposal", stage: "Proposal Sent", pipeline: "Event Bookings", amount: 6100, status: "open", closeDate: null, leadSource: "Referral" },
    outcome: "decision_pending",
    sectionScores: [9, 15, 11, 12, 13, 9, 4],
    closeProbability: 48,
    sentiment: "positive",
    customerIntent: "Wants to see the location before committing — visual uncertainty is the main blocker.",
    summary: "Amara is interested but wants to see the actual space before deciding, citing an experience where photos didn't match reality at another venue. Federico offered a video walkthrough, a good response, but didn't set a hard date for a decision after that.",
    managerSummary: "On track but needs a firmer decision timeline attached to the video delivery.",
    coachingSummary: "Good instinct offering the video, but the call ended without tying it to a specific decision date — add that next time.",
    strengths: ["Responded to visual uncertainty with a concrete video walkthrough rather than just reassurance."],
    weaknesses: ["Did not attach a specific decision date to the video delivery."],
    dealRiskFactors: ["Decision is contingent on a video Amara hasn't seen yet."],
    followUp: { hasScheduledFollowUp: true, quality: "vague", notes: "Video promised 'this week' but no specific decision call scheduled." },
    transcript: [
      { speaker: "Federico", text: "Amara, how are you feeling about the botanical garden option after seeing the photos?" },
      { speaker: "Client", text: "It looks beautiful, but honestly I got burned once before where photos looked amazing and the actual space felt totally different in person." },
      { speaker: "Federico", text: "That's a completely fair concern. I can send you a full video walkthrough of the exact spot, shot at the same time of day your event would happen, so there's no surprise." },
      { speaker: "Client", text: "That would help so much, yes please." },
      { speaker: "Federico", text: "I'll get that over to you this week." },
      { speaker: "Client", text: "Perfect, thank you." },
    ],
    objections: [
      {
        type: "visual uncertainty",
        text: "Photos looked amazing at another venue but the actual space felt different in person.",
        evidence: "Client: 'I got burned once before where photos looked amazing and the actual space felt totally different in person.'",
        severity: "medium",
        handled: true,
        handlingQuality: 7,
        recommendedResponse: "Add a specific decision date to the video delivery: 'Once you've seen it, can we plan to talk Thursday and make a call?'",
      },
    ],
    buyingSignals: [{ type: "positive reaction to photos", evidence: "Client: 'It looks beautiful'", strength: "medium" }],
    missedOpportunities: [
      { category: "closing", description: "No specific decision date attached to the video delivery.", recommendedAction: "Pair every 'I'll send X' with 'let's plan to decide by Y'." },
    ],
    coachingInsights: [
      { category: "Closing", kind: "weakness", insight: "Left the decision open-ended after promising the video.", recommendation: "Always attach a specific follow-up date when resolving a visual-uncertainty objection." },
    ],
    nextActions: [{ action: "Send video walkthrough of botanical garden spot", owner: "Federico", dueDate: daysAgo(2), priority: "high" }],
  },
  {
    key: "c07",
    contact: { firstname: "Julian", lastname: "Cho", email: "julian.cho@example.com", phone: "+15555550107" },
    callType: "Proposal Planning",
    daysAgo: 11,
    durationSeconds: 2100,
    direction: "outbound",
    deal: { name: "Cho — Rooftop Proposal", stage: "Closed Won", pipeline: "Event Bookings", amount: 8100, status: "closed_won", closeDate: daysAgo(7), leadSource: "Website" },
    outcome: "closed_won",
    sectionScores: [10, 19, 14, 14, 18, 14, 5],
    closeProbability: 91,
    sentiment: "positive",
    customerIntent: "High intent from the start, wanted premium option and a fast timeline.",
    summary: "Excellent full-cycle call — thorough discovery, personalized value presentation tying features to Julian's stated priorities, a well-handled availability objection, and a clean conditional close.",
    managerSummary: "Top-scoring call this period. Strong reference example for coaching.",
    coachingSummary: "This is the gold-standard call: every discovery answer was actively probed, the recommendation was tied explicitly to what Julian said mattered, and the close was natural.",
    strengths: [
      "Tied the rooftop's private elevator directly to Julian's stated priority (avoiding public exposure).",
      "Handled an availability objection by immediately checking the calendar live on the call.",
      "Used a clean conditional close and got a verbal deposit commitment.",
    ],
    weaknesses: [],
    dealRiskFactors: [],
    followUp: { hasScheduledFollowUp: true, quality: "clear", notes: "Deposit invoice sent same day, signed within 24 hours." },
    transcript: [
      { speaker: "Federico", text: "Julian, let's dig in — what matters most to you about how this moment feels?" },
      { speaker: "Client", text: "I really don't want randoms walking through or filming us, that would ruin it." },
      { speaker: "Federico", text: "Understood, privacy is priority one. What's your target timeframe?" },
      { speaker: "Client", text: "Ideally within the next 3 weeks, her birthday is coming up." },
      { speaker: "Federico", text: "Good to know — is availability within 3 weeks something you're worried about?" },
      { speaker: "Client", text: "Yeah actually, is that even possible?" },
      { speaker: "Federico", text: "Let me check right now — yes, we have the rooftop slot open two Saturdays from now at sunset. Given the privacy priority you mentioned, that location has a private elevator hold and a locked-off floor for your window, no public access at all." },
      { speaker: "Client", text: "That's exactly what I wanted." },
      { speaker: "Federico", text: "Given that fits both the timeline and the privacy you need, would you be comfortable putting down the deposit today to lock that date in before it's gone?" },
      { speaker: "Client", text: "Yes, let's do it." },
    ],
    objections: [
      {
        type: "availability",
        text: "Concerned whether the 3-week timeline was even possible.",
        evidence: "Client: 'Yeah actually, is that even possible?'",
        severity: "low",
        handled: true,
        handlingQuality: 10,
        recommendedResponse: "(Already handled excellently) Checked live availability on the call instead of promising to follow up later.",
      },
    ],
    buyingSignals: [
      { type: "explicit match to stated priority", evidence: "Client: 'That's exactly what I wanted.'", strength: "high" },
      { type: "verbal deposit commitment", evidence: "Client: 'Yes, let's do it.'", strength: "high" },
    ],
    missedOpportunities: [],
    coachingInsights: [
      { category: "Closing", kind: "strength", insight: "Checked availability live rather than deferring, removing friction at the exact moment of highest interest.", recommendation: "Keep this — resolve logistics objections in real time whenever possible." },
    ],
    nextActions: [{ action: "Send deposit invoice", owner: "Federico", dueDate: daysAgo(7), priority: "high" }],
  },
  {
    key: "c08",
    contact: { firstname: "Renee", lastname: "Falk", email: "renee.falk@example.com", phone: "+15555550108" },
    callType: "Package Consultation",
    daysAgo: 17,
    durationSeconds: 1080,
    direction: "outbound",
    deal: { name: "Falk — Garden Proposal", stage: "Closed Lost", pipeline: "Event Bookings", amount: 4900, status: "closed_lost", closeDate: daysAgo(9), leadSource: "Instagram" },
    outcome: "closed_lost",
    sectionScores: [8, 11, 9, 9, 7, 6, 2],
    closeProbability: 18,
    sentiment: "negative",
    customerIntent: "Actively comparing a competitor's all-inclusive package.",
    summary: "Renee raised a direct competitor comparison. Federico acknowledged it but didn't ask what specifically the competitor offered, so his response addressed the wrong thing and didn't move the deal forward.",
    managerSummary: "Lost to a competitor largely due to a surface-level response to the comparison objection.",
    coachingSummary: "When a client compares to a competitor, always ask what specifically was included before responding — Federico defended on price when the real gap may have been an included service.",
    strengths: ["Stayed professional despite the direct comparison."],
    weaknesses: ["Did not ask what was included in the competitor's package before responding.", "No next step proposed after the objection."],
    dealRiskFactors: ["Lost to a named competitor.", "No follow-up scheduled."],
    followUp: { hasScheduledFollowUp: false, quality: "missing", notes: "Call ended without any next step." },
    transcript: [
      { speaker: "Client", text: "I'll be honest, another company is offering an all-inclusive package for less than yours." },
      { speaker: "Federico", text: "We do include full setup, florals, and photography in our price, so it should be comparable." },
      { speaker: "Client", text: "Maybe, I'd have to compare more closely." },
      { speaker: "Federico", text: "Sure, let me know what you decide." },
      { speaker: "Client", text: "Will do." },
    ],
    objections: [
      {
        type: "competitor comparison",
        text: "Another company is offering an all-inclusive package for less.",
        evidence: "Client: 'another company is offering an all-inclusive package for less than yours.'",
        severity: "high",
        handled: false,
        handlingQuality: 3,
        recommendedResponse: "Ask 'what's included in their all-inclusive package?' before responding — the gap may be a specific service, not overall price.",
      },
    ],
    buyingSignals: [],
    missedOpportunities: [
      { category: "objection handling", description: "Never clarified what 'all-inclusive' meant for the competitor's offer.", recommendedAction: "Always ask for specifics before countering a competitor comparison." },
      { category: "closing", description: "No next step proposed after the objection.", recommendedAction: "End every call with a specific next action, even a hard one." },
    ],
    coachingInsights: [
      { category: "Objection Handling", kind: "weakness", insight: "Responded to a competitor comparison without knowing what was actually being compared.", recommendation: "Practice: 'What does their package include exactly?' as an automatic first response to any competitor mention." },
    ],
    nextActions: [{ action: "Awaiting client comparison", owner: "Renee", dueDate: null, priority: "low" }],
  },
  {
    key: "c09",
    contact: { firstname: "Ibrahim", lastname: "Haddad", email: "ibrahim.haddad@example.com", phone: "+15555550109" },
    callType: "Location Consultation",
    daysAgo: 8,
    durationSeconds: 1560,
    direction: "inbound",
    deal: { name: "Haddad — Rooftop Proposal", stage: "Proposal Sent", pipeline: "Event Bookings", amount: 5600, status: "open", closeDate: null, leadSource: "Website" },
    outcome: "follow_up_scheduled",
    sectionScores: [9, 15, 12, 12, 15, 11, 4],
    closeProbability: 60,
    sentiment: "positive",
    customerIntent: "Concerned about permits and privacy at a public rooftop location.",
    summary: "Ibrahim was worried about needing a permit and whether the public rooftop would really be private. Federico clarified that Elite Marry Me handles all permits and explained the exclusivity window clearly.",
    managerSummary: "Well-handled dual objection (permits + privacy), healthy pipeline deal.",
    coachingSummary: "Clean example of handling a compound objection by breaking it into its two parts before responding to each.",
    strengths: ["Broke a compound objection (permits + privacy) into two parts and addressed each specifically."],
    weaknesses: ["Could have confirmed resolution more explicitly ('does that fully put your mind at ease?') before moving on."],
    dealRiskFactors: [],
    followUp: { hasScheduledFollowUp: true, quality: "clear", notes: "Follow-up call scheduled in 4 days to finalize." },
    transcript: [
      { speaker: "Client", text: "Do we need to get our own permit for that rooftop? And is it actually private or will there be other people up there?" },
      { speaker: "Federico", text: "Good questions, let me take those one at a time. Permits — we handle all of that on our end, it's included, you don't need to do anything. On privacy, we book a 45-minute exclusive window where the space is closed to the public, just your group and our on-site coordinator." },
      { speaker: "Client", text: "Oh that's a relief, I thought we'd have to deal with paperwork." },
      { speaker: "Federico", text: "Nope, all handled. Anything else on your mind about the space?" },
      { speaker: "Client", text: "No, I think that covers it." },
      { speaker: "Federico", text: "Great, let's plan a follow-up call in a few days once you've talked it over, does Thursday work?" },
      { speaker: "Client", text: "Thursday works." },
    ],
    objections: [
      {
        type: "permits",
        text: "Worried about needing to obtain their own permit.",
        evidence: "Client: 'Do we need to get our own permit for that rooftop?'",
        severity: "low",
        handled: true,
        handlingQuality: 9,
        recommendedResponse: "(Already handled well)",
      },
      {
        type: "privacy",
        text: "Concerned the rooftop wouldn't actually be private.",
        evidence: "Client: 'is it actually private or will there be other people up there?'",
        severity: "medium",
        handled: true,
        handlingQuality: 8,
        recommendedResponse: "(Already handled well)",
      },
    ],
    buyingSignals: [{ type: "relief/positive reaction", evidence: "Client: 'Oh that's a relief'", strength: "medium" }],
    missedOpportunities: [],
    coachingInsights: [
      { category: "Objection Handling", kind: "strength", insight: "Split a compound objection into two clear parts before answering.", recommendation: "Keep doing this on multi-part questions." },
    ],
    nextActions: [{ action: "Follow-up call Thursday", owner: "Federico", dueDate: daysAgo(4), priority: "medium" }],
  },
  {
    key: "c10",
    contact: { firstname: "Grace", lastname: "Whitfield", email: "grace.whitfield@example.com", phone: "+15555550110" },
    callType: "Location Consultation",
    daysAgo: 25,
    durationSeconds: 1440,
    direction: "outbound",
    deal: { name: "Whitfield — Autumn Vineyard Proposal", stage: "Discovery Call", pipeline: "Event Bookings", amount: 5900, status: "open", closeDate: null, leadSource: "Referral" },
    outcome: "decision_pending",
    sectionScores: [8, 14, 10, 10, 12, 9, 3],
    closeProbability: 40,
    sentiment: "mixed",
    customerIntent: "Worried the location won't look as good outside of peak foliage season.",
    summary: "Grace is concerned about seasonality — her date falls after peak foliage. Federico addressed it reasonably but leaned on reassurance rather than offering concrete evidence (past-year photos).",
    managerSummary: "Needs a concrete seasonal-evidence follow-up to move forward.",
    coachingSummary: "Good instinct to reassure, but should have offered photos from the same week in a previous year rather than a general assurance.",
    strengths: ["Acknowledged the seasonal concern directly instead of dismissing it."],
    weaknesses: ["Responded with general reassurance rather than concrete evidence (comparable past-year photos)."],
    dealRiskFactors: ["Decision blocked on a concern not yet resolved with evidence."],
    followUp: { hasScheduledFollowUp: true, quality: "vague", notes: "Said would 'look into some photos' without a specific delivery date." },
    transcript: [
      { speaker: "Client", text: "My date is technically after peak foliage, I'm worried it'll look kind of bare." },
      { speaker: "Federico", text: "It's usually still really beautiful that time of year, I wouldn't worry too much." },
      { speaker: "Client", text: "I'd feel better seeing it though, if that's possible." },
      { speaker: "Federico", text: "Yeah, let me look into some photos from around that time last year and send them over." },
      { speaker: "Client", text: "That would help, thanks." },
    ],
    objections: [
      {
        type: "weather/seasonality",
        text: "Date falls after peak foliage season, worried the location will look bare.",
        evidence: "Client: 'My date is technically after peak foliage, I'm worried it'll look kind of bare.'",
        severity: "medium",
        handled: false,
        handlingQuality: 5,
        recommendedResponse: "Offer specific comparable-date photos from a previous year immediately, with a firm delivery date, rather than general reassurance.",
      },
    ],
    buyingSignals: [],
    missedOpportunities: [
      { category: "objection handling", description: "Used general reassurance instead of concrete evidence for a visual/seasonal concern.", recommendedAction: "Keep a library of past-year seasonal photos ready to send immediately for this exact objection." },
    ],
    coachingInsights: [
      { category: "Objection Handling", kind: "weakness", insight: "Responded to a seasonality concern with reassurance rather than evidence.", recommendation: "For any visual-uncertainty objection, always offer specific photo/video evidence, not just verbal reassurance." },
    ],
    nextActions: [{ action: "Send comparable past-year foliage photos", owner: "Federico", dueDate: null, priority: "medium" }],
  },
  {
    key: "c11",
    contact: { firstname: "Noah", lastname: "Park", email: "noah.park@example.com", phone: "+15555550111" },
    callType: "Gender Reveal",
    daysAgo: 2,
    durationSeconds: 1980,
    direction: "inbound",
    deal: { name: "Park — Rooftop Gender Reveal", stage: "Closed Won", pipeline: "Event Bookings", amount: 4400, status: "closed_won", closeDate: daysAgo(1), leadSource: "Referral" },
    outcome: "closed_won",
    sectionScores: [10, 18, 14, 13, 17, 13, 5],
    closeProbability: 90,
    sentiment: "positive",
    customerIntent: "Ready to book, wanted confirmation on a few details.",
    summary: "Very strong discovery and closing call. Federico surfaced a hidden must-have (allergy-safe confetti) that could have caused a problem on event day.",
    managerSummary: "Excellent call, no gaps identified.",
    coachingSummary: "Great catch on the allergy detail — this is exactly the kind of 'must-have/barrier' discovery the scorecard rewards.",
    strengths: ["Proactively asked about allergies/sensitivities, surfacing a must-have that wasn't volunteered.", "Clean close with deposit collected same call."],
    weaknesses: [],
    dealRiskFactors: [],
    followUp: { hasScheduledFollowUp: true, quality: "clear", notes: "Deposit collected on the call; confirmation email sent immediately after." },
    transcript: [
      { speaker: "Federico", text: "Before we finalize the confetti cannon setup, is anyone in the group sensitive to fragrances or has allergies we should know about?" },
      { speaker: "Client", text: "Actually yes, my sister has a pretty bad pollen allergy, good thing you asked." },
      { speaker: "Federico", text: "Good catch — we'll use our hypoallergenic confetti mix for this one, no risk there." },
      { speaker: "Client", text: "That's great, I wouldn't have thought to mention it." },
      { speaker: "Federico", text: "Happy to catch it now. Are we good to lock in the date and package we discussed?" },
      { speaker: "Client", text: "Yes, let's do it." },
      { speaker: "Federico", text: "Great, I'll send the deposit link right now while we're on the call." },
    ],
    objections: [],
    buyingSignals: [{ type: "explicit booking confirmation", evidence: "Client: 'Yes, let's do it.'", strength: "high" }],
    missedOpportunities: [],
    coachingInsights: [
      { category: "Discovery", kind: "strength", insight: "Proactively surfaced an allergy concern the client hadn't volunteered.", recommendation: "Add this allergy/sensitivity question as a standard checklist item for every confetti/floral setup." },
    ],
    nextActions: [{ action: "Send confirmation email", owner: "Federico", dueDate: daysAgo(1), priority: "high" }],
  },
  {
    key: "c12",
    contact: { firstname: "Leah", lastname: "Summers", email: "leah.summers@example.com", phone: "+15555550112" },
    callType: "Package Consultation",
    daysAgo: 19,
    durationSeconds: 1620,
    direction: "outbound",
    deal: { name: "Summers — Proposal Package", stage: "Proposal Sent", pipeline: "Event Bookings", amount: 5200, status: "open", closeDate: null, leadSource: "Website" },
    outcome: "follow_up_needed",
    sectionScores: [8, 13, 10, 9, 11, 8, 3],
    closeProbability: 35,
    sentiment: "neutral",
    customerIntent: "Overwhelmed by options, no clear preference emerged.",
    summary: "Federico presented five different package tiers and two locations without helping Leah narrow down, leaving her without a clear preference or recommendation to react to.",
    managerSummary: "Classic 'too many options' pattern flagged in the spec — needs coaching on narrowing.",
    coachingSummary: "Presenting every option without a recommendation puts the decision-making burden entirely on the client — narrow to 1-2 options based on discovery before presenting.",
    strengths: ["Thorough knowledge of all package options."],
    weaknesses: ["Presented five tiers and two locations without narrowing based on what was discovered.", "Did not make a personalized recommendation."],
    dealRiskFactors: ["Decision paralysis risk — no clear next step for Leah to evaluate."],
    followUp: { hasScheduledFollowUp: true, quality: "vague", notes: "Said would 'check back in a bit' with no specific date." },
    transcript: [
      { speaker: "Federico", text: "So we've got the Essential package at $2,800, Classic at $3,600, Premium at $4,500, Deluxe at $5,200, and the Signature experience at $6,900 — and that's across either the garden or the rooftop location." },
      { speaker: "Client", text: "Wow, okay, that's a lot to take in." },
      { speaker: "Federico", text: "Yeah there's a lot to consider! Take your time looking it over." },
      { speaker: "Client", text: "I'm not really sure where to start, honestly." },
      { speaker: "Federico", text: "No worries, I'll check back in a bit and see where your head's at." },
    ],
    objections: [],
    buyingSignals: [],
    missedOpportunities: [
      { category: "value presentation", description: "Presented all five tiers and both locations at once without narrowing based on discovery.", recommendedAction: "Narrow to 1-2 recommended options tied explicitly to what the client said mattered, before listing every tier." },
      { category: "closing", description: "No specific follow-up date given.", recommendedAction: "Replace 'I'll check back in a bit' with a specific date and time." },
    ],
    coachingInsights: [
      { category: "Value Presentation", kind: "weakness", insight: "Listed every option without a recommendation, leaving the client overwhelmed.", recommendation: "Practice narrowing to a top pick + one alternative, framed around the client's stated priorities." },
    ],
    nextActions: [{ action: "Follow up on package decision", owner: "Federico", dueDate: null, priority: "medium" }],
  },
  {
    key: "c13",
    contact: { firstname: "Owen", lastname: "Bennett", email: "owen.bennett@example.com", phone: "+15555550113" },
    callType: "Proposal Planning",
    daysAgo: 30,
    durationSeconds: 1200,
    direction: "outbound",
    deal: { name: "Bennett — Downtown Proposal", stage: "Closed Lost", pipeline: "Event Bookings", amount: 3900, status: "closed_lost", closeDate: daysAgo(20), leadSource: "Instagram" },
    outcome: "closed_lost",
    sectionScores: [7, 9, 8, 8, 7, 6, 2],
    closeProbability: 12,
    sentiment: "negative",
    customerIntent: "Went with a competitor after budget mismatch was never surfaced.",
    summary: "Federico never asked about budget and presented a package well above what Owen was prepared to spend, discovered only when Owen went quiet after the pricing was shared.",
    managerSummary: "Lost primarily due to a discovery gap — no budget question anywhere in the call.",
    coachingSummary: "This deal likely could have been saved or redirected to a lower tier if budget had been discovered early — instead the mismatch surfaced only as silence after the price was shared.",
    strengths: [],
    weaknesses: ["No budget question anywhere in the call.", "Did not notice or address Owen's disengagement after pricing was mentioned."],
    dealRiskFactors: ["Total discovery gap on budget.", "Client went unresponsive after this call and booked elsewhere."],
    followUp: { hasScheduledFollowUp: false, quality: "missing", notes: "No follow-up scheduled." },
    transcript: [
      { speaker: "Federico", text: "Owen, for a downtown rooftop setup like you described, we'd be looking at the Premium package at $3,900." },
      { speaker: "Client", text: "Oh. Okay." },
      { speaker: "Federico", text: "It includes the florals, arch, and a photographer for 45 minutes." },
      { speaker: "Client", text: "Got it, I'll think about it." },
      { speaker: "Federico", text: "Sounds good, let me know." },
    ],
    objections: [],
    buyingSignals: [],
    missedOpportunities: [
      { category: "discovery", description: "No budget question was asked at any point in the call.", recommendedAction: "Always ask an anchoring budget-range question before presenting any package price." },
      { category: "objection handling", description: "Client's short, flat response ('Oh. Okay.') after the price was not explored as a possible signal of budget mismatch.", recommendedAction: "Treat a flat or hesitant reaction to price as a cue to pause and ask directly what would feel comfortable." },
    ],
    coachingInsights: [
      { category: "Discovery", kind: "weakness", insight: "No budget discovery occurred anywhere in the call.", recommendation: "Make the budget-range question a mandatory step before any pricing is shared, no exceptions." },
    ],
    nextActions: [{ action: "Awaiting client decision", owner: "Owen", dueDate: null, priority: "low" }],
  },
  {
    key: "c14",
    contact: { firstname: "Zara", lastname: "Ahmed", email: "zara.ahmed@example.com", phone: "+15555550114" },
    callType: "Location Consultation",
    daysAgo: 5,
    durationSeconds: 1380,
    direction: "inbound",
    deal: { name: "Ahmed — Desert Sunset Proposal", stage: "Negotiation", pipeline: "Event Bookings", amount: 6300, status: "open", closeDate: null, leadSource: "Website" },
    outcome: "decision_pending",
    sectionScores: [9, 15, 11, 11, 13, 10, 4],
    closeProbability: 52,
    sentiment: "positive",
    customerIntent: "Excited about the location but worried about travel logistics for guests.",
    summary: "Zara loves the desert location but is concerned about how out-of-town guests will handle the drive and lack of nearby lodging. Federico addressed it with a shuttle option, a solid answer, but didn't confirm it resolved the concern.",
    managerSummary: "Strong deal, minor process gap on confirming resolution.",
    coachingSummary: "The shuttle solution was a good, specific answer — just make sure to explicitly confirm it resolves the concern before moving on.",
    strengths: ["Offered a specific, relevant solution (shuttle service) rather than a generic reassurance."],
    weaknesses: ["Did not explicitly confirm the shuttle solution resolved the concern before moving to the next topic."],
    dealRiskFactors: [],
    followUp: { hasScheduledFollowUp: true, quality: "clear", notes: "Sending shuttle logistics doc, follow-up call in 3 days." },
    transcript: [
      { speaker: "Client", text: "I love the location but I'm worried about my out-of-town guests making the drive, there's nothing nearby." },
      { speaker: "Federico", text: "That's a really common concern for that venue — we actually offer a shuttle service from the two closest hotels, so guests don't have to drive themselves at all." },
      { speaker: "Client", text: "Oh, I didn't know that was an option." },
      { speaker: "Federico", text: "Yeah, it's a popular add-on for that spot specifically. I'll send you the shuttle details and pricing." },
      { speaker: "Client", text: "Great, thank you." },
    ],
    objections: [
      {
        type: "logistics/travel",
        text: "Worried about guest travel logistics to a remote desert location.",
        evidence: "Client: 'I'm worried about my out-of-town guests making the drive, there's nothing nearby.'",
        severity: "medium",
        handled: true,
        handlingQuality: 7,
        recommendedResponse: "After presenting the shuttle option, explicitly ask 'does that solve the concern for you?' before moving on.",
      },
    ],
    buyingSignals: [{ type: "positive reaction to new information", evidence: "Client: 'Oh, I didn't know that was an option.'", strength: "medium" }],
    missedOpportunities: [
      { category: "objection handling", description: "Did not explicitly confirm the shuttle solution resolved the concern.", recommendedAction: "Add an explicit resolution check after answering any logistics objection." },
    ],
    coachingInsights: [
      { category: "Objection Handling", kind: "strength", insight: "Solved a logistics concern with a specific, relevant offering (shuttle service).", recommendation: "Just add the explicit confirmation step — 'does that fully address it?'" },
    ],
    nextActions: [{ action: "Send shuttle logistics and pricing", owner: "Federico", dueDate: daysAgo(4), priority: "medium" }],
  },
  {
    key: "c15",
    contact: { firstname: "Colin", lastname: "Duarte", email: "colin.duarte@example.com", phone: "+15555550115" },
    callType: "Package Consultation",
    daysAgo: 27,
    durationSeconds: 780,
    direction: "outbound",
    deal: { name: "Duarte — Lakeside Package", stage: "Discovery Call", pipeline: "Event Bookings", amount: 4100, status: "open", closeDate: null, leadSource: "Referral" },
    outcome: "unresponsive",
    sectionScores: [6, 9, 7, 7, 6, 4, 1],
    closeProbability: 10,
    sentiment: "negative",
    customerIntent: "Wanted to choose their own photographer, call ended without resolution.",
    summary: "Colin wanted to bring his own photographer rather than use Elite Marry Me's vendor, and the call ended without a clear resolution or scheduled follow-up. No response since.",
    managerSummary: "Stalled and now unresponsive — the vendor-selection objection was never actually resolved.",
    coachingSummary: "This objection was left hanging — Federico said he'd 'check on it' with no timeframe, and there's been no follow-up in 3+ weeks.",
    strengths: [],
    weaknesses: ["Did not resolve the vendor-selection objection before ending the call.", "No follow-up date given, no follow-up occurred since."],
    dealRiskFactors: ["Unresolved objection with no follow-up in over 3 weeks.", "High risk of having gone with a competitor who allows outside vendors."],
    followUp: { hasScheduledFollowUp: false, quality: "missing", notes: "No follow-up scheduled or completed." },
    transcript: [
      { speaker: "Client", text: "Can I use my own photographer instead of one of yours?" },
      { speaker: "Federico", text: "Hmm, I'd have to check on that, we usually include our own." },
      { speaker: "Client", text: "Okay, let me know." },
      { speaker: "Federico", text: "Will do." },
    ],
    objections: [
      {
        type: "vendor selection",
        text: "Wants to bring their own photographer instead of using the included one.",
        evidence: "Client: 'Can I use my own photographer instead of one of yours?'",
        severity: "medium",
        handled: false,
        handlingQuality: 2,
        recommendedResponse: "Answer definitively on the call if possible, or commit to a same-day answer with a specific time — never leave a vendor-selection question open-ended.",
      },
    ],
    buyingSignals: [],
    missedOpportunities: [
      { category: "objection handling", description: "Left a vendor-selection question completely unresolved with no timeframe.", recommendedAction: "Know the outside-vendor policy cold, or commit to a same-day answer." },
      { category: "follow-up", description: "No follow-up occurred in over 3 weeks after an unresolved objection.", recommendedAction: "Any unresolved objection should trigger a follow-up within 24-48 hours, not an open-ended 'will do'." },
    ],
    coachingInsights: [
      { category: "Objection Handling", kind: "weakness", insight: "Left a specific, answerable question ('can I use my own photographer') completely unresolved.", recommendation: "Get a definitive answer on outside-vendor policy memorized so this never has to be deferred." },
    ],
    nextActions: [{ action: "Confirm outside-vendor photographer policy with Colin", owner: "Federico", dueDate: null, priority: "high" }],
  },
];

function buildContact(s: Scenario): Contact {
  return {
    id: `demo-contact-${s.key}`,
    hubspot_contact_id: null,
    firstname: s.contact.firstname,
    lastname: s.contact.lastname,
    email: s.contact.email,
    phone: s.contact.phone,
    created_at: daysAgo(s.daysAgo + 5),
    updated_at: daysAgo(s.daysAgo),
  };
}

function buildDeal(s: Scenario): Deal {
  return {
    id: `demo-deal-${s.key}`,
    hubspot_deal_id: null,
    contact_id: `demo-contact-${s.key}`,
    deal_name: s.deal.name,
    stage: s.deal.stage,
    pipeline: s.deal.pipeline,
    amount: s.deal.amount,
    status: s.deal.status,
    owner_id: FEDERICO.id,
    close_date: s.deal.closeDate,
    created_at: daysAgo(s.daysAgo + 5),
    updated_at: daysAgo(Math.max(s.daysAgo - 1, 0)),
  };
}

function buildTranscript(s: Scenario): CallTranscript {
  const text = s.transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n\n");
  return {
    id: `demo-transcript-${s.key}`,
    call_id: `demo-call-${s.key}`,
    transcript_text: text,
    transcript_json: s.transcript,
    source: "quo",
    speaker_mapping: { Federico: "sales_rep", Client: "contact" },
    created_at: daysAgo(s.daysAgo),
  };
}

function buildAnalysis(s: Scenario): CallAnalysisFull {
  const overallScore = s.sectionScores.reduce((a, b) => a + b, 0);
  const criterionScores: CriterionScore[] = ELITE_MARRY_ME_SCORECARD.map((section, i) => ({
    id: `demo-crit-${s.key}-${i}`,
    call_analysis_id: `demo-analysis-${s.key}`,
    criterion_id: null,
    section_name: section.name,
    criterion_name: section.name,
    score: s.sectionScores[i],
    max_score: section.weight,
    explanation: sectionExplanation(section.name, s),
    evidence: sectionEvidence(section.name, s),
  }));

  const objections: Objection[] = s.objections.map((o, i) => ({
    id: `demo-obj-${s.key}-${i}`,
    call_analysis_id: `demo-analysis-${s.key}`,
    objection_type: o.type,
    objection_text: o.text,
    evidence: o.evidence,
    severity: o.severity,
    handled: o.handled,
    handling_quality: o.handlingQuality,
    recommended_response: o.recommendedResponse,
  }));

  const buyingSignals: BuyingSignal[] = s.buyingSignals.map((b, i) => ({
    id: `demo-signal-${s.key}-${i}`,
    call_analysis_id: `demo-analysis-${s.key}`,
    type: b.type,
    evidence: b.evidence,
    strength: b.strength,
  }));

  const missedOpportunities: MissedOpportunity[] = s.missedOpportunities.map((m, i) => ({
    id: `demo-missed-${s.key}-${i}`,
    call_analysis_id: `demo-analysis-${s.key}`,
    category: m.category,
    description: m.description,
    recommended_action: m.recommendedAction,
  }));

  const nextActions: NextAction[] = s.nextActions.map((n, i) => ({
    id: `demo-action-${s.key}-${i}`,
    call_analysis_id: `demo-analysis-${s.key}`,
    action: n.action,
    owner: n.owner,
    due_date: n.dueDate,
    priority: n.priority,
    completed: s.outcome === "closed_won" || s.outcome === "closed_lost",
  }));

  const coachingInsights: CoachingInsight[] = s.coachingInsights.map((c, i) => ({
    id: `demo-coach-${s.key}-${i}`,
    call_analysis_id: `demo-analysis-${s.key}`,
    category: c.category,
    strength_or_weakness: c.kind,
    insight: c.insight,
    recommendation: c.recommendation,
  }));

  return {
    id: `demo-analysis-${s.key}`,
    call_id: `demo-call-${s.key}`,
    scorecard_template_id: DEMO_SCORECARD_TEMPLATE_ID,
    overall_score: overallScore,
    summary: s.summary,
    call_outcome: s.outcome,
    close_probability: s.closeProbability,
    sentiment: s.sentiment,
    customer_intent: s.customerIntent,
    coaching_summary: s.coachingSummary,
    manager_summary: s.managerSummary,
    strengths: s.strengths,
    weaknesses: s.weaknesses,
    deal_risk_factors: s.dealRiskFactors,
    follow_up_assessment: s.followUp,
    raw_response: null,
    analyzed_at: daysAgo(Math.max(s.daysAgo - 0.02, 0)),
    model_used: "claude-sonnet-5 (seed data)",
    prompt_version: "elite-marry-me-v1",
    criterion_scores: criterionScores,
    objections,
    buying_signals: buyingSignals,
    missed_opportunities: missedOpportunities,
    next_actions: nextActions,
    coaching_insights: coachingInsights,
  };
}

function sectionExplanation(sectionName: string, s: Scenario): string {
  const idx = ELITE_MARRY_ME_SCORECARD.findIndex((sec) => sec.name === sectionName);
  const score = s.sectionScores[idx];
  const max = ELITE_MARRY_ME_SCORECARD[idx].weight;
  const pct = score / max;
  if (pct >= 0.85) return `Strong performance in this section — see coaching notes for specifics.`;
  if (pct >= 0.6) return `Solid but not exceptional performance in this section.`;
  return `Below-target performance in this section — see coaching notes and missed opportunities for specifics.`;
}

function sectionEvidence(sectionName: string, s: Scenario): string {
  if (sectionName === "Objection Handling" && s.objections[0]) return s.objections[0].evidence;
  if (sectionName === "Closing" && s.buyingSignals[0]) return s.buyingSignals[0].evidence;
  if (sectionName === "Discovery") return s.transcript[1]?.text.slice(0, 200) ?? "UNKNOWN";
  return s.transcript[0]?.text.slice(0, 200) ?? "UNKNOWN";
}

export const DEMO_CONTACTS: Contact[] = scenarios.map(buildContact);
export const DEMO_DEALS: Deal[] = scenarios.map(buildDeal);
export const DEMO_TRANSCRIPTS: CallTranscript[] = scenarios.map(buildTranscript);
export const DEMO_ANALYSES: CallAnalysisFull[] = scenarios.map(buildAnalysis);

export const DEMO_CALLS: CallWithRelations[] = scenarios.map((s, i) => {
  const analysis = DEMO_ANALYSES[i];
  const started = daysAgo(s.daysAgo);
  return {
    id: `demo-call-${s.key}`,
    quo_call_id: `demo-quo-${s.key}`,
    contact_id: `demo-contact-${s.key}`,
    deal_id: `demo-deal-${s.key}`,
    sales_rep_id: FEDERICO.id,
    call_type: s.callType,
    started_at: started,
    ended_at: new Date(new Date(started).getTime() + s.durationSeconds * 1000).toISOString(),
    duration_seconds: s.durationSeconds,
    direction: s.direction,
    status: "completed",
    recording_url_or_reference: null,
    transcript_status: "ready",
    analysis_status: "completed",
    analysis_error: null,
    source: "quo",
    created_at: started,
    contact: DEMO_CONTACTS[i],
    deal: DEMO_DEALS[i],
    sales_rep: FEDERICO,
    transcript: DEMO_TRANSCRIPTS[i],
    analysis,
  };
});

export const DEMO_ALERTS: Alert[] = (() => {
  const alerts: Alert[] = [];
  for (const call of DEMO_CALLS) {
    const a = call.analysis!;
    const deal = call.deal!;
    if (deal.status === "open" && (a.close_probability ?? 0) >= 75 && !a.next_actions.some((n) => !n.completed)) {
      alerts.push({
        id: `demo-alert-hot-${call.id}`,
        call_id: call.id,
        deal_id: deal.id,
        rule_key: "HOT_LEAD",
        severity: "warning",
        title: `Hot lead with no clear next action — ${call.contact?.firstname} ${call.contact?.lastname}`,
        description: "Close probability is high but no open next action is recorded.",
        resolved: false,
        created_at: call.created_at,
      });
    }
    if (deal.status === "open" && a.buying_signals.some((b) => b.strength !== "low") && (a.overall_score ?? 0) < 60) {
      alerts.push({
        id: `demo-alert-missed-close-${call.id}`,
        call_id: call.id,
        deal_id: deal.id,
        rule_key: "CLOSING_OPPORTUNITY_MISSED",
        severity: "warning",
        title: `Buying signal present but low closing score — ${call.contact?.firstname} ${call.contact?.lastname}`,
        description: "Strong buying signal detected, but overall call score is below target.",
        resolved: false,
        created_at: call.created_at,
      });
    }
    if (a.objections.some((o) => o.severity === "high" && !o.handled)) {
      alerts.push({
        id: `demo-alert-price-risk-${call.id}`,
        call_id: call.id,
        deal_id: deal.id,
        rule_key: "PRICE_RISK",
        severity: "critical",
        title: `Unresolved high-severity objection — ${call.contact?.firstname} ${call.contact?.lastname}`,
        description: "A high-severity objection was not handled and no resolution is on record.",
        resolved: false,
        created_at: call.created_at,
      });
    }
    if (deal.amount && deal.amount >= 6000 && (a.overall_score ?? 0) < 60) {
      alerts.push({
        id: `demo-alert-highvalue-${call.id}`,
        call_id: call.id,
        deal_id: deal.id,
        rule_key: "HIGH_VALUE_RISK",
        severity: "critical",
        title: `High-value deal with low call score — ${call.contact?.firstname} ${call.contact?.lastname}`,
        description: `Deal amount $${deal.amount} with overall score ${a.overall_score}/100.`,
        resolved: false,
        created_at: call.created_at,
      });
    }
    if (a.follow_up_assessment && (a.follow_up_assessment as { quality?: string }).quality !== "clear" && deal.status === "open") {
      alerts.push({
        id: `demo-alert-followup-${call.id}`,
        call_id: call.id,
        deal_id: deal.id,
        rule_key: "FOLLOW_UP_OVERDUE",
        severity: "info",
        title: `Vague or missing follow-up — ${call.contact?.firstname} ${call.contact?.lastname}`,
        description: "Follow-up commitment was vague or missing on this call.",
        resolved: false,
        created_at: call.created_at,
      });
    }
  }
  return alerts;
})();

export const ELITE_MARRY_ME_SCORECARD_NAME_EXPORT = ELITE_MARRY_ME_SCORECARD_NAME;
