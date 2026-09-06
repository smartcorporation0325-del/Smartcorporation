"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Phone,
  GraduationCap,
  ShieldAlert,
  LineChart,
  MessageCircleQuestion,
  BellRing,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/coaching", label: "Coaching", icon: GraduationCap },
  { href: "/objections", label: "Objections", icon: ShieldAlert },
  { href: "/intelligence", label: "Intelligence", icon: LineChart },
  { href: "/ask", label: "Ask Your Calls", icon: MessageCircleQuestion },
  { href: "/alerts", label: "Alerts", icon: BellRing },
];

const SETTINGS_NAV = [
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/scorecards", label: "Scorecards" },
  { href: "/settings/reps", label: "Sales Reps" },
  { href: "/settings/sync", label: "Sync Logs" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 py-6">
        <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">Elite Marry Me</div>
        <div className="mt-0.5 text-sm font-semibold text-foreground">Sales Intelligence</div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-foreground/70 hover:bg-black/[0.03] hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/70">
          <Settings className="h-4 w-4" />
          Settings
        </div>
        <div className="ml-6 space-y-0.5">
          {SETTINGS_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-black/[0.03] hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
