// Pure, framework-free financial calculations for Smart Corporation.
//
// Rule (do not change without re-reading the business requirement):
// Profit is split between profit-share partners ONLY AFTER team fixed/
// one-time payments and other business expenses are deducted. Never split
// gross revenue.

export interface ProfitShareMember {
  teamMemberId: string;
  name: string;
  sharePercent: number; // e.g. 50 for 50%
}

export interface MonthlyFinancialsInput {
  /** Sum of all client revenue recognized for the month (hourly + fixed). */
  totalRevenue: number;
  /** Sum of team_payments.amount for the month (fixed + one-time + hourly staff pay). */
  teamCosts: number;
  /** Sum of expenses.amount for the month, excluding team payments already counted above. */
  otherExpenses: number;
  /** Active partners who split whatever profit remains. */
  profitShareMembers: ProfitShareMember[];
}

export interface ProfitShareResult extends ProfitShareMember {
  amount: number;
}

export interface MonthlyFinancialsResult {
  totalRevenue: number;
  teamCosts: number;
  otherExpenses: number;
  /** totalRevenue - teamCosts - otherExpenses. Can be negative in a loss month. */
  profitAvailable: number;
  distributions: ProfitShareResult[];
  /** Sum of all sharePercent values; should be 100 in the normal case. */
  totalSharePercent: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeMonthlyFinancials(
  input: MonthlyFinancialsInput
): MonthlyFinancialsResult {
  const totalRevenue = round2(input.totalRevenue);
  const teamCosts = round2(input.teamCosts);
  const otherExpenses = round2(input.otherExpenses);
  const profitAvailable = round2(totalRevenue - teamCosts - otherExpenses);

  const totalSharePercent = round2(
    input.profitShareMembers.reduce((sum, m) => sum + m.sharePercent, 0)
  );

  const distributions: ProfitShareResult[] = input.profitShareMembers.map((m) => ({
    ...m,
    amount: round2(profitAvailable * (m.sharePercent / 100)),
  }));

  return {
    totalRevenue,
    teamCosts,
    otherExpenses,
    profitAvailable,
    distributions,
    totalSharePercent,
  };
}

export function calculateHourlyRevenue(hoursWorked: number, hourlyRate: number): number {
  return round2(hoursWorked * hourlyRate);
}

export function calculateOutstandingFixedBalance(
  monthlyFee: number,
  amountPaid: number
): number {
  return round2(Math.max(0, monthlyFee - amountPaid));
}

/** Normalizes any date/string to the first day of its month, as 'yyyy-MM-01'. */
export function toMonthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMonthLabel(monthKey: string): string {
  const d = new Date(`${monthKey}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
