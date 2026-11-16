import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import IncidentFilters from "@/components/IncidentFilters";
import { Panel, SeverityBadge, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { activeFieldOfficers } from "@/lib/incidents";
import { getDistrictOptions, getStatusBreakdown, listIncidents } from "@/lib/queries";
import { formatDateTime, INCIDENT_STATUSES, statusMeta } from "@/lib/constants";

export const dynamic = "force-dynamic";

const asString = (value) => (Array.isArray(value) ? value[0] : value);

export default async function IncidentsPage({ searchParams }) {
  const user = await getCurrentUser();
  const params = await searchParams;

  const page = Math.max(Number(asString(params.page) ?? 1) || 1, 1);
  const filters = {
    q: asString(params.q),
    status: asString(params.status),
    districtId: Number(asString(params.districtId)) || undefined,
    assigneeId: Number(asString(params.assigneeId)) || undefined,
    from: asString(params.from),
    to: asString(params.to),
    page,
    pageSize: 20,
  };

  const [{ rows, total, pageSize }, districts, officers, statuses] = await Promise.all([
    listIncidents(user, filters),
    getDistrictOptions(),
    activeFieldOfficers(user.role === "admin" ? null : user.districtId),
    getStatusBreakdown(user),
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const queryFor = (nextPage) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      const v = asString(value);
      if (v && key !== "page") next.set(key, v);
    });
    next.set("page", String(nextPage));
    return `/incidents?${next.toString()}`;
  };

  const summary = INCIDENT_STATUSES.map((status) => ({
    ...status,
    count: statuses.find((s) => s.status === status.value)?.count ?? 0,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Incident register"
        title="Suspected burning incidents"
        description="Every case is raised manually from a satellite detection, assigned to a named field officer and closed only after a documented verification report."
        meta={<span className="badge badge-neutral">{total} records in scope</span>}
        actions={
          <Link href="/map" className="btn btn-primary btn-sm">
            Raise from map
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-[1560px] space-y-3 px-4 py-4 sm:px-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {summary.map((item) => (
            <div key={item.value} className={`rounded-lg border px-3 py-2 ${item.tone}`}>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] opacity-80">{item.label}</p>
              <p className="mt-0.5 font-mono text-[19px] font-semibold leading-none">{item.count}</p>
            </div>
          ))}
        </div>

        <IncidentFilters districts={districts} officers={officers} />

        <Panel
          title="Working register"
          subtitle={`Page ${page} of ${totalPages} · ${rows.length} rows`}
          bodyClassName="p-0"
          actions={<span className="badge badge-neutral">{user.role === "field_officer" ? "My assignments" : "Jurisdiction scope"}</span>}
        >
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>District</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Severity</th>
                  <th className="hidden lg:table-cell">Crop / cause</th>
                  <th className="hidden md:table-cell">Field officer</th>
                  <th>Detected</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[12px] text-slate-500">
                      No incidents match these filters. Raise a case from the fire map when a detection warrants field verification.
                    </td>
                  </tr>
                ) : null}
                {rows.map((incident) => (
                  <tr key={incident.id}>
                    <td>
                      <Link href={`/incidents/${incident.id}`} className="font-mono text-[11.5px] font-semibold text-slate-100 hover:text-orange-300">
                        {incident.reference}
                      </Link>
                      <p className="font-mono text-[10px] text-slate-500">
                        {incident.latitude.toFixed(3)}, {incident.longitude.toFixed(3)}
                      </p>
                    </td>
                    <td>
                      <p className="text-[12px] text-slate-200">{incident.districtName}</p>
                      <p className="text-[10px] text-slate-500">{incident.state}</p>
                    </td>
                    <td>
                      <StatusBadge status={incident.status} size="sm" />
                    </td>
                    <td className="hidden sm:table-cell">
                      <SeverityBadge severity={incident.severity} />
                    </td>
                    <td className="hidden lg:table-cell">
                      <p className="text-[11.5px] text-slate-300">{incident.cropType ?? "—"}</p>
                      <p className="text-[10px] text-slate-500">{incident.suspectedCause ?? "—"}</p>
                    </td>
                    <td className="hidden md:table-cell text-[11.5px]">
                      {incident.assigneeName ?? <span className="text-amber-300/80">Unassigned</span>}
                    </td>
                    <td className="font-mono text-[10.5px] text-slate-400">{formatDateTime(incident.detectedAt)}</td>
                    <td className="text-right">
                      <Link href={`/incidents/${incident.id}`} className="btn btn-sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2.5">
            <p className="text-[10.5px] text-slate-500">
              Workflow: {INCIDENT_STATUSES.slice(0, 4).map((s) => statusMeta(s.value).label).join(" → ")} → Closed
            </p>
            <div className="flex gap-1.5">
              <Link href={queryFor(Math.max(page - 1, 1))} aria-disabled={page <= 1} className={`btn btn-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>
                ← Prev
              </Link>
              <Link
                href={queryFor(Math.min(page + 1, totalPages))}
                aria-disabled={page >= totalPages}
                className={`btn btn-sm ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
              >
                Next →
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
