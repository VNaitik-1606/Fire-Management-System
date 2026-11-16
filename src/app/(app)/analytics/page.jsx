import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { CauseChart, DetectionTrendChart, DistrictBarChart, HourlyChart, StatusDonut, StatusLegend } from "@/components/charts";
import { KpiCard, Panel, ProgressBar, SeverityBadge } from "@/components/ui";
import { AlertIcon, CheckIcon, ClockIcon, FlameIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { getAnalytics } from "@/lib/queries";
import { formatNumber, statusMeta } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const raw = Array.isArray(params.days) ? params.days[0] : params.days;
  const days = Math.min(Math.max(Number(raw) || 30, 7), 90);
  const data = await getAnalytics(user, days);

  const confirmed = data.overview.incidents.confirmed + data.overview.incidents.closed;
  const decided = confirmed + data.overview.incidents.unsubstantiated;
  const confirmationRate = decided > 0 ? (confirmed / decided) * 100 : 0;
  const areaReported = data.causes.reduce((sum, c) => sum + c.area, 0);
  const maxDetections = Math.max(...data.districtStats.map((d) => d.detections), 1);
  const topDistricts = [...data.districtStats].sort((a, b) => b.detections - a.detections).slice(0, 10);

  return (
    <div>
      <PageHeader
        eyebrow="Evidence & performance"
        title="Monitoring analytics"
        description="District-wise detection load, case outcomes and field verification performance, computed directly from stored observations and incident records."
        meta={
          <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
            {[7, 14, 30, 60, 90].map((option) => (
              <Link
                key={option}
                href={`/analytics?days=${option}`}
                className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                  days === option ? "bg-orange-500/20 text-orange-200" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {option}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1560px] space-y-4 px-4 py-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={`Detections · ${days} days`}
            value={formatNumber(data.overview.observations.total)}
            hint="all sensors"
            tone="ember"
            icon={<FlameIcon width={16} height={16} className="text-orange-300" />}
            footer={<span>{formatNumber(data.overview.observations.highConfidence)} with ≥80% confidence</span>}
          />
          <KpiCard
            label="Confirmation rate"
            value={`${confirmationRate.toFixed(0)}%`}
            hint={`${decided} decided cases`}
            tone="emerald"
            icon={<CheckIcon width={16} height={16} className="text-emerald-300" />}
            footer={<span>{data.overview.incidents.unsubstantiated} claims unsubstantiated by field parties</span>}
          />
          <KpiCard
            label="Mean resolution time"
            value={`${data.avgResolutionHours.toFixed(1)} h`}
            hint="raised → decided"
            tone="sky"
            icon={<ClockIcon width={16} height={16} className="text-sky-300" />}
            footer={<span>{data.resolvedCount} resolved cases in scope</span>}
          />
          <KpiCard
            label="Reported area affected"
            value={`${areaReported.toFixed(1)} ha`}
            hint="from field reports"
            tone="amber"
            icon={<AlertIcon width={16} height={16} className="text-amber-300" />}
            footer={<span>{data.causes.reduce((sum, c) => sum + c.count, 0)} verification reports filed</span>}
          />
        </div>

        <Panel title="Detection and case trend" subtitle={`Daily series over the last ${days} days`}>
          <DetectionTrendChart data={data.daily} height={280} />
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title="District detection load" subtitle="Top 10 districts in scope" className="xl:col-span-2">
            <DistrictBarChart data={topDistricts.map((d) => ({ name: d.name, detections: d.detections, confirmed: d.confirmed }))} height={300} />
          </Panel>
          <div className="space-y-4">
            <Panel title="Outcome mix" subtitle="Workflow distribution">
              <StatusDonut data={data.statuses} height={190} />
              <div className="mt-2">
                <StatusLegend data={data.statuses} />
              </div>
            </Panel>
            <Panel title="Sensor contribution" subtitle="Detections by product">
              <div className="space-y-2">
                {data.sources.map((source) => (
                  <div key={source.source}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-300">{source.source}</span>
                      <span className="text-slate-500">{formatNumber(source.count)}</span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar value={source.count} max={Math.max(...data.sources.map((s) => s.count), 1)} tone="sky" />
                    </div>
                  </div>
                ))}
                {data.sources.length === 0 ? <p className="text-[11px] text-slate-500">No detections in window.</p> : null}
              </div>
            </Panel>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title="Diurnal detection pattern" subtitle="Acquisition hour (UTC) — evening and night passes dominate" className="xl:col-span-2">
            <HourlyChart data={data.hourly} height={220} />
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Agricultural residue burning is typically detected in late-afternoon and night overpasses; daytime anomalies may reflect other heat sources.
            </p>
          </Panel>
          <Panel title="Verified causes" subtitle="From submitted field reports">
            <CauseChart data={data.causes.map((c) => ({ cause: c.cause, count: c.count }))} height={220} />
          </Panel>
        </div>

        <Panel title="District scorecard" subtitle="Detection burden against administrative throughput" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>District</th>
                  <th>Detections</th>
                  <th className="hidden sm:table-cell">High conf.</th>
                  <th>Cases</th>
                  <th>Open</th>
                  <th>Confirmed</th>
                  <th className="hidden md:table-cell">Confirmation ratio</th>
                </tr>
              </thead>
              <tbody>
                {data.districtStats.map((district) => {
                  const total = district.confirmed + district.openCases;
                  const ratio = total > 0 ? (district.confirmed / total) * 100 : 0;
                  return (
                    <tr key={district.id}>
                      <td>
                        <Link href={`/incidents?districtId=${district.id}`} className="font-medium text-slate-200 hover:text-orange-300">
                          {district.name}
                        </Link>
                        <span className="ml-1.5 text-[10px] text-slate-500">{district.state}</span>
                      </td>
                      <td className="w-40">
                        <div className="flex items-center gap-2">
                          <span className="w-8 font-mono text-slate-200">{district.detections}</span>
                          <ProgressBar value={district.detections} max={maxDetections} />
                        </div>
                      </td>
                      <td className="hidden font-mono text-slate-400 sm:table-cell">{district.highConfidence}</td>
                      <td className="font-mono text-slate-200">{district.cases}</td>
                      <td className="font-mono text-amber-300">{district.openCases}</td>
                      <td className="font-mono text-emerald-300">{district.confirmed}</td>
                      <td className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="w-10 font-mono text-[11px] text-slate-400">{ratio.toFixed(0)}%</span>
                          <ProgressBar value={ratio} max={100} tone="emerald" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-3 py-2 text-[10px] text-slate-500">
            <span>Statuses under monitoring: {data.statuses.map((s) => statusMeta(s.status).label).join(", ") || "none"}</span>
            <SeverityBadge severity="high" />
            <span>Severity is derived from detection FRP at intake, then confirmed administratively.</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
