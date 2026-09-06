"use client";

export default function QuickValueForm({
  label,
  field,
  value,
  suffix,
  action,
}: {
  label: string;
  field: "monthly_fixed_payment" | "profit_share_percent";
  value: number;
  suffix?: string;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-ink/70">{label}</span>
      <div className="flex items-center gap-2">
        <input type="hidden" name="field" value={field} />
        <input type="number" step="0.01" name="value" defaultValue={value} className="input w-28" />
        {suffix && <span className="text-sm text-ink/50">{suffix}</span>}
        <button type="submit" className="btn-secondary px-3 py-1.5">
          Save
        </button>
      </div>
    </form>
  );
}
