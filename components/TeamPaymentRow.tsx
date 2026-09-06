"use client";

import { formatCurrency } from "@/lib/finance";

export default function TeamPaymentRow({
  memberId,
  memberName,
  month,
  currency,
  initialAmount,
  initialNote,
  action,
}: {
  memberId: string;
  memberName: string;
  month: string;
  currency: string;
  initialAmount: number;
  initialNote: string;
  action: (formData: FormData) => void;
}) {
  return (
    <tr>
      <td className="font-medium text-ink">{memberName}</td>
      <td>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="team_member_id" value={memberId} />
          <input type="hidden" name="month" value={month} />
          <input type="number" step="0.01" min="0" name="amount" defaultValue={initialAmount} className="input w-28" />
          <input type="text" name="note" defaultValue={initialNote} placeholder="Note (optional)" className="input w-48" />
          <button type="submit" className="btn-secondary px-3 py-1.5">
            Save
          </button>
        </form>
      </td>
      <td className="text-right font-semibold text-ink">{formatCurrency(initialAmount, currency)}</td>
    </tr>
  );
}
