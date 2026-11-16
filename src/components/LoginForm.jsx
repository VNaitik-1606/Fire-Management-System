"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertIcon, FlameIcon } from "@/components/icons";

export default function LoginForm({ demoAccounts }) {
  const router = useRouter();
  const [email, setEmail] = useState(demoAccounts[0]?.email ?? "");
  const [password, setPassword] = useState(demoAccounts[0]?.password ?? "");
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Unable to sign in");
        setPending(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-7 flex items-center gap-2.5 lg:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/15 text-orange-300">
          <FlameIcon width={19} height={19} />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-slate-100">FireWatch India</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Satellite monitoring cell</p>
        </div>
      </div>

      <p className="eyebrow">Authorised personnel only</p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-slate-50">Administrative sign in</h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
        Access is restricted to state and district officials. All administrative actions are attributed and retained in the incident audit trail.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
        <div>
          <label className="label" htmlFor="email">
            Official email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="name@firewatch.gov.in"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••••••"
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-200">
            <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5 text-[12.5px]">
          {pending ? "Verifying credentials…" : "Sign in to monitoring cell"}
        </button>
      </form>

      <div className="mt-6 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="eyebrow mb-2">Demonstration accounts</p>
        <div className="space-y-1.5">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
                setError(null);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-[10.5px] text-slate-300">{account.email}</span>
                <span className="block text-[10px] text-slate-500">{account.label}</span>
              </span>
              <span className="badge badge-neutral shrink-0">{account.role}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 text-[10px] leading-relaxed text-slate-600">
        Session cookies are http-only and expire after seven days. Passwords are stored as scrypt hashes with per-user salts.
      </p>
    </div>
  );
}
