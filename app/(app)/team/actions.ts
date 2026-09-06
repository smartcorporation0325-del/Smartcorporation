"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(formData: FormData, key: string): number {
  const v = formData.get(key);
  const n = typeof v === "string" ? parseFloat(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function memberPayload(formData: FormData) {
  return {
    name: str(formData, "name") ?? "Unnamed",
    role: str(formData, "role"),
    payment_type: str(formData, "payment_type") ?? "fixed_monthly",
    monthly_fixed_payment: num(formData, "monthly_fixed_payment"),
    hourly_rate: num(formData, "hourly_rate"),
    profit_share_percent: num(formData, "profit_share_percent"),
    active: formData.get("active") === "on",
  };
}

export async function createTeamMemberAction(formData: FormData) {
  const supabase = createClient();
  await supabase.from("team_members").insert(memberPayload(formData));
  revalidatePath("/team");
  revalidatePath("/dashboard");
  redirect("/team");
}

export async function updateTeamMemberAction(id: string, formData: FormData) {
  const supabase = createClient();
  await supabase.from("team_members").update(memberPayload(formData)).eq("id", id);
  revalidatePath("/team");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
  redirect("/team");
}

export async function deleteTeamMemberAction(id: string) {
  const supabase = createClient();
  await supabase.from("team_members").delete().eq("id", id);
  revalidatePath("/team");
}

export async function upsertTeamPaymentAction(formData: FormData) {
  const supabase = createClient();
  const team_member_id = String(formData.get("team_member_id"));
  const month = String(formData.get("month"));
  const amount = parseFloat(String(formData.get("amount") ?? "0")) || 0;
  const note = str(formData, "note");

  await supabase
    .from("team_payments")
    .upsert({ team_member_id, month, amount, note }, { onConflict: "team_member_id,month" });

  revalidatePath("/team");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
}
