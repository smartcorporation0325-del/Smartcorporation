"use client";

import { useState } from "react";
import type { PaymentType, TeamMember } from "@/lib/types";

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: "fixed_monthly", label: "Fixed Monthly" },
  { value: "profit_share", label: "Profit Share" },
  { value: "hourly", label: "Hourly" },
  { value: "one_time", label: "One-Time Payment" },
];

export default function TeamMemberForm({
  member,
  action,
}: {
  member?: TeamMember;
  action: (formData: FormData) => void;
}) {
  const [paymentType, setPaymentType] = useState(member?.payment_type ?? "fixed_monthly");

  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name *</label>
          <input name="name" required defaultValue={member?.name} className="input" />
        </div>
        <div>
          <label className="label">Role</label>
          <input name="role" defaultValue={member?.role ?? ""} className="input" placeholder="Designer, Partner..." />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Payment Type</label>
          <select
            name="payment_type"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
            className="input"
          >
            {PAYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {(paymentType === "fixed_monthly" || paymentType === "one_time") && (
          <div>
            <label className="label">
              {paymentType === "one_time" ? "Amount (this occurrence)" : "Monthly Fixed Payment"}
            </label>
            <input
              type="number"
              step="0.01"
              name="monthly_fixed_payment"
              defaultValue={member?.monthly_fixed_payment ?? ""}
              className="input"
            />
          </div>
        )}

        {paymentType === "hourly" && (
          <div>
            <label className="label">Hourly Rate</label>
            <input type="number" step="0.01" name="hourly_rate" defaultValue={member?.hourly_rate ?? ""} className="input" />
          </div>
        )}

        {paymentType === "profit_share" && (
          <div>
            <label className="label">Profit Share %</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              name="profit_share_percent"
              defaultValue={member?.profit_share_percent ?? ""}
              className="input"
            />
          </div>
        )}

        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" id="active" name="active" defaultChecked={member?.active ?? true} className="h-4 w-4" />
          <label htmlFor="active" className="text-sm text-ink">
            Active
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <a href="/team" className="btn-secondary">
          Cancel
        </a>
        <button type="submit" className="btn-primary">
          {member ? "Save Changes" : "Add Team Member"}
        </button>
      </div>
    </form>
  );
}
