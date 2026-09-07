"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";

const GRID = "#e7e4de";
const AXIS = "#6b6862";
const ACCENT = "#a9822f";

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #e7e4de",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};

// The two charts allowed on the dashboard (Section 11 — keep it simple).
export function ScoreOverTimeChart({ data }: { data: { date: string; score: number }[] }) {
  if (!data.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={30} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="score" stroke={ACCENT} strokeWidth={2} dot={{ r: 3, fill: ACCENT }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ObjectionsBarChart({ data }: { data: { type: string; count: number }[] }) {
  if (!data.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis type="category" dataKey="type" width={160} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill={ACCENT} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyState() {
  return <div className="flex h-[200px] items-center justify-center text-xs text-muted">Not enough data yet.</div>;
}
