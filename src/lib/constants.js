export const ROLES = [
  {
    value: "admin",
    label: "State Administrator",
    description: "Statewide visibility, user and district management, full incident authority.",
  },
  {
    value: "district_officer",
    label: "District Officer",
    description: "District-scoped monitoring, ingestion, incident creation and assignment.",
  },
  {
    value: "field_officer",
    label: "Field Officer",
    description: "Investigates assigned incidents and submits field verification reports.",
  },
];

export const INCIDENT_STATUSES = [
  {
    value: "suspected",
    label: "Suspected",
    description: "Detection linked to an incident, awaiting field allocation.",
    tone: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  {
    value: "assigned",
    label: "Assigned",
    description: "A field official has been nominated for verification.",
    tone: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400",
  },
  {
    value: "under_investigation",
    label: "Under investigation",
    description: "Field verification is in progress.",
    tone: "bg-violet-500/10 text-violet-300 border-violet-500/30",
    dot: "bg-violet-400",
  },
  {
    value: "confirmed",
    label: "Confirmed burning",
    description: "Human-verified burning. Evidence report on record.",
    tone: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    dot: "bg-orange-400",
  },
  {
    value: "unsubstantiated",
    label: "Unsubstantiated",
    description: "Field visit found no evidence of burning.",
    tone: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    dot: "bg-slate-400",
  },
  {
    value: "closed",
    label: "Closed",
    description: "Action completed and the file is closed.",
    tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
];

export const SEVERITIES = [
  { value: "low", label: "Low", tone: "text-slate-300 border-slate-600/60 bg-slate-500/10" },
  { value: "medium", label: "Medium", tone: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  { value: "high", label: "High", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  { value: "critical", label: "Critical", tone: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
];

export const STATUS_TRANSITIONS = {
  suspected: ["assigned", "under_investigation", "unsubstantiated"],
  assigned: ["under_investigation", "unsubstantiated"],
  under_investigation: ["confirmed", "unsubstantiated"],
  confirmed: ["closed"],
  unsubstantiated: ["closed", "under_investigation"],
  closed: [],
};

export const CAUSES = [
  "Crop residue burning",
  "Stubble management",
  "Forest fire",
  "Land clearing",
  "Industrial / waste burning",
  "Undetermined",
];

export const CROPS = ["Paddy", "Wheat", "Sugarcane", "Cotton", "Mustard", "Mixed", "Non-agricultural"];

export function statusMeta(status) {
  return INCIDENT_STATUSES.find((s) => s.value === status) ?? INCIDENT_STATUSES[0];
}

export function severityMeta(severity) {
  return SEVERITIES.find((s) => s.value === severity) ?? SEVERITIES[1];
}

export function roleLabel(role) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export function canIngest(role) {
  return role === "admin" || role === "district_officer";
}

export function canAssign(role) {
  return role === "admin" || role === "district_officer";
}

export function canConfirm(role) {
  return role === "admin" || role === "district_officer" || role === "field_officer";
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

export function formatDate(value) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
