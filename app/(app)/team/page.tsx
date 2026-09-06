import Link from "next/link";
import DeleteButton from "@/components/DeleteButton";
import MonthSwitcher from "@/components/MonthSwitcher";
import TeamPaymentRow from "@/components/TeamPaymentRow";
import { currentMonthKey, getSettings, getTeamMembers, getTeamPayments } from "@/lib/data";
import { deleteTeamMemberAction, upsertTeamPaymentAction } from "./actions";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  fixed_monthly: "Fixed Monthly",
  profit_share: "Profit Share",
  hourly: "Hourly",
  one_time: "One-Time",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month ?? currentMonthKey();

  const [members, payments, settings] = await Promise.all([
    getTeamMembers(),
    getTeamPayments(month),
    getSettings(),
  ]);

  const paymentByMember = new Map(payments.map((p) => [p.team_member_id, p]));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink">Team</h1>
        <Link href="/team/new" className="btn-primary">
          + Add Team Member
        </Link>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Payment Type</th>
              <th>Default Amount / %</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="font-medium text-ink">{m.name}</td>
                <td className="text-ink/70">{m.role ?? "—"}</td>
                <td className="text-ink/70">{PAYMENT_TYPE_LABELS[m.payment_type]}</td>
                <td className="text-ink/70">
                  {m.payment_type === "profit_share"
                    ? `${m.profit_share_percent}%`
                    : m.payment_type === "hourly"
                    ? `$${m.hourly_rate}/hr`
                    : `$${m.monthly_fixed_payment}`}
                </td>
                <td>
                  <span className={`badge ${m.active ? "bg-accent/10 text-accent" : "bg-ink/10 text-ink/50"}`}>
                    {m.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/team/${m.id}`} className="btn-secondary px-3 py-1.5">
                      Edit
                    </Link>
                    <DeleteButton action={deleteTeamMemberAction.bind(null, m.id)} confirmMessage={`Remove ${m.name}?`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Payments This Month</h2>
            <p className="text-xs text-ink/50">
              This is the actual amount counted as team cost for the month — editable per member without
              touching their default settings above. Ideal for one-time or changing payments (e.g. Maru).
            </p>
          </div>
          <MonthSwitcher month={month} />
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Amount &amp; Note</th>
                <th className="text-right">Current</th>
              </tr>
            </thead>
            <tbody>
              {members
                .filter((m) => m.active && m.payment_type !== "profit_share")
                .map((m) => {
                  const payment = paymentByMember.get(m.id);
                  return (
                    <TeamPaymentRow
                      key={m.id}
                      memberId={m.id}
                      memberName={m.name}
                      month={month}
                      currency={settings.currency}
                      initialAmount={Number(payment?.amount ?? m.monthly_fixed_payment ?? 0)}
                      initialNote={payment?.note ?? ""}
                      action={upsertTeamPaymentAction}
                    />
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
