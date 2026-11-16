"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { INCIDENT_STATUSES } from "@/lib/constants";

export default function IncidentFilters({ districts, officers }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [districtId, setDistrictId] = useState(params.get("districtId") ?? "");
  const [assigneeId, setAssigneeId] = useState(params.get("assigneeId") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  function apply() {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (status !== "all") next.set("status", status);
    if (districtId) next.set("districtId", districtId);
    if (assigneeId) next.set("assigneeId", assigneeId);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    router.push(`/incidents?${next.toString()}`);
  }

  function reset() {
    setQ("");
    setStatus("all");
    setDistrictId("");
    setAssigneeId("");
    setFrom("");
    setTo("");
    router.push("/incidents");
  }

  return (
    <div className="panel p-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
        <div className="xl:col-span-2">
          <label className="label">Search</label>
          <div className="relative">
            <SearchIcon width={13} height={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              placeholder="Reference, crop or summary…"
              className="input pl-8 py-1.5 text-[12px]"
            />
          </div>
        </div>
        <div>
          <label className="label">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input py-1.5 text-[12px]">
            <option value="all">All statuses</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">District</label>
          <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} className="input py-1.5 text-[12px]">
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.state})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Field officer</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="input py-1.5 text-[12px]">
            <option value="">Any officer</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Raised from</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input py-1.5 text-[12px]" />
        </div>
        <div>
          <label className="label">Raised to</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input py-1.5 text-[12px]" />
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="text-[10.5px] text-slate-500">Filters are enforced server-side against your role scope.</p>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="btn btn-sm">
            Reset
          </button>
          <button type="button" onClick={apply} className="btn btn-primary btn-sm">
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}
