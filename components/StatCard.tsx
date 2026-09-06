import clsx from "clsx";

export default function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "danger";
}) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
      <p
        className={clsx(
          "mt-2 text-2xl font-semibold",
          tone === "accent" && "text-accent",
          tone === "danger" && "text-danger",
          tone === "default" && "text-ink"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink/40">{hint}</p>}
    </div>
  );
}
