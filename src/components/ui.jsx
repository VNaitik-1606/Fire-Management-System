import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { formatNumber, severityMeta, statusMeta } from "@/lib/constants";

export function StatusBadge({ status, size = "default" }) {
  const meta = statusMeta(status);
  return (
    <span className={`badge ${meta.tone} ${size === "sm" ? "px-1.5 text-[9px]" : ""}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const meta = severityMeta(severity);
  return <span className={`badge ${meta.tone}`}>{meta.label}</span>;
}

export function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  tone = "default",
  icon,
  footer,
}) {
  const toneRing = {
    default: "from-slate-400/10",
    ember: "from-orange-500/15",
    emerald: "from-emerald-500/15",
    sky: "from-sky-500/15",
    amber: "from-amber-500/15",
  };
  return (
    <div className="panel relative overflow-hidden p-4">
      <div className={`pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-b ${toneRing[tone]} to-transparent`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="kpi-label">{label}</p>
          <p className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-tight text-slate-50">{value}</p>
        </div>
        {icon ? <span className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-slate-400">{icon}</span> : null}
      </div>
      <div className="relative mt-3 flex items-center gap-2 text-[11px]">
        {delta !== undefined && delta !== null ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${delta >= 0 ? "stat-delta-up" : "stat-delta-down"}`}>
            {delta >= 0 ? <ArrowUpIcon width={11} height={11} /> : <ArrowDownIcon width={11} height={11} />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        ) : null}
        {deltaLabel ? <span className="text-slate-500">{deltaLabel}</span> : null}
        {hint ? <span className="text-slate-500">{hint}</span> : null}
      </div>
      {footer ? <div className="relative mt-3 border-t border-white/[0.06] pt-2.5 text-[11px] text-slate-400">{footer}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
  id,
}) {
  return (
    <section className={`panel ${className}`} id={id}>
      {title ? (
        <div className="panel-head">
          <div>
            <h2 className="panel-title">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName || "p-4"}>{children}</div>
    </section>
  );
}

export function DataProvenance({ synthetic, source }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-slate-400">
      <span className={`h-1.5 w-1.5 rounded-full ${synthetic ? "bg-amber-400" : "bg-emerald-400"}`} />
      {synthetic ? "Demo fixture" : source ?? "FIRMS"}
    </span>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="rounded-full border border-white/10 bg-white/[0.03] p-3 text-slate-500">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 13h8M9 9h.01M15 9h.01" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="max-w-sm text-xs text-slate-500">{description}</p>
      {action}
    </div>
  );
}

export function ProgressBar({ value, max, tone = "orange" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tones = { orange: "bg-orange-400/80", sky: "bg-sky-400/80", emerald: "bg-emerald-400/80" };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MetricRow({ label, value, mono = true }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.04] py-2 last:border-0">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-right text-[12.5px] text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export function DemoDataBanner({ syntheticCount }) {
  if (syntheticCount <= 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-[11.5px] text-amber-200/90">
      <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-300">Demo dataset</span>
      <span>
        {formatNumber(syntheticCount)} detections in this view are <strong className="font-semibold">simulated fixtures</strong>, clearly flagged in the
        database. Configure <span className="font-mono text-amber-100">FIRMS_API_KEY</span> and run a live ingestion to replace them with NASA FIRMS
        observations.
      </span>
    </div>
  );
}
