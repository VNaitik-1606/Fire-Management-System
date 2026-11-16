"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChartIcon,
  ClipboardIcon,
  FlameIcon,
  GridIcon,
  LogoutIcon,
  MapIcon,
  SatelliteIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { roleLabel } from "@/lib/constants";

const NAV = [
  { href: "/", label: "Command centre", icon: GridIcon, exact: true },
  { href: "/map", label: "Fire map", icon: MapIcon },
  { href: "/incidents", label: "Incidents", icon: ClipboardIcon },
  { href: "/analytics", label: "Analytics", icon: ChartIcon },
  { href: "/admin", label: "Administration", icon: ShieldIcon, adminOnly: true },
];

export default function AppShell({ user, counts, liveFeed, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const nav = NAV.filter((item) => !item.adminOnly || user.role === "admin");
  const isActive = (href, exact) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-4">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/15 text-orange-300">
          <FlameIcon width={19} height={19} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-orange-400" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-slate-100">FireWatch India</p>
          <p className="truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">Satellite monitoring cell</p>
        </div>
      </div>

      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
          <SatelliteIcon width={13} height={13} className={liveFeed ? "text-emerald-400" : "text-amber-400"} />
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${liveFeed ? "text-emerald-300" : "text-amber-300"}`}>
              {liveFeed ? "FIRMS live feed" : "Simulated dataset"}
            </p>
            <p className="truncate text-[10px] text-slate-500">{liveFeed ? "NASA FIRMS · VIIRS NRT" : "Configure FIRMS_API_KEY"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        <p className="eyebrow px-2 pb-1.5">Operations</p>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          const badge =
            item.href === "/incidents" ? (user.role === "field_officer" ? counts.myOpen : counts.pendingAssignment) : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`nav-link ${active ? "nav-link-active" : ""}`}
            >
              <Icon width={15} height={15} className={active ? "text-orange-300" : "text-slate-500"} />
              <span className="flex-1">{item.label}</span>
              {badge > 0 ? (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
        <p className="eyebrow px-2 pb-1.5 pt-4">Reference</p>
        <Link href="/admin#provenance" onClick={() => setOpen(false)} className="nav-link">
          <UsersIcon width={15} height={15} className="text-slate-500" />
          <span className="flex-1">Data provenance</span>
        </Link>
        <a href="/api/health" target="_blank" rel="noreferrer" className="nav-link">
          <ShieldIcon width={15} height={15} className="text-slate-500" />
          <span className="flex-1">API health</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </a>
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-slate-600/40 to-slate-800 font-mono text-[11px] font-semibold text-slate-200">
              {user.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-slate-100">{user.name}</p>
              <p className="truncate text-[10px] text-slate-500">
                {roleLabel(user.role)}
                {user.districtName ? ` · ${user.districtName}` : user.state ? ` · ${user.state}` : ""}
              </p>
            </div>
          </div>
          <button type="button" onClick={signOut} disabled={signingOut} className="btn btn-sm mt-2.5 w-full">
            <LogoutIcon width={12} height={12} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <p className="mt-2 px-1 text-[9.5px] leading-relaxed text-slate-600">
          Satellite detections are observations, not confirmed violations. Field verification is mandatory before enforcement.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-white/[0.07] bg-[#080d16] lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[268px] border-r border-white/10 bg-[#080d16]">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.07] bg-[#05080e]/85 px-4 py-2.5 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="btn btn-sm" aria-label="Open navigation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-100">
            <FlameIcon width={15} height={15} className="text-orange-400" /> FireWatch India
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
