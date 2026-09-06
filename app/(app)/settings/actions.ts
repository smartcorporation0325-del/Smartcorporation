"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateSettingsAction(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const company_name = String(formData.get("company_name") ?? "Smart Corporation").trim();
  const currency = String(formData.get("currency") ?? "USD").trim();

  const { data: existing } = await supabase.from("settings").select("id").maybeSingle();

  if (existing) {
    await supabase.from("settings").update({ company_name, currency, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("settings").insert({ company_name, currency });
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updateTeamMemberQuickValueAction(id: string, formData: FormData) {
  const supabase = createClient();
  const field = String(formData.get("field"));
  const value = parseFloat(String(formData.get("value") ?? "0")) || 0;

  if (field !== "monthly_fixed_payment" && field !== "profit_share_percent") {
    throw new Error("Invalid field");
  }

  await supabase.from("team_members").update({ [field]: value }).eq("id", id);

  revalidatePath("/settings");
  revalidatePath("/team");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
}
