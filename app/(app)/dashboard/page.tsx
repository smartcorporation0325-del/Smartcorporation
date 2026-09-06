import StatCard from "@/components/StatCard";
import MonthSwitcher from "@/components/MonthSwitcher";
import RevenueByClientChart from "@/components/charts/RevenueByClientChart";
import HourlyVsFixedChart from "@/components/charts/HourlyVsFixedChart";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import {
  currentMonthKey,
  getClients,
  getMonthlyFinancials,
  getMonthlyTrend,
  getRevenueByClient,
  getSettings,
} from "@/lib/data";
import { formatCurrency } from "@/lib/finance";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month ?? currentMonthKey();

  const [financials, clients, revenueByClient, trend, settings] = await Promise.all([
    getMonthlyFinancials(month),
    getClients(),
    getRevenueByClient(month),
    getMonthlyTrend(6),
    getSettings(),
  ]);

  const activeClients = clients.filter((c) => c.status === "active");
  const hourlyClients = activeClients.filter((c) => c.billing_model === "hourly");
  const fixedClients = activeClients.filter((c) => c.billing_model === "fixed_monthly");
  const prospects = clients.filter((c) => c.status === "prospect");

  const currency = settings.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
          <p className="text-sm text-ink/50">Overview of {settings.company_name}&apos;s finances</p>
        </div>
        <MonthSwitcher month={month} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Total Revenue This Month"
          value={formatCurrency(financials.totalRevenue, currency)}
          tone="accent"
        />
        <StatCard label="Hourly Revenue" value={formatCurrency(financials.hourlyRevenue, currency)} />
        <StatCard label="Fixed Revenue" value={formatCurrency(financials.fixedRevenue, currency)} />
        <StatCard
          label="Outstanding Payments"
          value={formatCurrency(financials.outstandingPayments, currency)}
          tone={financials.outstandingPayments > 0 ? "danger" : "default"}
        />
        <StatCard label="Total Team Costs" value={formatCurrency(financials.teamCosts, currency)} />
        <StatCard
          label="Net Profit"
          value={formatCurrency(financials.profitAvailable, currency)}
          tone="accent"
        />
        {financials.distributions.map((d) => (
          <StatCard
            key={d.teamMemberId}
            label={`${d.name} Profit Share`}
            value={formatCurrency(d.amount, currency)}
          />
        ))}
        <StatCard label="Active Clients" value={String(activeClients.length)} />
        <StatCard label="Hourly Clients" value={String(hourlyClients.length)} />
        <StatCard label="Fixed Clients" value={String(fixedClients.length)} />
        <StatCard label="Prospects" value={String(prospects.length)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-ink">Revenue by Client</h2>
          <RevenueByClientChart data={revenueByClient} />
        </div>
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-ink">Hourly vs Fixed Revenue</h2>
          <HourlyVsFixedChart hourly={financials.hourlyRevenue} fixed={financials.fixedRevenue} />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-ink">Monthly Revenue Trend</h2>
        <MonthlyTrendChart data={trend} />
      </div>
    </div>
  );
}
