"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AlertIcon, CheckIcon, RefreshIcon, SatelliteIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/constants";

const SOURCES = [
  { id: "VIIRS_NOAA20_NRT", label: "VIIRS NOAA-20 NRT" },
  { id: "VIIRS_SNPP_NRT", label: "VIIRS Suomi-NPP NRT" },
  { id: "VIIRS_NOAA21_NRT", label: "VIIRS NOAA-21 NRT" },
  { id: "MODIS_NRT", label: "MODIS Terra/Aqua NRT" },
];

export default function IngestPanel({ canIngest, firmsConfigured }) {
  const router = useRouter();
  const pathname = usePathname();
  const [runs, setRuns] = useState([]);
  const [source, setSource] = useState(SOURCES[0].id);
  const [dayRange, setDayRange] = useState(3);
  const [mode, setMode] = useState(firmsConfigured ? "live" : "simulate");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    const response = await fetch("/api/ingest", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      setRuns(payload.data ?? []);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/ingest", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (active && payload) setRuns(payload.data ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function trigger() {
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, dayRange, mode }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setResult({ ok: false, message: payload.error ?? payload.result?.message ?? "Ingestion failed" });
      } else {
        const r = payload.result;
        setResult({
          ok: true,
          message: `${r.inserted} new detections stored, ${r.duplicates} duplicates suppressed, ${r.rejected} rejected. ${r.message}`,
        });
      }
      await load();
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Network error contacting ingestion endpoint" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
        <SatelliteIcon width={14} height={14} className={firmsConfigured ? "text-emerald-400" : "text-amber-400"} />
        <div className="min-w-0 text-[11px] leading-relaxed">
          <p className={firmsConfigured ? "text-emerald-300" : "text-amber-300"}>
            {firmsConfigured ? "NASA FIRMS API key detected on server" : "FIRMS_API_KEY not configured"}
          </p>
          <p className="text-slate-500">
            {firmsConfigured
              ? "Live ingestion is available. Credentials stay server-side and are never sent to the browser."
              : "Live calls are disabled. Use simulated ingestion to exercise validation, geofencing and duplicate protection."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Sensor source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="input py-1.5 text-[12px]">
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Window</label>
          <select value={dayRange} onChange={(e) => setDayRange(Number(e.target.value))} className="input py-1.5 text-[12px]">
            {[1, 2, 3, 5, 7, 10].map((d) => (
              <option key={d} value={d}>
                Last {d} day{d > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Mode</label>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-[#080d16] p-1">
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`rounded px-2 py-1.5 text-[11px] font-semibold transition ${
              mode === "live" ? "bg-orange-500/20 text-orange-200" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Live FIRMS
          </button>
          <button
            type="button"
            onClick={() => setMode("simulate")}
            className={`rounded px-2 py-1.5 text-[11px] font-semibold transition ${
              mode === "simulate" ? "bg-amber-500/20 text-amber-200" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Simulated
          </button>
        </div>
      </div>

      <button type="button" onClick={() => void trigger()} disabled={!canIngest || pending} className="btn btn-primary w-full">
        <RefreshIcon width={13} height={13} className={pending ? "animate-spin" : ""} />
        {pending ? "Running ingestion pipeline…" : canIngest ? "Run satellite ingestion" : "Ingestion requires district or state role"}
      </button>

      {result ? (
        <div
          className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed ${
            result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {result.ok ? <CheckIcon width={13} height={13} className="mt-0.5 shrink-0" /> : <AlertIcon width={13} height={13} className="mt-0.5 shrink-0" />}
          <span>{result.message}</span>
        </div>
      ) : null}

      <div>
        <p className="eyebrow mb-1.5">Recent ingestion runs</p>
        <div className="max-h-[196px] space-y-1.5 overflow-y-auto pr-1">
          {runs.length === 0 ? <p className="text-[11px] text-slate-500">No runs recorded yet.</p> : null}
          {runs.map((run) => (
            <div key={run.id} className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-slate-300">
                  <span className={`h-1.5 w-1.5 rounded-full ${run.status === "success" ? "bg-emerald-400" : "bg-rose-400"}`} />
                  #{run.id} · {run.source}
                </span>
                <span className="text-[9.5px] text-slate-500">{formatDateTime(run.startedAt)}</span>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                +{run.inserted} stored · {run.duplicates} dup · {run.rejected} rejected
              </p>
            </div>
          ))}
        </div>
      </div>
      {pathname !== "/admin" ? <p className="text-[10px] text-slate-600">Scheduled ingestion is exposed as a POST endpoint for cron automation.</p> : null}
    </div>
  );
}
