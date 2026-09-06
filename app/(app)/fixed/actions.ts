"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertFixedBillingAction(formData: FormData) {
  const supabase = createClient();

  const client_id = String(formData.get("client_id"));
  const month = String(formData.get("month"));
  const monthly_fee = parseFloat(String(formData.get("monthly_fee") ?? "0")) || 0;
  const payment_status = String(formData.get("payment_status") ?? "pending");
  const due_date = String(formData.get("due_date") ?? "") || null;
  const amount_paid = parseFloat(String(formData.get("amount_paid") ?? "0")) || 0;

  await supabase.from("fixed_billing").upsert(
    { client_id, month, monthly_fee, payment_status, due_date, amount_paid },
    { onConflict: "client_id,month" }
  );

  revalidatePath("/fixed");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
}
