import { apiHandler, ok, parseNumber } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listObservations } from "@/lib/queries";
import { ensureSeeded } from "@/lib/seed";
import { isoDate, daysAgo } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return apiHandler(async () => {
    await ensureSeeded();
    const user = await requireUser();
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "json";
    const filters = {
      from: url.searchParams.get("from") ?? isoDate(daysAgo(7)),
      to: url.searchParams.get("to") ?? isoDate(new Date()),
      districtId: parseNumber(url.searchParams.get("districtId")),
      minConfidence: parseNumber(url.searchParams.get("minConfidence")),
      minFrp: parseNumber(url.searchParams.get("minFrp")),
      linked: url.searchParams.get("linked") ?? "all",
      limit: parseNumber(url.searchParams.get("limit"), 600),
    };

    const rows = await listObservations(user, filters);

    if (format === "geojson") {
      return ok({
        type: "FeatureCollection",
        features: rows.map((row) => ({
          type: "Feature",
          id: row.id,
          geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
          properties: {
            id: row.id,
            frp: row.frp,
            confidence: row.confidencePct,
            acqDate: row.acqDate,
            acqTime: row.acqTime,
            satellite: row.satellite,
            source: row.source,
            district: row.districtName,
            districtCode: row.districtCode,
            synthetic: row.isSynthetic,
            incidentId: row.incidentId,
            incidentRef: row.incidentRef,
            incidentStatus: row.incidentStatus,
            dayNight: row.dayNight,
          },
        })),
        meta: { count: rows.length, from: filters.from, to: filters.to, synthetic: rows.filter((r) => r.isSynthetic).length },
      });
    }

    return ok({
      data: rows,
      meta: {
        count: rows.length,
        from: filters.from,
        to: filters.to,
        synthetic: rows.filter((r) => r.isSynthetic).length,
      },
    });
  });
}
