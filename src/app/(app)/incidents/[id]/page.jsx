import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import FireMap from "@/components/FireMap";
import IncidentActions from "@/components/IncidentActions";
import { DataProvenance, MetricRow, Panel, SeverityBadge, StatusBadge } from "@/components/ui";
import { FileIcon, PinIcon, SatelliteIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { activeFieldOfficers, loadIncident } from "@/lib/incidents";
import { getDistrictOptions, getUsers } from "@/lib/queries";
import { formatDateTime, roleLabel, statusMeta } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isFinite(incidentId)) notFound();

  const incident = await loadIncident(incidentId);
  if (!incident) notFound();

  const scoped = user.role === "admin" || (user.districtId && incident.districtId === user.districtId);
  if (!scoped) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-semibold text-slate-100">Outside your jurisdiction</p>
        <p className="mt-1 text-[12px] text-slate-500">This incident belongs to another district. The API enforces the same restriction.</p>
        <Link href="/incidents" className="btn btn-sm mt-4">Back to register</Link>
      </div>
    );
  }
  const isAssignee = incident.assignedToId === user.id;
  const canView = user.role !== "field_officer" || isAssignee;

  const [officers, users, districts] = await Promise.all([
    activeFieldOfficers(user.role === "admin" ? incident.districtId : user.districtId),
    getUsers(),
    getDistrictOptions(),
  ]);
  const actorName = new Map(users.map((u) => [u.id, u.name]));
  const reportActor = (actorId) => (actorId ? actorName.get(actorId) ?? "Former official" : "System");
  const assignedOfficer = incident.assignee;
  const requiredActions = ["confirmed", "closed"].includes(incident.status);

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-semibold text-slate-100">Not assigned to you</p>
        <p className="mt-1 text-[12px] text-slate-500">Field officers can only view incidents assigned to them.</p>
        <Link href="/incidents" className="btn btn-sm mt-4">My assignments</Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Incident ${incident.reference}`}
        title={`${incident.district?.name ?? "District"} · suspected burning case`}
        description={`Detected ${formatDateTime(incident.detectedAt)} IST · raised ${formatDateTime(incident.createdAt)} by ${reportActor(incident.createdById)}`}
        meta={
          <>
            <StatusBadge status={incident.status} />
            <SeverityBadge severity={incident.severity} />
          </>
        }
        actions={
          <>
            <Link href="/incidents" className="btn btn-sm">← Register</Link>
            <Link href="/map" className="btn btn-sm">
              <PinIcon width={12} height={12} /> Map
            </Link>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[1560px] px-4 py-4 sm:px-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_356px]">
          <div className="space-y-4">
            <Panel
              title="Case overview"
              subtitle="Administrative summary — a satellite detection alone is not a finding of crop burning"
              actions={<DataProvenance synthetic={Boolean(incident.observation?.isSynthetic)} source={incident.observation?.source} />}
            >
              <p className="text-[12.5px] leading-relaxed text-slate-300">{incident.summary}</p>
              {incident.resolutionSummary ? (
                <div className="mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2">
                  <p className="eyebrow text-emerald-400/80">Resolution</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-emerald-100/90">{incident.resolutionSummary}</p>
                </div>
              ) : null}
              <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                <div>
                  <MetricRow label="District" value={incident.district?.name ?? "—"} mono={false} />
                  <MetricRow label="State" value={incident.district?.state ?? "—"} mono={false} />
                  <MetricRow label="Coordinates" value={`${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`} />
                  <MetricRow label="Land use" value={incident.landUse ?? "—"} mono={false} />
                  <MetricRow label="Crop" value={incident.cropType ?? "Pending"} mono={false} />
                </div>
                <div>
                  <MetricRow label="Suspected cause" value={incident.suspectedCause ?? "—"} mono={false} />
                  <MetricRow label="Assigned officer" value={assignedOfficer?.name ?? "Unassigned"} mono={false} />
                  <MetricRow label="Field reports" value={String(incident.reports.length)} />
                  <MetricRow label="Last updated" value={formatDateTime(incident.updatedAt)} />
                  <MetricRow
                    label="Workflow state"
                    value={<span className="text-slate-200">{statusMeta(incident.status).label}</span>}
                    mono={false}
                  />
                </div>
              </div>
            </Panel>

            <Panel
              title="Detection provenance"
              subtitle="Immutable satellite observation linked to this case"
              actions={<SatelliteIcon width={14} height={14} className="text-emerald-400" />}
            >
              {incident.observation ? (
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <div>
                    <MetricRow label="Observation ID" value={`#${incident.observation.id}`} />
                    <MetricRow label="Source product" value={incident.observation.source} />
                    <MetricRow label="Platform" value={incident.observation.satellite ?? "—"} mono={false} />
                    <MetricRow label="Instrument" value={incident.observation.instrument ?? "—"} />
                    <MetricRow label="Acquired (UTC)" value={formatDateTime(incident.observation.acquiredAt)} />
                  </div>
                  <div>
                    <MetricRow label="Acquisition date" value={incident.observation.acqDate} />
                    <MetricRow label="Pass" value={incident.observation.dayNight === "D" ? "Daytime" : "Night-time"} mono={false} />
                    <MetricRow label="FRP" value={`${incident.observation.frp ?? "—"} MW`} />
                    <MetricRow label="Brightness" value={`${incident.observation.brightness ?? "—"} K`} />
                    <MetricRow
                      label="Confidence"
                      value={`${incident.observation.confidencePct ?? "—"}% ${
                        incident.observation.confidenceLabel ? `(${incident.observation.confidenceLabel})` : ""
                      }`}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-slate-500">The source observation record is not available for this case.</p>
              )}
              <p className="mt-2 rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10.5px] leading-relaxed text-slate-500">
                Observation rows are append-only. Administrative decisions are recorded separately in the incident event log below so satellite evidence
                and human judgement remain distinguishable.
              </p>
            </Panel>

            <Panel
              title="Field verification reports"
              subtitle={`${incident.reports.length} report${incident.reports.length === 1 ? "" : "s"} on record`}
              bodyClassName="p-0"
            >
              {incident.reports.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-slate-500">
                  No field verification report yet. Confirmation or rejection of this case is blocked until a report is filed.
                </p>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {incident.reports.map((report) => (
                    <div key={report.id} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="badge border-violet-500/30 bg-violet-500/10 text-violet-200">{report.causeClassification}</span>
                        <span className="font-mono text-[10.5px] text-slate-500">{formatDateTime(report.submittedAt)}</span>
                      </div>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">{report.findings}</p>
                      <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
                        <MetricRow label="Investigator" value={reportActor(report.investigatorId)} mono={false} />
                        <MetricRow label="Area affected" value={report.areaBurnedHa ? `${report.areaBurnedHa} ha` : "—"} />
                        <MetricRow label="Crop affected" value={report.cropAffected ?? "—"} mono={false} />
                        <MetricRow label="Evidence files" value={`${report.evidenceUrls.length} attached`} />
                      </div>
                      {report.evidenceUrls.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {report.evidenceUrls.map((url, index) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="badge border-white/10 bg-white/[0.03] text-slate-300 hover:text-orange-300"
                            >
                              <FileIcon width={10} height={10} /> Evidence {index + 1}
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {report.recommendation ? (
                        <p className="mt-2 rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-400">
                          <span className="text-slate-500">Recommendation · </span>
                          {report.recommendation}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Audit trail" subtitle="Every administrative action is retained with actor and timestamp" bodyClassName="p-0">
              <ol className="relative divide-y divide-white/[0.05]">
                {incident.events.map((event) => (
                  <li key={event.id} className="relative flex gap-3 px-4 py-2.5">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-400/70 ring-4 ring-orange-500/10" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[12px] font-medium text-slate-200">{event.action}</p>
                        <p className="font-mono text-[10px] text-slate-500">{formatDateTime(event.createdAt)}</p>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-slate-500">
                        {reportActor(event.actorId)} · {event.actorId ? roleLabel(users.find((u) => u.id === event.actorId)?.role ?? "") : "system"}
                        {event.toStatus ? ` · → ${statusMeta(event.toStatus).label}` : ""}
                      </p>
                      {event.note ? <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{event.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <div className="space-y-4">
            <IncidentActions
              incidentId={incident.id}
              status={incident.status}
              assignedToId={incident.assignedToId}
              officers={officers.filter((o) => o.id !== undefined).map((o) => ({ id: o.id, name: o.name, designation: o.designation }))}
              role={user.role}
              canReport={!requiredActions}
            />

            <Panel title="Investigation owner" subtitle="Accountable official">
              {assignedOfficer ? (
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-400/30 bg-sky-500/10 font-mono text-[11px] text-sky-200">
                      {assignedOfficer.name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-slate-100">{assignedOfficer.name}</p>
                      <p className="truncate text-[10.5px] text-slate-500">{assignedOfficer.designation ?? "Field officer"}</p>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-slate-500">{assignedOfficer.email}</p>
                </div>
              ) : (
                <p className="text-[11.5px] leading-relaxed text-amber-300/80">
                  Unassigned. Cases should be allocated to a named field officer; the audit trail records the allocation instruction.
                </p>
              )}
            </Panel>

            <Panel title="Location" subtitle="Satellite imagery · nearest detections" bodyClassName="p-2">
              <FireMap
                districts={districts}
                canRaiseIncident={false}
                compact
                focus={{ latitude: incident.latitude, longitude: incident.longitude, reference: incident.reference }}
              />
              <div className="mt-2 flex items-center justify-between px-1 font-mono text-[10px] text-slate-500">
                <span>
                  {incident.latitude.toFixed(4)}°N, {incident.longitude.toFixed(4)}°E
                </span>
                <span>{incident.district?.code}</span>
              </div>
            </Panel>

            <Panel title="Workflow policy" subtitle="Non-negotiable safeguards">
              <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                <li>• Detections never auto-convert into confirmed crop burning.</li>
                <li>• A field report is required before confirmation or rejection.</li>
                <li>• Only district/state administrators may close a case.</li>
                <li>• Field officers see only their assigned incidents.</li>
                <li>• Evidence and decisions are retained historically.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
