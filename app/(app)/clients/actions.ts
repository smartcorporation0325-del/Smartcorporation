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

function clientPayload(formData: FormData) {
  return {
    client_name: str(formData, "client_name") ?? "Unnamed Client",
    company_name: str(formData, "company_name"),
    status: str(formData, "status") ?? "prospect",
    billing_model: str(formData, "billing_model") ?? "hourly",
    hourly_rate: num(formData, "hourly_rate"),
    monthly_fixed_fee: num(formData, "monthly_fixed_fee"),
    project_fee: num(formData, "project_fee"),
    start_date: str(formData, "start_date"),
    end_date: str(formData, "end_date"),
    main_contact: str(formData, "main_contact"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    service_scope: str(formData, "service_scope"),
    assigned_team_member_id: str(formData, "assigned_team_member_id"),
    notes: str(formData, "notes"),
    source: str(formData, "source"),
    payment_status: str(formData, "payment_status") ?? "pending",
  };
}

export async function createClientAction(formData: FormData) {
  const supabase = createClient();
  const payload = clientPayload(formData);
  await supabase.from("clients").insert(payload);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect("/clients");
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = createClient();
  const payload = clientPayload(formData);
  await supabase.from("clients").update(payload).eq("id", id);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect("/clients");
}

export async function deleteClientAction(id: string) {
  const supabase = createClient();
  await supabase.from("clients").delete().eq("id", id);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
}
