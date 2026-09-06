import { createClient } from "@/lib/supabase/server";
import { computeMonthlyFinancials, toMonthKey } from "@/lib/finance";
import type {
  Client,
  Expense,
  FixedBilling,
  Prospect,
  Settings,
  TeamMember,
  TeamPayment,
  TimeEntry,
} from "@/lib/types";

export function currentMonthKey(): string {
  return toMonthKey(new Date());
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return toMonthKey(d);
}

export async function getSettings(): Promise<Settings> {
  const supabase = createClient();
  const { data } = await supabase.from("settings").select("*").limit(1).maybeSingle();
  return (
    data ?? {
      id: "default",
      company_name: "Smart Corporation",
      currency: "USD",
      updated_at: new Date().toISOString(),
    }
  );
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = createClient();
  const { data } = await supabase.from("team_members").select("*").order("name");
  return (data as TeamMember[]) ?? [];
}

export async function getTeamPayments(month: string): Promise<TeamPayment[]> {
  const supabase = createClient();
  const { data } = await supabase.from("team_payments").select("*").eq("month", month);
  return (data as TeamPayment[]) ?? [];
}

export async function getClients(): Promise<Client[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Client[]) ?? [];
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  return (data as Client) ?? null;
}

export interface TimeEntryWithClient extends TimeEntry {
  client: Pick<Client, "id" | "client_name" | "company_name">;
}

export async function getTimeEntries(month: string): Promise<TimeEntryWithClient[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("time_entries")
    .select("*, client:clients(id, client_name, company_name)")
    .eq("month", month);
  return (data as unknown as TimeEntryWithClient[]) ?? [];
}

export interface FixedBillingWithClient extends FixedBilling {
  client: Pick<Client, "id" | "client_name" | "company_name">;
}

export async function getFixedBilling(month: string): Promise<FixedBillingWithClient[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fixed_billing")
    .select("*, client:clients(id, client_name, company_name)")
    .eq("month", month);
  return (data as unknown as FixedBillingWithClient[]) ?? [];
}

export async function getExpenses(month?: string): Promise<Expense[]> {
  const supabase = createClient();
  let query = supabase.from("expenses").select("*").order("date", { ascending: false });
  if (month) query = query.eq("month", month);
  const { data } = await query;
  return (data as Expense[]) ?? [];
}

export async function getProspects(): Promise<Prospect[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Prospect[]) ?? [];
}

/**
 * Full financial picture for a given month: revenue, team costs, other
 * expenses, and the profit-share split. This is the single source of
 * truth used by the Dashboard, Finances, and History screens so the
 * numbers never diverge between screens.
 */
export async function getMonthlyFinancials(month: string) {
  const [timeEntries, fixedBilling, teamPayments, expenses, teamMembers] = await Promise.all([
    getTimeEntries(month),
    getFixedBilling(month),
    getTeamPayments(month),
    getExpenses(month),
    getTeamMembers(),
  ]);

  const hourlyRevenue = timeEntries.reduce((sum, e) => sum + Number(e.total_revenue), 0);
  const fixedRevenue = fixedBilling.reduce((sum, e) => sum + Number(e.monthly_fee), 0);
  const totalRevenue = hourlyRevenue + fixedRevenue;

  const teamCosts = teamPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const otherExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const outstandingPayments = fixedBilling.reduce(
    (sum, e) => sum + Math.max(0, Number(e.monthly_fee) - Number(e.amount_paid)),
    0
  );

  const profitShareMembers = teamMembers
    .filter((m) => m.payment_type === "profit_share" && m.active)
    .map((m) => ({ teamMemberId: m.id, name: m.name, sharePercent: Number(m.profit_share_percent) }));

  const result = computeMonthlyFinancials({
    totalRevenue,
    teamCosts,
    otherExpenses,
    profitShareMembers,
  });

  return {
    ...result,
    hourlyRevenue,
    fixedRevenue,
    outstandingPayments,
    timeEntries,
    fixedBilling,
    teamPayments,
    expenses,
  };
}

export async function getRevenueByClient(month: string) {
  const [timeEntries, fixedBilling] = await Promise.all([
    getTimeEntries(month),
    getFixedBilling(month),
  ]);

  const map = new Map<string, { name: string; revenue: number }>();

  for (const e of timeEntries) {
    const name = e.client?.company_name || e.client?.client_name || "Unknown";
    const existing = map.get(e.client_id);
    map.set(e.client_id, { name, revenue: (existing?.revenue ?? 0) + Number(e.total_revenue) });
  }
  for (const e of fixedBilling) {
    const name = e.client?.company_name || e.client?.client_name || "Unknown";
    const existing = map.get(e.client_id);
    map.set(e.client_id, { name, revenue: (existing?.revenue ?? 0) + Number(e.monthly_fee) });
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export async function getMonthlyTrend(monthsBack = 6) {
  const months: string[] = [];
  let cursor = currentMonthKey();
  for (let i = 0; i < monthsBack; i++) {
    months.unshift(cursor);
    cursor = shiftMonth(cursor, -1);
  }

  const results = await Promise.all(
    months.map(async (month) => {
      const financials = await getMonthlyFinancials(month);
      return { month, ...financials };
    })
  );

  return results;
}

export interface SavedDistribution {
  month: string;
  total_revenue: number;
  team_costs: number;
  other_expenses: number;
  profit_available: number;
  shares: { team_member_id: string; name: string; share_percent: number; amount: number }[];
}

export async function getSavedDistribution(month: string): Promise<SavedDistribution | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profit_distributions")
    .select("*, profit_distribution_shares(*, team_members(name))")
    .eq("month", month)
    .maybeSingle();

  if (!data) return null;

  return {
    month: data.month,
    total_revenue: Number(data.total_revenue),
    team_costs: Number(data.team_costs),
    other_expenses: Number(data.other_expenses),
    profit_available: Number(data.profit_available),
    shares: (data.profit_distribution_shares as any[]).map((s) => ({
      team_member_id: s.team_member_id,
      name: s.team_members?.name ?? "Unknown",
      share_percent: Number(s.share_percent),
      amount: Number(s.amount),
    })),
  };
}

export interface MonthlyHistoryRow {
  month: string;
  revenue: number;
  expenses: number;
  teamPayments: number;
  profit: number;
  shares: { name: string; amount: number }[];
  locked: boolean;
}

export async function getHistory(monthsBack = 12): Promise<MonthlyHistoryRow[]> {
  const months: string[] = [];
  let cursor = currentMonthKey();
  for (let i = 0; i < monthsBack; i++) {
    months.unshift(cursor);
    cursor = shiftMonth(cursor, -1);
  }

  return Promise.all(
    months.map(async (month) => {
      const saved = await getSavedDistribution(month);
      if (saved) {
        return {
          month,
          revenue: saved.total_revenue,
          expenses: saved.other_expenses,
          teamPayments: saved.team_costs,
          profit: saved.profit_available,
          shares: saved.shares.map((s) => ({ name: s.name, amount: s.amount })),
          locked: true,
        };
      }

      const live = await getMonthlyFinancials(month);
      return {
        month,
        revenue: live.totalRevenue,
        expenses: live.otherExpenses,
        teamPayments: live.teamCosts,
        profit: live.profitAvailable,
        shares: live.distributions.map((d) => ({ name: d.name, amount: d.amount })),
        locked: false,
      };
    })
  );
}
