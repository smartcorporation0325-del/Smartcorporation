import MonthSwitcher from "@/components/MonthSwitcher";
import { currentMonthKey, getMonthlyFinancials, getSettings } from "@/lib/data";
import { formatCurrency } from "@/lib/finance";
import { saveMonthlyDistributionAction } from "./actions";

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month ?? currentMonthKey();
  const [financials, settings] = await Promise.all([getMonthlyFinancials(month), getSettings()]);
  const currency = settings.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Financial Overview</h1>
          <p className="text-sm text-ink/50">
            Profit is only split between partners after team payments and expenses are deducted.
          </p>
        </div>
        <MonthSwitcher month={month} />
      </div>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/50">Waterfall</h2>
        <div className="space-y-3">
          <Row label="Total Client Revenue" value={financials.totalRevenue} currency={currency} bold />
          <Row label="− Team Fixed / Payments" value={-financials.teamCosts} currency={currency} />
          <Row label="− Other Business Expenses" value={-financials.otherExpenses} currency={currency} />
          <hr className="border-cloud" />
          <Row
            label="Profit Available for Distribution"
            value={financials.profitAvailable}
            currency={currency}
            bold
            tone="accent"
          />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/50">
          Profit Distribution
        </h2>
        {financials.distributions.length === 0 ? (
          <p className="text-sm text-ink/50">
            No profit-share partners configured. Add one in Team with payment type &quot;Profit Share&quot;.
          </p>
        ) : (
          <div className="space-y-3">
            {financials.distributions.map((d) => (
              <Row
                key={d.teamMemberId}
                label={`${d.name} (${d.sharePercent}%)`}
                value={d.amount}
                currency={currency}
              />
            ))}
            {financials.totalSharePercent !== 100 && (
              <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
                Profit-share percentages add up to {financials.totalSharePercent}%, not 100%. Check
                Settings / Team.
              </p>
            )}
          </div>
        )}
      </div>

      <form action={saveMonthlyDistributionAction} className="flex items-center gap-3">
        <input type="hidden" name="month" value={month} />
        <button type="submit" className="btn-primary">
          Lock in this month&apos;s distribution
        </button>
        <p className="text-xs text-ink/40">
          Saves a permanent snapshot for History, so future Settings changes never rewrite this month.
        </p>
      </form>
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  bold,
  tone,
}: {
  label: string;
  value: number;
  currency: string;
  bold?: boolean;
  tone?: "accent";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-ink" : "text-ink/70"}>{label}</span>
      <span
        className={`${bold ? "text-lg font-semibold" : "text-sm"} ${
          tone === "accent" ? "text-accent" : value < 0 ? "text-danger" : "text-ink"
        }`}
      >
        {formatCurrency(value, currency)}
      </span>
    </div>
  );
}
