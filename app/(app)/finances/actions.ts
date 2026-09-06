"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyFinancials } from "@/lib/data";

/**
 * Freezes this month's profit distribution as a permanent record, so that
 * a later change to the profit-share percentages in Settings never
 * retroactively rewrites what Marianny/Natalia actually received in a
 * past month.
 */
export async function saveMonthlyDistributionAction(formData: FormData) {
  const month = String(formData.get("month"));
  const supabase = createClient();

  const financials = await getMonthlyFinancials(month);

  const { data: distribution, error } = await supabase
    .from("profit_distributions")
    .upsert(
      {
        month,
        total_revenue: financials.totalRevenue,
        team_costs: financials.teamCosts,
        other_expenses: financials.otherExpenses,
        profit_available: financials.profitAvailable,
      },
      { onConflict: "month" }
    )
    .select()
    .single();

  if (error || !distribution) {
    throw new Error(error?.message ?? "Could not save distribution");
  }

  await supabase.from("profit_distribution_shares").delete().eq("profit_distribution_id", distribution.id);

  if (financials.distributions.length > 0) {
    await supabase.from("profit_distribution_shares").insert(
      financials.distributions.map((d) => ({
        profit_distribution_id: distribution.id,
        team_member_id: d.teamMemberId,
        share_percent: d.sharePercent,
        amount: d.amount,
      }))
    );
  }

  revalidatePath("/finances");
  revalidatePath("/history");
}
