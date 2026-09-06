"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/finance";

const STATUS_OPTIONS = ["pending", "invoiced", "paid", "overdue"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-ink/10 text-ink/60",
  invoiced: "bg-warn/10 text-warn",
  paid: "bg-accent/10 text-accent",
  overdue: "bg-danger/10 text-danger",
};

export default function FixedBillingRow({
  clientId,
  clientName,
  month,
  currency,
  initialFee,
  initialStatus,
  initialDueDate,
  initialAmountPaid,
  action,
}: {
  clientId: string;
  clientName: string;
  month: string;
  currency: string;
  initialFee: number;
  initialStatus: string;
  initialDueDate: string | null;
  initialAmountPaid: number;
  action: (formData: FormData) => void;
}) {
  const [status, setStatus] = useState(initialStatus);

  return (
    <tr>
      <td className="font-medium text-ink">{clientName}</td>
      <td colSpan={4}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="month" value={month} />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-ink/40">Fee</span>
            <input type="number" step="0.01" min="0" name="monthly_fee" defaultValue={initialFee} className="input w-24" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-ink/40">Status</span>
            <select
              name="payment_status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`input w-32 ${STATUS_COLORS[status]}`}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-ink/40">Due Date</span>
            <input type="date" name="due_date" defaultValue={initialDueDate ?? ""} className="input w-36" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-ink/40">Amount Paid</span>
            <input type="number" step="0.01" min="0" name="amount_paid" defaultValue={initialAmountPaid} className="input w-24" />
          </div>
          <button type="submit" className="btn-secondary self-end px-3 py-1.5">
            Save
          </button>
          <span className="self-end text-sm font-semibold text-ink">
            {formatCurrency(Math.max(0, initialFee - initialAmountPaid), currency)} due
          </span>
        </form>
      </td>
    </tr>
  );
}
