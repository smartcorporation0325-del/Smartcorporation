"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const BILLING_LABELS: Record<string, string> = {
  hourly: "Hourly",
  fixed_monthly: "Fixed Monthly",
  project: "Project",
  other: "Other",
};

export default function ClientFilters({
  status,
  billingModel,
}: {
  status?: string;
  billingModel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        className="input w-auto"
        value={status ?? ""}
        onChange={(e) => set("status", e.target.value)}
      >
        <option value="">All statuses</option>
        {["prospect", "active", "paused", "closed"].map((s) => (
          <option key={s} value={s}>
            {s[0].toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      <select
        className="input w-auto"
        value={billingModel ?? ""}
        onChange={(e) => set("billing_model", e.target.value)}
      >
        <option value="">All billing models</option>
        {Object.entries(BILLING_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
