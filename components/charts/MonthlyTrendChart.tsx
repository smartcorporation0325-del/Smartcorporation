"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatMonthLabel } from "@/lib/finance";
import { EmptyState } from "./RevenueByClientChart";

export default function MonthlyTrendChart({
  data,
}: {
  data: { month: string; totalRevenue: number; profitAvailable: number }[];
}) {
  const hasData = data.some((d) => d.totalRevenue > 0);
  if (!hasData) return <EmptyState />;

  const chartData = data.map((d) => ({
    label: formatMonthLabel(d.month).replace(" ", "\n"),
    Revenue: d.totalRevenue,
    Profit: d.profitAvailable,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7EBF0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#0B1D33" }} />
        <YAxis tick={{ fontSize: 12, fill: "#0B1D33" }} width={60} />
        <Tooltip
          formatter={(value: number) => `$${value.toLocaleString()}`}
          contentStyle={{ borderRadius: 8, border: "1px solid #E7EBF0" }}
        />
        <Legend />
        <Line type="monotone" dataKey="Revenue" stroke="#0F9D8C" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Profit" stroke="#0B1D33" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
