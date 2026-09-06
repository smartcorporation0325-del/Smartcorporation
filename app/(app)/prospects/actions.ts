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

export async function createProspectAction(formData: FormData) {
  const supabase = createClient();

  await supabase.from("prospects").insert({
    company: str(formData, "company") ?? "Unnamed Prospect",
    contact: str(formData, "contact"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    service_interested: str(formData, "service_interested"),
    estimated_value: num(formData, "estimated_value"),
    billing_model: str(formData, "billing_model"),
    status: str(formData, "status") ?? "new_lead",
    next_follow_up: str(formData, "next_follow_up"),
    notes: str(formData, "notes"),
  });

  revalidatePath("/prospects");
  redirect("/prospects");
}

export async function updateProspectStatusAction(id: string, formData: FormData) {
  const supabase = createClient();
  const status = String(formData.get("status"));

  await supabase.from("prospects").update({ status }).eq("id", id);
  revalidatePath("/prospects");
}

export async function deleteProspectAction(id: string) {
  const supabase = createClient();
  await supabase.from("prospects").delete().eq("id", id);
  revalidatePath("/prospects");
}

/**
 * Converts a Won prospect into a real Client record, carrying over the
 * contact info and billing model, then marks the prospect as linked so
 * it isn't converted twice.
 */
export async function convertProspectToClientAction(id: string) {
  const supabase = createClient();

  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle();
  if (!prospect) return;

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      client_name: prospect.contact ?? prospect.company,
      company_name: prospect.company,
      status: "active",
      billing_model: prospect.billing_model ?? "other",
      main_contact: prospect.contact,
      email: prospect.email,
      phone: prospect.phone,
      service_scope: prospect.service_interested,
      notes: prospect.notes,
      source: "Converted Prospect",
      payment_status: "pending",
      project_fee: prospect.billing_model === "project" ? prospect.estimated_value : 0,
      monthly_fixed_fee: prospect.billing_model === "fixed_monthly" ? prospect.estimated_value : 0,
    })
    .select()
    .single();

  if (error || !client) {
    throw new Error(error?.message ?? "Could not convert prospect");
  }

  await supabase
    .from("prospects")
    .update({ status: "won", converted_client_id: client.id })
    .eq("id", id);

  revalidatePath("/prospects");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
}
