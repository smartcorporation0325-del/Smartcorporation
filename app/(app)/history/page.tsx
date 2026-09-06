import { getHistory, getSettings } from "@/lib/data";
import { formatCurrency, formatMonthLabel } from "@/lib/finance";

export default async function HistoryPage() {
  const [history, settings] = await Promise.all([getHistory(12), getSettings()]);
  const reversed = [...history].reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Monthly History</h1>
        <p className="text-sm text-ink/50">
          Locked months keep the profit split exactly as it was calculated, even if Settings % change later.
        </p>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Month</th>
              <th>Revenue</th>
              <th>Expenses</th>
              <th>Team Payments</th>
              <th>Profit</th>
              <th>Distribution</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reversed.map((row) => (
              <tr key={row.month}>
                <td className="font-medium text-ink">{formatMonthLabel(row.month)}</td>
                <td className="text-ink/70">{formatCurrency(row.revenue, settings.currency)}</td>
                <td className="text-ink/70">{formatCurrency(row.expenses, settings.currency)}</td>
                <td className="text-ink/70">{formatCurrency(row.teamPayments, settings.currency)}</td>
                <td className="font-semibold text-ink">{formatCurrency(row.profit, settings.currency)}</td>
                <td className="text-ink/70">
                  {row.shares.length === 0
                    ? "—"
                    : row.shares.map((s) => `${s.name}: ${formatCurrency(s.amount, settings.currency)}`).join(" · ")}
                </td>
                <td>
                  <span
                    className={`badge ${
                      row.locked ? "bg-accent/10 text-accent" : "bg-ink/10 text-ink/50"
                    }`}
                  >
                    {row.locked ? "Locked" : "Preview"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink/40">
        &quot;Preview&quot; months are calculated live from current data and Settings. Go to Finances and
        click &quot;Lock in this month&apos;s distribution&quot; to save it permanently.
      </p>
    </div>
  );
}
