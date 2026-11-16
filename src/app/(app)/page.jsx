import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DetectionTrendChart, MiniTrendChart, StatusDonut, StatusLegend } from "@/components/charts";
import IngestPanel from "@/components/IngestPanel";
import FireMap from "@/components/FireMap";
import { DemoDataBanner, KpiCard, Panel, ProgressBar, StatusBadge, SeverityBadge } from "@/components/ui";
import { AlertIcon, ClipboardIcon, ClockIcon, FlameIcon, PinIcon, SatelliteIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { firmsMapKey } from "@/lib/firms";
import {
  getAuditTrail,
  getDailySeries,
  getDistrictOptions,
  getDistrictStats,
  getIngestRuns,
  getOverview,
  getRecentIncidents,
  getStatusBreakdown,
} from "@/lib/queries";
import { roleLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [overview, daily, districtStats, statuses, recent, districts, audit, runs] = await Promise.all([
    getOverview(user),
    getDailySeries(user, 14),
    getDistrictStats(user, 30),
    getStatusBreakdown(user),
    getRecentIncidents(user, 6),
    getDistrictOptions(),
    getAuditTrail(6, user),
    getIngestRuns(1, user),
  ]);

  const delta =
    overview.observations.prev7 > 0
      ? ((overview.observations.last7 - overview.observations.prev7) / overview.observations.prev7) * 100
      : null;
  const openCases = overview.incidents.suspected + overview.incidents.assigned + overview.incidents.investigating;
  const topDistricts = districtStats.slice(0, 6);
  const maxDetections = Math.max(...topDistricts.map((d) => d.detections), 1);
  const canIngest = user.role !== "field_officer";
  const lastRun = runs[0];

  return (
    <div>
      <PageHeader
        eyebrow="State command centre"
        title={user.role === "admin" ? "Northern India fire & crop burning monitor" : `${user.districtName ?? "District"} fire control room`}
        description={
          user.role === "admin"
            ? "Live satellite thermal anomalies across Punjab and Haryana, with district-wise incident accountability and field verification status."
            : `District-scoped view for ${user.districtName ?? "your jurisdiction"}. Detections outside your boundary are not visible.`
        }
        meta={
          <>
            <span className="badge badge-neutral">
              <SatelliteIcon width={11} height={11} className="text-emerald-400" /> FIRMS · VIIRS
            </span>
            <span className="badge badge-neutral">{roleLabel(user.role)}</span>
          </>
        }
        actions={
          <>
            <Link href="/map" className="btn btn-sm">
              <PinIcon width={12} height={12} /> Open fire map
            </Link>
            <Link href="/incidents" className="btn btn-primary btn-sm">
              <ClipboardIcon width={12} height={12} /> Review incidents
            </Link>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[1560px] space-y-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            Reporting window · last 7 days · {overview.observations.synthetic} simulated rows in last 30 days
          </p>
          <p className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${lastRun?.status === "success" ? "bg-emerald-400" : "bg-amber-400"}`} />
            Last ingestion {lastRun ? new Date(lastRun.startedAt).toLocaleString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" }) : "not run"}
          </p>
        </div>

        <DemoDataBanner syntheticCount={overview.observations.synthetic} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Detections · 7 days"
            value={overview.observations.last7.toLocaleString("en-IN")}
            delta={delta}
            deltaLabel="vs previous 7 days"
            tone="ember"
            icon={<FlameIcon width={16} height={16} className="text-orange-300" />}
            footer={<MiniTrendChart data={daily.map((d) => ({ label: d.label, detections: d.detections }))} />}
          />
          <KpiCard
            label="Open incidents"
            value={String(openCases)}
            hint={`${overview.incidents.suspected} awaiting allocation`}
            tone="amber"
            icon={<ClipboardIcon width={16} height={16} className="text-amber-300" />}
            footer={<span>{overview.incidents.assigned} assigned · {overview.incidents.investigating} under investigation</span>}
          />
          <KpiCard
            label="Confirmed burning"
            value={String(overview.incidents.confirmed)}
            hint="human-verified"
            tone="ember"
            icon={<AlertIcon width={16} height={16} className="text-orange-300" />}
            footer={<span>{overview.incidents.unsubstantiated} unsubstantiated by field parties</span>}
          />
          <KpiCard
            label="My open cases"
            value={String(overview.myOpenCases)}
            hint="assigned to you"
            tone="sky"
            icon={<PinIcon width={16} height={16} className="text-sky-300" />}
            footer={<span>{overview.incidents.last7} new cases raised this week</span>}
          />
          <KpiCard
            label="Mean FRP"
            value={`${overview.observations.avgFrp.toFixed(1)} MW`}
            hint="thermal intensity"
            tone="emerald"
            icon={<ClockIcon width={16} height={16} className="text-emerald-300" />}
            footer={<span>{Math.round((overview.observations.highConfidence / Math.max(overview.observations.total, 1)) * 100)}% of detections ≥ 80% confidence</span>}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel
            title="Detection & incident trend"
            subtitle="Daily satellite detections against incidents raised by district officers"
            className="xl:col-span-2"
            actions={<span className="badge badge-neutral">14 days</span>}
          >
            <DetectionTrendChart data={daily} />
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[10.5px] uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded bg-orange-400" /> Detections
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded bg-sky-400" /> Incidents raised
              </span>
              <span className="ml-auto normal-case tracking-normal text-slate-600">Detection ≠ violation. Incidents are created by officials.</span>
            </div>
          </Panel>

          <Panel title="Case status mix" subtitle="Administrative workflow distribution">
            <StatusDonut data={statuses} />
            <div className="mt-3">
              <StatusLegend data={statuses} />
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel
            title="District hotspots"
            subtitle="Detection density over 30 days with case load"
            className="xl:col-span-2"
            actions={<Link href="/analytics" className="link text-[11px]">Analytics →</Link>}
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Detections</th>
                    <th className="hidden sm:table-cell">Density</th>
                    <th>Open</th>
                    <th>Confirmed</th>
                    <th className="hidden md:table-cell">Last detection</th>
                  </tr>
                </thead>
                <tbody>
                  {topDistricts.map((district) => (
                    <tr key={district.id}>
                      <td>
                        <Link href={`/incidents?districtId=${district.id}`} className="font-medium text-slate-200 hover:text-orange-300">
                          {district.name}
                        </Link>
                        <span className="ml-1.5 font-mono text-[10px] text-slate-500">{district.state.slice(0, 2).toUpperCase()}</span>
                      </td>
                      <td className="font-mono text-slate-200">{district.detections}</td>
                      <td className="hidden w-32 sm:table-cell">
                        <ProgressBar value={district.detections} max={maxDetections} />
                      </td>
                      <td className="font-mono text-amber-300">{district.openCases}</td>
                      <td className="font-mono text-emerald-300">{district.confirmed}</td>
                      <td className="hidden font-mono text-[11px] text-slate-400 md:table-cell">{district.lastDetection ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Ingestion & pipeline"
            subtitle="NASA FIRMS → validation → geofence → storage"
            actions={<Link href="/admin" className="link text-[11px]">Details →</Link>}
          >
            <IngestPanel canIngest={canIngest} firmsConfigured={Boolean(firmsMapKey())} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel
            title="Latest incidents"
            subtitle={user.role === "field_officer" ? "Assigned to you" : "Newest cases across your jurisdiction"}
            className="xl:col-span-2"
            actions={<Link href="/incidents" className="link text-[11px]">View all →</Link>}
            bodyClassName="p-0"
          >
            {recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-slate-500">No incidents recorded in your scope yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {recent.map((incident) => (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.025]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-mono text-[11.5px] text-slate-200">
                        {incident.reference}
                        <span className="font-sans text-[10.5px] text-slate-500">{incident.districtName}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {incident.cropType ?? "Unclassified"} · detected{" "}
                        {new Date(incident.detectedAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                          timeZone: "Asia/Kolkata",
                        })}
                        {incident.assigneeName ? ` · ${incident.assigneeName}` : " · unassigned"}
                      </p>
                    </div>
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge status={incident.status} size="sm" />
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent administrative actions" subtitle="Immutable audit trail" bodyClassName="p-0">
            <div className="max-h-[330px] divide-y divide-white/[0.05] overflow-y-auto">
              {audit.length === 0 ? <p className="px-4 py-6 text-[12px] text-slate-500">No actions recorded.</p> : null}
              {audit.map((event) => (
                <div key={event.id} className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] text-slate-300">{event.action}</span>
                    <span className="shrink-0 font-mono text-[9.5px] text-slate-500">
                      {new Date(event.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                        timeZone: "Asia/Kolkata",
                      })}
                    </span>
                  </div>
                  <p className="truncate text-[10px] text-slate-500">
                    {event.actorName ?? "System"} · {event.incidentReference} · {event.districtName}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel
          title="Live detection overview"
          subtitle="Clustered satellite detections with district boundaries. Click a hotspot to review or raise an incident."
          actions={<Link href="/map" className="btn btn-sm">Full-screen map</Link>}
          bodyClassName="p-2"
        >
          <FireMap districts={districts} canRaiseIncident={canIngest} compact />
        </Panel>

        <p className="pb-2 text-center text-[10px] leading-relaxed text-slate-600">
          FireWatch India · Administrative decision-support only. Detections are NASA FIRMS / simulated observations; enforcement requires a field
          verification report by a named official.
        </p>
      </div>
    </div>
  );
}
