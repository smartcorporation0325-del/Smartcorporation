import Link from "next/link";
import DeleteButton from "@/components/DeleteButton";
import ProspectStatusSelect from "@/components/ProspectStatusSelect";
import { getProspects, getSettings } from "@/lib/data";
import { formatCurrency } from "@/lib/finance";
import {
  convertProspectToClientAction,
  deleteProspectAction,
  updateProspectStatusAction,
} from "./actions";

export default async function ProspectsPage() {
  const [prospects, settings] = await Promise.all([getProspects(), getSettings()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink">Prospects</h1>
        <Link href="/prospects/new" className="btn-primary">
          + Add Prospect
        </Link>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Est. Value</th>
              <th>Status</th>
              <th>Next Follow-Up</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {prospects.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink/40">
                  No prospects yet.
                </td>
              </tr>
            )}
            {prospects.map((p) => (
              <tr key={p.id}>
                <td className="font-medium text-ink">{p.company}</td>
                <td className="text-ink/70">{p.contact ?? p.email ?? "—"}</td>
                <td className="text-ink/70">{formatCurrency(Number(p.estimated_value), settings.currency)}</td>
                <td>
                  <ProspectStatusSelect
                    status={p.status}
                    action={updateProspectStatusAction.bind(null, p.id)}
                  />
                </td>
                <td className="text-ink/70">{p.next_follow_up ?? "—"}</td>
                <td className="whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    {p.status === "won" && !p.converted_client_id && (
                      <form action={convertProspectToClientAction.bind(null, p.id)}>
                        <button type="submit" className="btn-primary px-3 py-1.5">
                          Convert to Client
                        </button>
                      </form>
                    )}
                    {p.converted_client_id && (
                      <span className="badge bg-accent/10 text-accent">Converted</span>
                    )}
                    <DeleteButton action={deleteProspectAction.bind(null, p.id)} confirmMessage={`Delete ${p.company}?`} />
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
