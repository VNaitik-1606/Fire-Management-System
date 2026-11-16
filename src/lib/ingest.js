import "server-only";
import { db } from "@/db";
import { districts, ingestRuns, observations } from "@/db/schema";
import { fetchFirmsArea, simulateDetections } from "@/lib/firms";
import { bboxOf, bboxToString, resolveDistrict, STUDY_AREA } from "@/lib/geo";
import { eq } from "drizzle-orm";

const CHUNK = 200;

/**
 * Full ingestion pipeline:
 *  1. open an audit run          4. validate + normalize (firms.js)
 *  2. resolve district scope     5. geofence against boundaries
 *  3. fetch NASA FIRMS           6. insert with duplicate protection
 */
export async function runIngestion(input) {
  const districtRows = await db.select().from(districts);
  const scopedDistrict =
    input.user.role === "admin" ? null : districtRows.find((d) => d.id === input.user.districtId) ?? null;
  const bbox = scopedDistrict ? bboxOf(scopedDistrict.geometry) : STUDY_AREA;

  const [run] = await db
    .insert(ingestRuns)
    .values({
      source: input.mode === "simulate" ? "DEMO_FIXTURE" : input.source,
      bbox: bboxToString(bbox),
      status: "running",
      triggeredById: input.user.id,
    })
    .returning();

  let detections = [];
  let rejected = 0;
  let fetched = 0;
  let failure = null;

  if (input.mode === "simulate") {
    detections = simulateDetections(scopedDistrict ? [scopedDistrict] : districtRows, input.dayRange);
    fetched = detections.length;
  } else {
    const result = await fetchFirmsArea({
      source: input.source,
      bbox,
      dayRange: input.dayRange,
    });
    if (!result.ok) {
      failure = result.error;
    } else {
      detections = result.detections;
      fetched = result.rawCount;
      rejected = result.rejected;
    }
  }

  if (failure) {
    await db
      .update(ingestRuns)
      .set({ status: "failed", message: failure, finishedAt: new Date() })
      .where(eq(ingestRuns.id, run.id));
    return {
      runId: run.id,
      status: "failed",
      fetched: 0,
      inserted: 0,
      duplicates: 0,
      rejected: 0,
      unassigned: 0,
      message: failure,
    };
  }

  let unassigned = 0;
  const rows = detections.map((detection) => {
    const district = resolveDistrict(districtRows, detection.latitude, detection.longitude);
    if (!district) unassigned += 1;
    return {
      source: detection.source,
      satellite: detection.satellite,
      instrument: detection.instrument,
      latitude: detection.latitude,
      longitude: detection.longitude,
      brightness: detection.brightness,
      frp: detection.frp,
      confidencePct: detection.confidencePct,
      confidenceLabel: detection.confidenceLabel,
      acqDate: detection.acqDate,
      acqTime: detection.acqTime,
      acquiredAt: detection.acquiredAt,
      dayNight: detection.dayNight,
      districtId: district?.id ?? null,
      dedupeKey: detection.dedupeKey,
      isSynthetic: detection.isSynthetic,
      payload: detection.payload,
    };
  });

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const returned = await db
      .insert(observations)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: observations.id });
    inserted += returned.length;
  }
  const duplicates = rows.length - inserted;

  const message =
    input.mode === "simulate"
      ? "Simulated ingestion (FIRMS_API_KEY not configured). Detections labelled as synthetic fixtures."
      : `NASA FIRMS ${input.source} ingestion completed. Detections geofenced against ${districtRows.length} district boundaries.`;

  await db
    .update(ingestRuns)
    .set({
      status: "success",
      fetched,
      inserted,
      duplicates,
      rejected: rejected + unassigned,
      message,
      finishedAt: new Date(),
    })
    .where(eq(ingestRuns.id, run.id));

  return {
    runId: run.id,
    status: "success",
    fetched,
    inserted,
    duplicates,
    rejected,
    unassigned,
    message,
  };
}
