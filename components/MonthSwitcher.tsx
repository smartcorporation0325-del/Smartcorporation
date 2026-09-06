"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { formatMonthLabel } from "@/lib/finance";

export default function MonthSwitcher({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(newMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth);
    router.push(`${pathname}?${params.toString()}`);
  }

  function shift(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    go(next);
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)} className="btn-secondary px-3 py-1.5" aria-label="Previous month">
        ←
      </button>
      <span className="min-w-[10rem] text-center text-sm font-semibold text-ink">
        {formatMonthLabel(month)}
      </span>
      <button onClick={() => shift(1)} className="btn-secondary px-3 py-1.5" aria-label="Next month">
        →
      </button>
    </div>
  );
}
