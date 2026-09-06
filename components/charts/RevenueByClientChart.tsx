"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function RevenueByClientChart({
  data,
}: {
  data: { name: string; revenue: number }[];
}) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7EBF0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: "#0B1D33" }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12, fill: "#0B1D33" }} width={60} />
        <Tooltip
          formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #E7EBF0" }}
        />
        <Bar dataKey="revenue" fill="#0F9D8C" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EmptyState() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-ink/40">
      No data for this month yet.
    </div>
  );
}
