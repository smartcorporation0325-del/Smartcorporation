"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toMonthKey } from "@/lib/finance";

export async function createExpenseAction(formData: FormData) {
  const supabase = createClient();

  const date = String(formData.get("date"));
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "Other");
  const amount = parseFloat(String(formData.get("amount") ?? "0")) || 0;
  const recurring = formData.get("recurring") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await supabase.from("expenses").insert({
    date,
    month: toMonthKey(date),
    description,
    category,
    amount,
    recurring,
    notes,
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
  redirect("/expenses");
}

export async function deleteExpenseAction(id: string) {
  const supabase = createClient();
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
}
