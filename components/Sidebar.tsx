"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { signOut } from "@/lib/auth-actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/clients", label: "Clients", icon: "🧑‍💼" },
  { href: "/hourly", label: "Hourly Clients", icon: "⏱️" },
  { href: "/fixed", label: "Fixed Clients", icon: "📅" },
  { href: "/prospects", label: "Prospects", icon: "🎯" },
  { href: "/finances", label: "Finances", icon: "💰" },
  { href: "/expenses", label: "Expenses", icon: "🧾" },
  { href: "/team", label: "Team", icon: "👥" },
  { href: "/history", label: "History", icon: "🗂️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent/10 text-accent"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-cloud bg-ink px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold">
            SC
          </div>
          <span className="font-semibold">{companyName}</span>
        </div>
        <button
          aria-label="Toggle menu"
          className="rounded-lg p-2 hover:bg-white/10"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-20 flex flex-col bg-ink text-white md:hidden">
          {nav}
          <div className="border-t border-white/10 p-3">
            <form action={signOut}>
              <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col bg-ink text-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-semibold">
            SC
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{companyName}</p>
            <p className="text-xs text-white/50">CRM &amp; Finance</p>
          </div>
        </div>
        {nav}
        <div className="border-t border-white/10 p-3">
          <form action={signOut}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10">
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
