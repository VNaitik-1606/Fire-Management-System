import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import IngestPanel from "@/components/IngestPanel";
import { Panel, StatusBadge } from "@/components/ui";
import { SatelliteIcon, ShieldIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { firmsMapKey } from "@/lib/firms";
import { getAuditTrail, getDistrictStats, getIngestRuns, getUsers, getOverview } from "@/lib/queries";
import { formatDateTime, roleLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldIcon width={26} height={26} className="mx-auto text-slate-500" />
        <p className="mt-3 text-sm font-semibold text-slate-100">State administrator access required</p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
          Staff accounts, district reference data and ingestion history are restricted. The same rule is enforced by the API, not only by this page.
        </p>
        <Link href="/" className="btn btn-sm mt-4">Return to command centre</Link>
      </div>
    );
  }

  const [users, districtStats, runs, audit, overview] = await Promise.all([
    getUsers(),
    getDistrictStats(user, 30),
    getIngestRuns(15, user),
    getAuditTrail(25, user),
    getOverview(user),
  ]);

  const firmsConfigured = Boolean(firmsMapKey());

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="System, staff & data provenance"
        description="Manage access to the monitoring cell, inspect ingestion health and verify where every data point in this deployment originates."
        meta={<span className="badge badge-neutral">{users.length} staff accounts</span>}
        actions={<a href="/api/health" target="_blank" rel="noreferrer" className="btn btn-sm">API health</a>}
      />

      <div className="mx-auto w-full max-w-[1560px] space-y-4 px-4 py-4 sm:px-6">
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel
            id="provenance"
            title="Data provenance"
            subtitle="What this deployment is actually showing"
            className="xl:col-span-2"
            actions={<SatelliteIcon width={14} height={14} className={firmsConfigured ? "text-emerald-400" : "text-amber-400"} />}
          >
            <div
              className={`rounded-md border px-3 py-2 text-[11.5px] leading-relaxed ${
                firmsConfigured
                  ? "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/[0.07] text-amber-200"
              }`}
            >
              <p className="font-semibold">
                {firmsConfigured ? "Live NASA FIRMS credentials configured" : "NASA FIRMS key not configured — dataset is simulated"}
              </p>
              <p className="mt-1 opacity-90">
                {firmsConfigured
                  ? "Ingestion calls the FIRMS Area API server-side using FIRMS_API_KEY. The key is never exposed to the browser."
                  : "The server cannot call the FIRMS Area API, so seeded observations are generated fixtures flagged is_synthetic = true. Every map, table and export labels them as demo data. Configure FIRMS_API_KEY and run a live ingestion to store real observations."}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5">
                <p className="eyebrow">Separation of concerns</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  `observations` stores raw validated detections; `incidents` stores administrative cases. A case links to at most one observation and is
                  never created by the ingestion pipeline.
                </p>
              </div>
              <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5">
                <p className="eyebrow">Geofencing</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Point-in-polygon matching against {districtStats.length} district boundaries. {overview.observations.unassigned} detections currently fall
                  outside mapped boundaries and stay unassigned.
                </p>
              </div>
              <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5">
                <p className="eyebrow">Duplicate protection</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  A unique dedupe key of source, platform, rounded coordinate, acquisition date and time makes ingestion idempotent under cron retries.
                </p>
              </div>
              <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5">
                <p className="eyebrow">Auditability</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Incidents, reports and status changes are append-only event records with actor attribution. Authorisation is enforced in every route
                  handler, not only in the UI.
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-white/[0.07] bg-[#080d16] p-2.5">
              <p className="eyebrow mb-1.5">REST surface</p>
              <div className="grid gap-1 font-mono text-[10px] text-slate-500 sm:grid-cols-2">
                <span>
                  <span className="text-emerald-400">GET</span> /api/observations?format=geojson
                </span>
                <span>
                  <span className="text-emerald-400">POST</span> /api/ingest
                </span>
                <span>
                  <span className="text-emerald-400">GET</span> /api/incidents
                </span>
                <span>
                  <span className="text-sky-400">POST</span> /api/incidents
                </span>
                <span>
                  <span className="text-amber-400">PATCH</span> /api/incidents/:id
                </span>
                <span>
                  <span className="text-sky-400">POST</span> /api/incidents/:id/reports
                </span>
                <span>
                  <span className="text-emerald-400">GET</span> /api/analytics?days=30
                </span>
                <span>
                  <span className="text-emerald-400">GET</span> /api/health
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Ingestion control" subtitle="Manual trigger for the cron-equivalent pipeline">
            <IngestPanel canIngest firmsConfigured={firmsConfigured} />
          </Panel>
        </div>

        <Panel title="Ingestion history" subtitle="Latest pipeline runs with validation counters" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Fetched</th>
                  <th>Stored</th>
                  <th>Duplicates</th>
                  <th>Rejected</th>
                  <th>Triggered by</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="font-mono text-slate-300">#{run.id}</td>
                    <td className="font-mono text-[11px] text-slate-400">{run.source}</td>
                    <td>
                      <span
                        className={`badge ${
                          run.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="font-mono">{run.fetched}</td>
                    <td className="font-mono text-emerald-300">{run.inserted}</td>
                    <td className="font-mono">{run.duplicates}</td>
                    <td className="font-mono">{run.rejected}</td>
                    <td className="text-[11px]">{run.triggeredByName ?? "system"}</td>
                    <td className="font-mono text-[10.5px] text-slate-400">{formatDateTime(run.startedAt)}</td>
                  </tr>
                ))}
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-[12px] text-slate-500">
                      No ingestion runs recorded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Staff accounts & access" subtitle="Role-based permissions enforced in the API" bodyClassName="p-0">
            <div className="max-h-[420px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Officer</th>
                    <th>Role</th>
                    <th>Jurisdiction</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <p className="text-[12px] text-slate-200">{member.name}</p>
                        <p className="font-mono text-[9.5px] text-slate-500">{member.email}</p>
                      </td>
                      <td className="text-[11px] text-slate-300">{roleLabel(member.role)}</td>
                      <td className="text-[11px]">
                        {member.districtName ? (
                          <>
                            {member.districtName}
                            <span className="ml-1 font-mono text-[9.5px] text-slate-500">{member.districtCode}</span>
                          </>
                        ) : (
                          <span className="text-slate-500">Statewide</span>
                        )}
                      </td>
                      <td className="font-mono text-[10px] text-slate-500">{formatDateTime(member.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="District coverage" subtitle="Boundary polygons loaded for geofencing" bodyClassName="p-0">
            <div className="max-h-[420px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>State</th>
                    <th>Code</th>
                    <th>Detections · 30d</th>
                    <th>Cases</th>
                    <th>Last detection</th>
                  </tr>
                </thead>
                <tbody>
                  {districtStats.map((district) => (
                    <tr key={district.id}>
                      <td className="text-[12px] text-slate-200">{district.name}</td>
                      <td className="text-[11px] text-slate-400">{district.state}</td>
                      <td className="font-mono text-[10px] text-slate-500">{district.code}</td>
                      <td className="font-mono text-slate-200">{district.detections}</td>
                      <td className="font-mono">
                        {district.cases}
                        <span className="ml-1 text-[10px] text-amber-300">/{district.openCases} open</span>
                      </td>
                      <td className="font-mono text-[10.5px] text-slate-500">{district.lastDetection ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <Panel title="Administrative audit trail" subtitle="Latest 25 recorded actions across all districts" bodyClassName="p-0">
          <div className="divide-y divide-white/[0.05]">
            {audit.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-200">{event.action}</p>
                  <p className="truncate text-[10px] text-slate-500">
                    {event.actorName ?? "System"} · {event.actorRole ? roleLabel(event.actorRole) : "system"} · {event.incidentReference} ·{" "}
                    {event.districtName}
                  </p>
                </div>
                {event.toStatus ? <StatusBadge status={event.toStatus} size="sm" /> : null}
                <span className="font-mono text-[10px] text-slate-500">{formatDateTime(event.createdAt)}</span>
                <Link href={`/incidents/${event.incidentId}`} className="btn btn-sm">Open</Link>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
