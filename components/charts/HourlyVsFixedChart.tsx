"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { EmptyState } from "./RevenueByClientChart";

const COLORS = ["#0F9D8C", "#0B1D33"];

export default function HourlyVsFixedChart({
  hourly,
  fixed,
}: {
  hourly: number;
  fixed: number;
}) {
  const data = [
    { name: "Hourly", value: hourly },
    { name: "Fixed", value: fixed },
  ];

  if (hourly === 0 && fixed === 0) {
    return <EmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
