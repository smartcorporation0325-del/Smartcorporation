"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertTimeEntryAction(formData: FormData) {
  const supabase = createClient();

  const client_id = String(formData.get("client_id"));
  const month = String(formData.get("month"));
  const hours_worked = parseFloat(String(formData.get("hours_worked") ?? "0")) || 0;
  const hourly_rate = parseFloat(String(formData.get("hourly_rate") ?? "0")) || 0;

  await supabase
    .from("time_entries")
    .upsert(
      { client_id, month, hours_worked, hourly_rate },
      { onConflict: "client_id,month" }
    );

  revalidatePath("/hourly");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
}
