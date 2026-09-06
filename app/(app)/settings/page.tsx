import QuickValueForm from "@/components/QuickValueForm";
import { getSettings, getTeamMembers } from "@/lib/data";
import { updateSettingsAction, updateTeamMemberQuickValueAction } from "./actions";

export default async function SettingsPage() {
  const [settings, members] = await Promise.all([getSettings(), getTeamMembers()]);

  const totalSharePercent = members
    .filter((m) => m.payment_type === "profit_share" && m.active)
    .reduce((s, m) => s + Number(m.profit_share_percent), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Settings</h1>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Company</h2>
        <form action={updateSettingsAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={settings.id} />
          <div>
            <label className="label">Company Name</label>
            <input name="company_name" defaultValue={settings.company_name} className="input" />
          </div>
          <div>
            <label className="label">Currency</label>
            <select name="currency" defaultValue={settings.currency} className="input">
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="MXN">MXN ($)</option>
              <option value="COP">COP ($)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              Save Company Settings
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink/50">
          Team Payments &amp; Profit Split
        </h2>
        <p className="mb-3 text-xs text-ink/40">
          These are the default values used to suggest each month&apos;s cost. Actual per-month
          amounts (e.g. a one-time payment) are recorded in Team → Payments This Month.
        </p>
        <div className="divide-y divide-cloud">
          {members.map((m) => (
            <QuickValueForm
              key={m.id}
              label={
                m.payment_type === "profit_share"
                  ? `${m.name} Profit Share`
                  : `${m.name} Monthly Payment`
              }
              field={m.payment_type === "profit_share" ? "profit_share_percent" : "monthly_fixed_payment"}
              value={
                m.payment_type === "profit_share"
                  ? Number(m.profit_share_percent)
                  : Number(m.monthly_fixed_payment)
              }
              suffix={m.payment_type === "profit_share" ? "%" : settings.currency}
              action={updateTeamMemberQuickValueAction.bind(null, m.id)}
            />
          ))}
        </div>
        {totalSharePercent !== 100 && (
          <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
            Active profit-share percentages currently add up to {totalSharePercent}%, not 100%.
          </p>
        )}
        <p className="mt-3 text-xs text-ink/40">
          Need to add a new partner, employee, or payment type entirely? Go to{" "}
          <a href="/team" className="text-accent underline">
            Team
          </a>
          .
        </p>
      </div>
    </div>
  );
}
