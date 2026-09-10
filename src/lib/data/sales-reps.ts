import type { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Resolves a Quo call's userId to our sales_reps.id. Falls back to the single active
 * rep when there's no direct quo_user_id match — this MVP is scoped to one rep
 * (Federico; see Settings > Sales Reps) and sales_reps.quo_user_id was never
 * populated, so every Quo-synced call's sales_rep_id came back null. The UI then
 * papered over that by literally hardcoding the display name to "Federico"
 * regardless of the real value (confirmed in production: Coaching, which correctly
 * requires a real sales_rep_id, showed nothing at all while Calls looked fine).
 * With multiple active reps and no quo_user_id match, we can't guess which one — stays
 * null rather than silently misattributing the call.
 */
export async function resolveRepIdForQuoUser(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  quoUserId: string | null
): Promise<string | null> {
  if (quoUserId) {
    const { data } = await admin.from("sales_reps").select("id").eq("quo_user_id", quoUserId).maybeSingle();
    if (data?.id) return data.id;
  }
  const { data: activeReps } = await admin.from("sales_reps").select("id").eq("active", true);
  return activeReps?.length === 1 ? activeReps[0].id : null;
}
