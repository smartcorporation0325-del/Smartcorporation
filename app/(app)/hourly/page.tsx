import StatCard from "@/components/StatCard";
import MonthSwitcher from "@/components/MonthSwitcher";
import HourlyEntryRow from "@/components/HourlyEntryRow";
import { currentMonthKey, getClients, getSettings, getTimeEntries, shiftMonth } from "@/lib/data";
import { formatCurrency } from "@/lib/finance";
import { upsertTimeEntryAction } from "./actions";

export default async function HourlyClientsPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month ?? currentMonthKey();
  const prevMonth = shiftMonth(month, -1);

  const [clients, settings, entries, prevEntries] = await Promise.all([
    getClients(),
    getSettings(),
    getTimeEntries(month),
    getTimeEntries(prevMonth),
  ]);

  const hourlyClients = clients.filter((c) => c.billing_model === "hourly");
  const entryByClient = new Map(entries.map((e) => [e.client_id, e]));

  const hoursThisMonth = entries.reduce((s, e) => s + Number(e.hours_worked), 0);
  const revenueThisMonth = entries.reduce((s, e) => s + Number(e.total_revenue), 0);
  const hoursPrevMonth = prevEntries.reduce((s, e) => s + Number(e.hours_worked), 0);
  const revenuePrevMonth = prevEntries.reduce((s, e) => s + Number(e.total_revenue), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink">Hourly Clients</h1>
        <MonthSwitcher month={month} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Hours This Month" value={hoursThisMonth.toFixed(2)} />
        <StatCard label="Revenue This Month" value={formatCurrency(revenueThisMonth, settings.currency)} tone="accent" />
        <StatCard label="Previous Month Hours" value={hoursPrevMonth.toFixed(2)} />
        <StatCard label="Previous Month Revenue" value={formatCurrency(revenuePrevMonth, settings.currency)} />
      </div>

      {hourlyClients.length === 0 ? (
        <div className="card text-center text-sm text-ink/50">
          No hourly clients yet.{" "}
          <a href="/clients/new" className="text-accent underline">
            Add one
          </a>
          .
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Client</th>
                <th>Hours Worked &amp; Hourly Rate</th>
                <th>Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {hourlyClients.map((c) => {
                const entry = entryByClient.get(c.id);
                return (
                  <HourlyEntryRow
                    key={c.id}
                    clientId={c.id}
                    clientName={c.company_name || c.client_name}
                    month={month}
                    currency={settings.currency}
                    initialHours={Number(entry?.hours_worked ?? 0)}
                    initialRate={Number(entry?.hourly_rate ?? c.hourly_rate ?? 0)}
                    action={upsertTimeEntryAction}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
