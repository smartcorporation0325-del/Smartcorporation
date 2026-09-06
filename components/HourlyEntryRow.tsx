"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/finance";

export default function HourlyEntryRow({
  clientId,
  clientName,
  month,
  currency,
  initialHours,
  initialRate,
  action,
}: {
  clientId: string;
  clientName: string;
  month: string;
  currency: string;
  initialHours: number;
  initialRate: number;
  action: (formData: FormData) => void;
}) {
  const [hours, setHours] = useState(initialHours);
  const [rate, setRate] = useState(initialRate);

  return (
    <tr>
      <td className="font-medium text-ink">{clientName}</td>
      <td>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="month" value={month} />
          <input
            type="number"
            step="0.25"
            min="0"
            name="hours_worked"
            value={hours}
            onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
            className="input w-24"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            name="hourly_rate"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
            className="input w-24"
          />
          <button type="submit" className="btn-secondary px-3 py-1.5">
            Save
          </button>
        </form>
      </td>
      <td className="font-semibold text-ink">{formatCurrency(hours * rate, currency)}</td>
    </tr>
  );
}
