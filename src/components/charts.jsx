"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { statusMeta } from "@/lib/constants";

const axisStyle = { fontSize: 10, fill: "#64748b" };
const tooltipStyle = {
  background: "#0b111c",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 11,
  color: "#e2e8f0",
  boxShadow: "0 18px 40px -20px rgba(0,0,0,0.9)",
};

const STATUS_COLORS = {
  suspected: "#fbbf24",
  assigned: "#38bdf8",
  under_investigation: "#a78bfa",
  confirmed: "#fb923c",
  unsubstantiated: "#94a3b8",
  closed: "#34d399",
};

export function DetectionTrendChart({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="detectionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity={0.42} />
            <stop offset="100%" stopColor="#fb923c" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="caseFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.09)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#f8fafc", fontWeight: 600 }} />
        <Area type="monotone" dataKey="detections" name="Detections" stroke="#fb923c" strokeWidth={1.8} fill="url(#detectionFill)" />
        <Area type="monotone" dataKey="cases" name="Incidents raised" stroke="#38bdf8" strokeWidth={1.6} fill="url(#caseFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ data, height = 220 }) {
  if (data.length === 0) return <div className="py-16 text-center text-xs text-slate-500">No incident records yet.</div>;
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#64748b"} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[24px] font-semibold leading-none text-slate-50">{total}</span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.16em] text-slate-500">Incidents</span>
      </div>
    </div>
  );
}

export function StatusLegend({ data }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {data.map((item) => (
        <div key={item.status} className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[item.status] ?? "#64748b" }} />
          <span className="flex-1 truncate">{statusMeta(item.status).label}</span>
          <span className="font-mono text-slate-300">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

export function DistrictBarChart({ data, height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.09)" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} interval={0} angle={-28} textAnchor="end" height={48} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
        <Bar dataKey="detections" name="Detections" fill="#fb923c" radius={[3, 3, 0, 0]} />
        <Bar dataKey="confirmed" name="Confirmed cases" fill="#34d399" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HourlyChart({ data, height = 200 }) {
  const filled = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    detections: data.find((d) => d.hour === hour)?.detections ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={filled} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.09)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="detections" name="Detections" radius={[2, 2, 0, 0]}>
          {filled.map((entry) => (
            <Cell key={entry.hour} fill={entry.hour >= 16 || entry.hour <= 8 ? "#fb923c" : "#facc15"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CauseChart({ data, height = 220 }) {
  if (data.length === 0) return <div className="py-16 text-center text-xs text-slate-500">No field reports submitted yet.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.09)" horizontal={false} />
        <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="cause" tick={axisStyle} axisLine={false} tickLine={false} width={130} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="count" name="Verified reports" fill="#a78bfa" radius={[0, 3, 3, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SparkLine({ data, color = "#fb923c" }) {
  const points = data.map((value, index) => ({ index, value }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MiniTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="miniFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="detections" stroke="#fb923c" strokeWidth={1.4} fill="url(#miniFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
