"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface AddSalesRepResult {
  status: "success" | "failed";
  message: string;
}

/**
 * Adds (or completes) a sales rep. Upserts by name (case-insensitive) rather than a
 * blind insert: Federico already exists as a row from earlier manual-call defaults
 * (see lib/pipeline/analyze.ts), created without a quo_user_id/hubspot_owner_id, so
 * re-adding him here should fill those in rather than create a duplicate "Federico".
 */
export async function addSalesRepAction(formData: FormData): Promise<AddSalesRepResult> {
  if (!isSupabaseConfigured()) {
    return { status: "failed", message: "Supabase is not configured — sales reps can't be persisted in demo mode." };
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return { status: "failed", message: "Supabase admin client not configured." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const quoUserId = String(formData.get("quoUserId") ?? "").trim() || null;
  const hubspotOwnerId = String(formData.get("hubspotOwnerId") ?? "").trim() || null;
  if (!name) return { status: "failed", message: "Name is required." };

  const { data: existing } = await admin.from("sales_reps").select("id").ilike("name", name).maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("sales_reps")
      .update({ email, quo_user_id: quoUserId, hubspot_owner_id: hubspotOwnerId, active: true })
      .eq("id", existing.id);
    if (error) return { status: "failed", message: error.message };
    revalidatePath("/settings/reps");
    return { status: "success", message: `Updated existing rep "${name}" with the new Quo/HubSpot IDs.` };
  }

  const { error } = await admin
    .from("sales_reps")
    .insert({ name, email, quo_user_id: quoUserId, hubspot_owner_id: hubspotOwnerId, active: true });
  if (error) return { status: "failed", message: error.message };
  revalidatePath("/settings/reps");
  return { status: "success", message: `Added "${name}" as a sales rep.` };
}
