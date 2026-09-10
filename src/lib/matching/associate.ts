import { getHubSpotService, isHubSpotConfigured } from "@/services/hubspot";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getManualCallById, updateManualCall } from "@/lib/data/manual-store";
import type { HubSpotContact, HubSpotDeal } from "@/services/hubspot/types";
import type { CallWithRelations } from "@/types/db";

// ============================================================================
// Contact/Deal association engine (Section 6 — matching priorities):
//   1. phone number
//   2. email
//   3. an existing Quo-to-HubSpot association already recorded on our contact row
//   4. manual association (see the "Associate contact/deal" UI on the call detail page)
//
// This only ever WRITES to our own contacts/deals tables (storing the matched
// hubspot_contact_id / hubspot_deal_id) — HubSpot itself is never written to,
// per Section 19's read-only requirement.
// ============================================================================

export interface MatchInput {
  phone?: string | null;
  email?: string | null;
}

export interface MatchResult {
  matchedBy: "phone" | "email" | "existing_association" | "none";
  hubspotContact: HubSpotContact | null;
  hubspotDeals: HubSpotDeal[];
}

export async function matchContactToHubSpot(input: MatchInput): Promise<MatchResult> {
  if (!isHubSpotConfigured()) {
    return { matchedBy: "none", hubspotContact: null, hubspotDeals: [] };
  }
  const hubspot = getHubSpotService();

  // Priority 1: phone number.
  if (input.phone) {
    const contact = await hubspot.searchContactByPhone(normalizePhone(input.phone));
    if (contact) {
      const deals = await hubspot.getDealsForContact(contact.id);
      return { matchedBy: "phone", hubspotContact: contact, hubspotDeals: deals };
    }
  }

  // Priority 2: email.
  if (input.email) {
    const contact = await hubspot.searchContactByEmail(input.email.trim().toLowerCase());
    if (contact) {
      const deals = await hubspot.getDealsForContact(contact.id);
      return { matchedBy: "email", hubspotContact: contact, hubspotDeals: deals };
    }
  }

  return { matchedBy: "none", hubspotContact: null, hubspotDeals: [] };
}

/**
 * Picks the deal to attach to a call for a resolved contact: prefer an open deal
 * (most recently created), falling back to the most recently created deal of any
 * status if none are open. Used so calls.deal_id gets populated on every path that
 * resolves a contact, not just the manual-association flow.
 */
export async function getPrimaryDealIdForContact(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  contactId: string
): Promise<string | null> {
  const { data: openDeal } = await admin
    .from("deals")
    .select("id")
    .eq("contact_id", contactId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openDeal) return openDeal.id;

  const { data: anyDeal } = await admin
    .from("deals")
    .select("id")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return anyDeal?.id ?? null;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/**
 * Finds or creates a local contact row for a call, applying the 4-tier priority.
 * Priority 3 ("existing Quo-to-HubSpot association") is implemented as: if we
 * already have a local contact row with this phone/email carrying a
 * hubspot_contact_id, reuse that association instead of re-searching HubSpot.
 * Only usable when Supabase is configured — in demo mode, association is manual only.
 */
export async function findOrCreateLocalContact(input: MatchInput): Promise<{
  contactId: string;
  hubspotContactId: string | null;
  dealId: string | null;
  matchedBy: MatchResult["matchedBy"] | "local_record";
} | null> {
  if (!isSupabaseConfigured()) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  // Priority 3 first: do we already know this phone/email locally, HubSpot id and all?
  // Only short-circuit when we actually have a hubspot_contact_id — a local row created
  // from a call where the HubSpot search found nothing (hubspot_contact_id: null) must
  // not be treated as a resolved match forever, otherwise the contact stays blank on
  // every future call from the same number/email even after HubSpot gets a matching
  // contact. Fall through to re-searching HubSpot in that case.
  let staleLocalContactId: string | null = null;
  if (input.phone) {
    const { data } = await admin.from("contacts").select("id, hubspot_contact_id").eq("phone", input.phone).maybeSingle();
    if (data?.hubspot_contact_id) {
      return { contactId: data.id, hubspotContactId: data.hubspot_contact_id, dealId: await getPrimaryDealIdForContact(admin, data.id), matchedBy: "local_record" };
    }
    if (data) staleLocalContactId = data.id;
  }
  if (input.email) {
    const { data } = await admin.from("contacts").select("id, hubspot_contact_id").eq("email", input.email).maybeSingle();
    if (data?.hubspot_contact_id) {
      return { contactId: data.id, hubspotContactId: data.hubspot_contact_id, dealId: await getPrimaryDealIdForContact(admin, data.id), matchedBy: "local_record" };
    }
    if (data) staleLocalContactId = staleLocalContactId ?? data.id;
  }

  // Priorities 1-2: search HubSpot.
  const match = await matchContactToHubSpot(input);

  // If we found a stale (HubSpot-less) local row and HubSpot now has a match, update
  // that row in place instead of inserting a duplicate contact for the same phone/email.
  if (staleLocalContactId && match.hubspotContact) {
    const { data: updatedContact, error: updateError } = await admin
      .from("contacts")
      .update({
        hubspot_contact_id: match.hubspotContact.id,
        firstname: match.hubspotContact.firstname,
        lastname: match.hubspotContact.lastname,
        email: match.hubspotContact.email ?? input.email ?? null,
        phone: match.hubspotContact.phone ?? input.phone ?? null,
      })
      .eq("id", staleLocalContactId)
      .select()
      .single();
    if (!updateError && updatedContact) {
      if (match.hubspotDeals.length) {
        for (const deal of match.hubspotDeals) {
          await admin.from("deals").upsert(
            {
              hubspot_deal_id: deal.id,
              contact_id: updatedContact.id,
              deal_name: deal.dealName,
              stage: deal.stage,
              pipeline: deal.pipeline,
              amount: deal.amount,
              status: deal.status,
              close_date: deal.closeDate,
            },
            { onConflict: "hubspot_deal_id" }
          );
        }
      }
      return {
        contactId: updatedContact.id,
        hubspotContactId: match.hubspotContact.id,
        dealId: await getPrimaryDealIdForContact(admin, updatedContact.id),
        matchedBy: match.matchedBy,
      };
    }
  }
  if (staleLocalContactId && !match.hubspotContact) {
    return { contactId: staleLocalContactId, hubspotContactId: null, dealId: null, matchedBy: "local_record" };
  }

  const { data: newContact, error } = await admin
    .from("contacts")
    .insert({
      hubspot_contact_id: match.hubspotContact?.id ?? null,
      firstname: match.hubspotContact?.firstname ?? null,
      lastname: match.hubspotContact?.lastname ?? null,
      email: match.hubspotContact?.email ?? input.email ?? null,
      phone: match.hubspotContact?.phone ?? input.phone ?? null,
    })
    .select()
    .single();
  if (error || !newContact) return null;

  if (match.hubspotDeals.length && admin) {
    for (const deal of match.hubspotDeals) {
      await admin.from("deals").upsert(
        {
          hubspot_deal_id: deal.id,
          contact_id: newContact.id,
          deal_name: deal.dealName,
          stage: deal.stage,
          pipeline: deal.pipeline,
          amount: deal.amount,
          status: deal.status,
          close_date: deal.closeDate,
        },
        { onConflict: "hubspot_deal_id" }
      );
    }
  }

  return {
    contactId: newContact.id,
    hubspotContactId: match.hubspotContact?.id ?? null,
    dealId: match.hubspotDeals.length ? await getPrimaryDealIdForContact(admin, newContact.id) : null,
    matchedBy: match.matchedBy,
  };
}

export interface ManualAssociateResult {
  matched: boolean;
  detail: string;
}

/**
 * Manual fallback association (Section 21): a user searches HubSpot by phone/email
 * directly from the call detail page and links the result to this call. Works in
 * both modes — writes to Postgres when Supabase is configured, otherwise updates the
 * in-memory demo call so the flow is demonstrable without a database.
 */
export async function manuallyAssociateCall(callId: string, input: MatchInput): Promise<ManualAssociateResult> {
  if (!isHubSpotConfigured()) {
    return { matched: false, detail: "HubSpot is not connected — add HUBSPOT_ACCESS_TOKEN in Settings > Integrations first." };
  }
  const match = await matchContactToHubSpot(input);
  if (!match.hubspotContact) {
    return { matched: false, detail: `No HubSpot contact found for ${input.phone ?? input.email ?? "the given details"}.` };
  }

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    if (!admin) return { matched: false, detail: "Supabase admin client not configured." };

    const { data: contact } = await admin
      .from("contacts")
      .upsert(
        {
          hubspot_contact_id: match.hubspotContact.id,
          firstname: match.hubspotContact.firstname,
          lastname: match.hubspotContact.lastname,
          email: match.hubspotContact.email,
          phone: match.hubspotContact.phone,
        },
        { onConflict: "hubspot_contact_id" }
      )
      .select()
      .single();
    if (!contact) return { matched: false, detail: "Failed to save the matched contact." };

    let dealId: string | null = null;
    for (const deal of match.hubspotDeals) {
      const { data: dealRow } = await admin
        .from("deals")
        .upsert(
          {
            hubspot_deal_id: deal.id,
            contact_id: contact.id,
            deal_name: deal.dealName,
            stage: deal.stage,
            pipeline: deal.pipeline,
            amount: deal.amount,
            status: deal.status,
            close_date: deal.closeDate,
          },
          { onConflict: "hubspot_deal_id" }
        )
        .select()
        .single();
      if (dealRow && !dealId) dealId = dealRow.id;
    }

    await admin.from("calls").update({ contact_id: contact.id, deal_id: dealId }).eq("id", callId);
    return {
      matched: true,
      detail: `Linked to ${match.hubspotContact.firstname ?? ""} ${match.hubspotContact.lastname ?? ""} (matched by ${match.matchedBy})${match.hubspotDeals.length ? ` with ${match.hubspotDeals.length} deal(s).` : "."}`,
    };
  }

  const existing = getManualCallById(callId);
  if (!existing) return { matched: false, detail: "Call not found." };

  const demoContact: CallWithRelations["contact"] = {
    id: existing.contact?.id ?? `manual-contact-${callId}`,
    hubspot_contact_id: match.hubspotContact.id,
    firstname: match.hubspotContact.firstname,
    lastname: match.hubspotContact.lastname,
    email: match.hubspotContact.email,
    phone: match.hubspotContact.phone,
    created_at: existing.contact?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const firstDeal = match.hubspotDeals[0];
  const demoDeal: CallWithRelations["deal"] = firstDeal
    ? {
        id: existing.deal?.id ?? `manual-deal-${callId}`,
        hubspot_deal_id: firstDeal.id,
        contact_id: demoContact.id,
        deal_name: firstDeal.dealName,
        stage: firstDeal.stage,
        pipeline: firstDeal.pipeline,
        amount: firstDeal.amount,
        status: firstDeal.status,
        owner_id: existing.deal?.owner_id ?? null,
        close_date: firstDeal.closeDate,
        created_at: existing.deal?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    : existing.deal;

  updateManualCall(callId, (c) => ({ ...c, contact_id: demoContact.id, deal_id: demoDeal?.id ?? c.deal_id, contact: demoContact, deal: demoDeal }));
  return {
    matched: true,
    detail: `Linked to ${match.hubspotContact.firstname ?? ""} ${match.hubspotContact.lastname ?? ""} (matched by ${match.matchedBy})${match.hubspotDeals.length ? ` with ${match.hubspotDeals.length} deal(s).` : "."}`,
  };
}

/**
 * One-time refresh for deal rows stored before getDealsForContact learned to resolve
 * dealstage/pipeline (enumeration properties) to their human labels instead of
 * HubSpot's raw internal option id — confirmed in production: a deal showed Stage
 * "951755830" instead of "Deposit Recieved". Re-fetches every deal we have a
 * hubspot_deal_id for and overwrites stage/pipeline/status with the freshly resolved
 * values. Time-boxed like the call backfill; safe to call repeatedly.
 */
export async function refreshStoredDealLabels(timeBudgetMs = 60_000): Promise<{ updated: number; errors: string[] }> {
  if (!isSupabaseConfigured() || !isHubSpotConfigured()) return { updated: 0, errors: [] };
  const admin = getSupabaseAdminClient();
  if (!admin) return { updated: 0, errors: [] };
  const hubspot = getHubSpotService();

  const { data: deals } = await admin.from("deals").select("id, hubspot_deal_id").not("hubspot_deal_id", "is", null);

  const errors: string[] = [];
  let updated = 0;
  const startedAt = Date.now();
  for (const deal of deals ?? []) {
    if (Date.now() - startedAt > timeBudgetMs) break;
    try {
      const fresh = await hubspot.getDealById(deal.hubspot_deal_id as string);
      if (!fresh) continue;
      await admin
        .from("deals")
        .update({
          deal_name: fresh.dealName,
          stage: fresh.stage,
          pipeline: fresh.pipeline,
          amount: fresh.amount,
          status: fresh.status,
          close_date: fresh.closeDate,
        })
        .eq("id", deal.id);
      updated++;
    } catch (err) {
      errors.push(`${deal.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { updated, errors };
}
