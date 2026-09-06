import StatCard from "@/components/StatCard";
import MonthSwitcher from "@/components/MonthSwitcher";
import FixedBillingRow from "@/components/FixedBillingRow";
import { currentMonthKey, getClients, getFixedBilling, getSettings } from "@/lib/data";
import { formatCurrency } from "@/lib/finance";
import { upsertFixedBillingAction } from "./actions";

export default async function FixedClientsPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month ?? currentMonthKey();

  const [clients, settings, billing] = await Promise.all([
    getClients(),
    getSettings(),
    getFixedBilling(month),
  ]);

  const fixedClients = clients.filter((c) => c.billing_model === "fixed_monthly");
  const billingByClient = new Map(billing.map((b) => [b.client_id, b]));

  const totalBilled = billing.reduce((s, b) => s + Number(b.monthly_fee), 0);
  const totalPaid = billing.reduce((s, b) => s + Number(b.amount_paid), 0);
  const totalOutstanding = billing.reduce(
    (s, b) => s + Math.max(0, Number(b.monthly_fee) - Number(b.amount_paid)),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink">Fixed Clients</h1>
        <MonthSwitcher month={month} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Total Billed" value={formatCurrency(totalBilled, settings.currency)} tone="accent" />
        <StatCard label="Total Paid" value={formatCurrency(totalPaid, settings.currency)} />
        <StatCard
          label="Outstanding"
          value={formatCurrency(totalOutstanding, settings.currency)}
          tone={totalOutstanding > 0 ? "danger" : "default"}
        />
      </div>

      {fixedClients.length === 0 ? (
        <div className="card text-center text-sm text-ink/50">
          No fixed-fee clients yet.{" "}
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
                <th colSpan={4}>Billing</th>
              </tr>
            </thead>
            <tbody>
              {fixedClients.map((c) => {
                const b = billingByClient.get(c.id);
                return (
                  <FixedBillingRow
                    key={c.id}
                    clientId={c.id}
                    clientName={c.company_name || c.client_name}
                    month={month}
                    currency={settings.currency}
                    initialFee={Number(b?.monthly_fee ?? c.monthly_fixed_fee ?? 0)}
                    initialStatus={b?.payment_status ?? "pending"}
                    initialDueDate={b?.due_date ?? null}
                    initialAmountPaid={Number(b?.amount_paid ?? 0)}
                    action={upsertFixedBillingAction}
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
