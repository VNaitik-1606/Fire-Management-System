import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import FireMap from "@/components/FireMap";
import { getCurrentUser } from "@/lib/auth";
import { getDistrictOptions, getOverview } from "@/lib/queries";
import { DemoDataBanner } from "@/components/ui";
import { firmsMapKey } from "@/lib/firms";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const user = await getCurrentUser();
  const [districts, overview] = await Promise.all([getDistrictOptions(), getOverview(user)]);

  return (
    <div>
      <PageHeader
        eyebrow="Geospatial workspace"
        title="Satellite fire detection map"
        description="Clustered NASA FIRMS detections, district boundaries and NASA GIBS true-colour imagery. Hotspots remain observations until an official raises and verifies an incident."
        meta={
          <>
            <span className="badge badge-neutral">{districts.length} districts loaded</span>
            <span className="badge badge-neutral">{overview.observations.unassigned} unmapped detections</span>
            <span
              className={`badge ${
                firmsMapKey() ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {firmsMapKey() ? "Live FIRMS enabled" : "Fixtures only"}
            </span>
          </>
        }
        actions={
          <Link href="/incidents" className="btn btn-sm">
            Incident register →
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-[1560px] space-y-3 px-4 py-4 sm:px-6">
        <DemoDataBanner syntheticCount={overview.observations.synthetic} />
        <FireMap districts={districts} canRaiseIncident={user.role !== "field_officer"} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel px-3 py-2.5">
            <p className="kpi-label">Imagery layer</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
              Toggle <span className="text-slate-200">NASA GIBS</span> VIIRS corrected reflectance for a chosen date to visually corroborate smoke plumes.
              Imagery is illustrative, not evidentiary.
            </p>
          </div>
          <div className="panel px-3 py-2.5">
            <p className="kpi-label">Geofencing</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
              Points are matched to district polygons by point-in-polygon. Detections outside any configured boundary are stored unassigned rather than
              guessed.
            </p>
          </div>
          <div className="panel px-3 py-2.5">
            <p className="kpi-label">Role scope</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
              District officers only receive API rows for their own district. State administrators see the full pilot region; field officers see assigned
              cases.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
