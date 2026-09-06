import Link from "next/link";
import { getClients } from "@/lib/data";
import { deleteClientAction } from "./actions";
import DeleteButton from "@/components/DeleteButton";
import ClientFilters from "@/components/ClientFilters";

const STATUS_COLORS: Record<string, string> = {
  prospect: "bg-warn/10 text-warn",
  active: "bg-accent/10 text-accent",
  paused: "bg-ink/10 text-ink/60",
  closed: "bg-danger/10 text-danger",
};

const BILLING_LABELS: Record<string, string> = {
  hourly: "Hourly",
  fixed_monthly: "Fixed Monthly",
  project: "Project",
  other: "Other",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { status?: string; billing_model?: string };
}) {
  const clients = await getClients();

  const filtered = clients.filter((c) => {
    if (searchParams.status && c.status !== searchParams.status) return false;
    if (searchParams.billing_model && c.billing_model !== searchParams.billing_model) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink">Clients</h1>
        <Link href="/clients/new" className="btn-primary">
          + Add Client
        </Link>
      </div>

      <ClientFilters status={searchParams.status} billingModel={searchParams.billing_model} />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Client</th>
              <th>Company</th>
              <th>Status</th>
              <th>Billing</th>
              <th>Contact</th>
              <th>Payment Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink/40">
                  No clients match these filters.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="font-medium text-ink">{c.client_name}</td>
                <td className="text-ink/70">{c.company_name ?? "—"}</td>
                <td>
                  <span className={`badge ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                </td>
                <td className="text-ink/70">{BILLING_LABELS[c.billing_model]}</td>
                <td className="text-ink/70">{c.email ?? c.phone ?? "—"}</td>
                <td className="text-ink/70">{c.payment_status ?? "—"}</td>
                <td className="whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/clients/${c.id}`} className="btn-secondary px-3 py-1.5">
                      Edit
                    </Link>
                    <DeleteButton action={deleteClientAction.bind(null, c.id)} confirmMessage={`Delete ${c.client_name}?`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
