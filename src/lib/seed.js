import "server-only";
import { db } from "@/db";
import {
  districts,
  users,
  observations,
  incidents,
  incidentEvents,
  investigationReports,
  ingestRuns,
} from "@/db/schema";
import { DISTRICT_SEEDS, buildDistrictPolygon } from "@/lib/districts-data";
import { pointInPolygon, resolveDistrict } from "@/lib/geo";
import { hashPassword } from "@/lib/auth";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export const DEMO_PASSWORD = "Firewatch@2026";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAFF = [
  { name: "Ananya Verma", email: "admin@firewatch.gov.in", role: "admin", designation: "Joint Secretary, State Pollution Control Board", district: null },
  { name: "Rakesh Singh", email: "ludhiana.do@firewatch.gov.in", role: "district_officer", designation: "District Revenue Officer", district: "PB-LDH" },
  { name: "Priya Nair", email: "patiala.do@firewatch.gov.in", role: "district_officer", designation: "Sub-Divisional Magistrate", district: "PB-PAT" },
  { name: "Harjit Kaur", email: "sangrur.do@firewatch.gov.in", role: "district_officer", designation: "District Agriculture Officer", district: "PB-SGR" },
  { name: "Vikram Yadav", email: "karnal.do@firewatch.gov.in", role: "district_officer", designation: "District Revenue Officer", district: "HR-KNL" },
  { name: "Amanpreet Singh", email: "amanpreet.fo@firewatch.gov.in", role: "field_officer", designation: "Agriculture Development Officer, Ludhiana", district: "PB-LDH" },
  { name: "Neha Sharma", email: "neha.fo@firewatch.gov.in", role: "field_officer", designation: "Block Development Officer, Patiala", district: "PB-PAT" },
  { name: "Gurpreet Bajwa", email: "gurpreet.fo@firewatch.gov.in", role: "field_officer", designation: "Agriculture Development Officer, Sangrur", district: "PB-SGR" },
  { name: "Rajesh Kumar", email: "rajesh.fo@firewatch.gov.in", role: "field_officer", designation: "Tehsildar, Karnal", district: "HR-KNL" },
  { name: "Simran Gill", email: "simran.fo@firewatch.gov.in", role: "field_officer", designation: "Block Development Officer, Bathinda", district: "PB-BTI" },
];

const SATS = [
  { satellite: "NOAA-20 (simulated)", source: "VIIRS_NOAA20_NRT", instrument: "VIIRS" },
  { satellite: "NOAA-21 (simulated)", source: "VIIRS_NOAA21_NRT", instrument: "VIIRS" },
  { satellite: "Suomi NPP (simulated)", source: "VIIRS_SNPP_NRT", instrument: "VIIRS" },
  { satellite: "Aqua (simulated)", source: "MODIS_NRT", instrument: "MODIS" },
];

const CAUSE_BY_STATUS = {
  suspected: "Under field verification",
  assigned: "Under field verification",
  under_investigation: "Crop residue burning",
  confirmed: "Crop residue burning",
  unsubstantiated: "Industrial / waste burning",
  closed: "Crop residue burning",
};

function isoDateString(d) {
  return d.toISOString().slice(0, 10);
}

function dedupeKey(o) {
  return [o.source, o.satellite, o.latitude.toFixed(4), o.longitude.toFixed(4), o.acqDate, o.acqTime].join("|");
}

async function isEmptyDatabase() {
  const result = await db.select({ n: sql`count(*)::int` }).from(districts);
  return Number(result[0]?.n ?? 0) === 0;
}

async function seed() {
  if (!(await isEmptyDatabase())) return;
  const rand = mulberry32(20260214);

  await db
    .insert(districts)
    .values(
      DISTRICT_SEEDS.map((seedItem) => ({
        code: seedItem.code,
        name: seedItem.name,
        state: seedItem.state,
        geometry: buildDistrictPolygon(seedItem),
        centerLat: seedItem.centerLat,
        centerLng: seedItem.centerLng,
      })),
    )
    .onConflictDoNothing();

  const districtRows = await db.select().from(districts);
  const districtByCode = new Map(districtRows.map((d) => [d.code, d]));

  const passwordHash = hashPassword(DEMO_PASSWORD);
  await db
    .insert(users)
    .values(
      STAFF.map((member) => ({
        name: member.name,
        email: member.email,
        passwordHash,
        role: member.role,
        designation: member.designation,
        districtId: member.district ? districtByCode.get(member.district)?.id ?? null : null,
      })),
    )
    .onConflictDoNothing();

  const userRows = await db.select().from(users);
  const admin = userRows.find((u) => u.role === "admin");
  const doByDistrictId = new Map(
    userRows.filter((u) => u.role === "district_officer" && u.districtId).map((u) => [u.districtId, u]),
  );
  const foByDistrictId = new Map(
    userRows.filter((u) => u.role === "field_officer" && u.districtId).map((u) => [u.districtId, u]),
  );

  const days = 21;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const detectionRows = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - dayOffset);
    const acqDate = isoDateString(day);

    for (const seedItem of DISTRICT_SEEDS) {
      const district = districtByCode.get(seedItem.code);
      if (!district) continue;
      const recency = 0.55 + (1 - dayOffset / days) * 0.9;
      const expected = seedItem.weight * recency * 2.1;
      const n = Math.max(0, Math.round(expected + (rand() - 0.5) * 3));
      let placed = 0;
      let attempts = 0;
      while (placed < n && attempts < 80) {
        attempts += 1;
        const lat = seedItem.centerLat + (rand() - 0.5) * seedItem.dLat * 1.7;
        const lng = seedItem.centerLng + (rand() - 0.5) * seedItem.dLng * 1.7;
        if (!pointInPolygon(district.geometry, lat, lng)) continue;
        placed += 1;
        const sat = SATS[Math.floor(rand() * SATS.length)];
        const confidencePct = Math.round(42 + rand() * 57);
        const confidenceLabel = confidencePct >= 80 ? "high" : confidencePct >= 60 ? "nominal" : "low";
        const frp = Number((1 + rand() ** 2 * 68).toFixed(1));
        const hour = rand() < 0.35 ? 6 + Math.floor(rand() * 4) : 13 + Math.floor(rand() * 8);
        const minute = Math.floor(rand() * 60);
        const acqTime = `${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}`;
        const acquiredAt = new Date(day.getTime() + (hour * 60 + minute) * 60 * 1000);
        const row = {
          source: sat.source,
          satellite: sat.satellite,
          instrument: sat.instrument,
          latitude: Number(lat.toFixed(4)),
          longitude: Number(lng.toFixed(4)),
          brightness: Number((295 + rand() * 58).toFixed(1)),
          frp,
          confidencePct,
          confidenceLabel,
          acqDate,
          acqTime,
          acquiredAt,
          dayNight: hour < 12 ? "D" : "N",
          districtId: district.id,
          isSynthetic: true,
          payload: { note: "Demonstration fixture — not a live NASA FIRMS record", district: district.code },
        };
        detectionRows.push({ ...row, dedupeKey: dedupeKey(row) });
      }
    }
  }

  for (let i = 0; i < detectionRows.length; i += 200) {
    await db.insert(observations).values(detectionRows.slice(i, i + 200)).onConflictDoNothing();
  }

  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - 12);
  const candidates = await db
    .select()
    .from(observations)
    .where(and(gte(observations.acquiredAt, since), eq(observations.isSynthetic, true)))
    .orderBy(desc(observations.frp))
    .limit(160);

  const statusPlan = [
    ...Array(9).fill("suspected"),
    ...Array(8).fill("assigned"),
    ...Array(6).fill("under_investigation"),
    ...Array(7).fill("confirmed"),
    ...Array(3).fill("unsubstantiated"),
    ...Array(2).fill("closed"),
  ];

  const seqByDistrict = new Map();
  let candidateIndex = 0;

  for (let i = 0; i < statusPlan.length && candidateIndex < candidates.length; i += 1) {
    const status = statusPlan[i];
    const observation = candidates[(candidateIndex * 5 + 3) % candidates.length];
    candidateIndex += 1;
    const district = districtRows.find((d) => d.id === observation.districtId);
    if (!district) continue;
    const seq = (seqByDistrict.get(district.code) ?? 0) + 1;
    seqByDistrict.set(district.code, seq);
    const reference = `${district.code}-${observation.acqDate.slice(0, 4)}-${String(seq).padStart(3, "0")}`;
    const districtOfficer = doByDistrictId.get(district.id) ?? admin;
    const fieldOfficer = foByDistrictId.get(district.id) ?? null;
    const assigned = ["assigned", "under_investigation", "confirmed", "closed"].includes(status);
    const severity =
      observation.frp > 45 ? "critical" : observation.frp > 25 ? "high" : observation.frp > 12 ? "medium" : "low";
    const createdAt = new Date(observation.acquiredAt.getTime() + 1000 * 60 * 60 * (2 + (i % 6)));

    const [incident] = await db
      .insert(incidents)
      .values({
        reference,
        observationId: observation.id,
        districtId: district.id,
        latitude: observation.latitude,
        longitude: observation.longitude,
        status,
        severity,
        landUse: "Agricultural",
        cropType: ["Paddy", "Wheat", "Sugarcane", "Cotton", "Mustard"][i % 5],
        suspectedCause: CAUSE_BY_STATUS[status],
        summary: `Satellite detection (${observation.satellite}) with FRP ${observation.frp} MW and ${observation.confidencePct}% confidence near ${district.name}. Raised for field verification.`,
        assignedToId: assigned ? fieldOfficer?.id ?? null : null,
        createdById: districtOfficer.id,
        detectedAt: observation.acquiredAt,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + 1000 * 60 * 60 * 6),
        resolutionSummary:
          status === "confirmed"
            ? "Residue burning verified on site and penal challan issued under the Air (Prevention and Control of Pollution) Act."
            : status === "unsubstantiated"
              ? "Field party found no active burning; detection attributed to a brick kiln plume."
              : status === "closed"
                ? "Verification completed, fine recovered and site cleared."
                : null,
      })
      .returning();

    const events = [
      {
        incidentId: incident.id,
        actorId: districtOfficer.id,
        action: "Incident created from satellite detection",
        toStatus: "suspected",
        note: `Observation #${observation.id} linked. Classification pending field verification.`,
        createdAt,
      },
    ];
    if (assigned && fieldOfficer) {
      events.push({
        incidentId: incident.id,
        actorId: districtOfficer.id,
        action: "Assigned to field officer",
        fromStatus: "suspected",
        toStatus: "assigned",
        note: `Allocated to ${fieldOfficer.name} for site inspection within 24 hours.`,
        createdAt: new Date(createdAt.getTime() + 1000 * 60 * 90),
      });
    }
    if (["under_investigation", "confirmed", "unsubstantiated", "closed"].includes(status)) {
      events.push({
        incidentId: incident.id,
        actorId: fieldOfficer?.id ?? districtOfficer.id,
        action: "Field verification started",
        fromStatus: "assigned",
        toStatus: "under_investigation",
        note: "Field party reached the reported coordinate.",
        createdAt: new Date(createdAt.getTime() + 1000 * 60 * 60 * 8),
      });
    }
    if (["confirmed", "unsubstantiated", "closed"].includes(status)) {
      events.push({
        incidentId: incident.id,
        actorId: fieldOfficer?.id ?? districtOfficer.id,
        action: status === "unsubstantiated" ? "Detected burning not substantiated" : "Burning confirmed by field report",
        fromStatus: "under_investigation",
        toStatus: status === "closed" ? "confirmed" : status,
        note: "Evidence photographs and geo-tagged report submitted.",
        createdAt: new Date(createdAt.getTime() + 1000 * 60 * 60 * 19),
      });
    }
    if (status === "closed") {
      events.push({
        incidentId: incident.id,
        actorId: districtOfficer.id,
        action: "Incident closed",
        fromStatus: "confirmed",
        toStatus: "closed",
        note: "Penalty realised and compliance confirmed by district office.",
        createdAt: new Date(createdAt.getTime() + 1000 * 60 * 60 * 40),
      });
    }
    await db.insert(incidentEvents).values(events);

    if (["confirmed", "unsubstantiated", "closed", "under_investigation"].includes(status) && fieldOfficer) {
      await db.insert(investigationReports).values({
        incidentId: incident.id,
        investigatorId: fieldOfficer.id,
        findings:
          status === "unsubstantiated"
            ? "No crop residue fire observed. Plume traced to a nearby brick kiln operating without a valid consent."
            : "Approximately one hectare of paddy residue was burnt in the reported survey number. Smoke plume visible from the village link road; no fire tender required.",
        causeClassification: status === "unsubstantiated" ? "Industrial / waste burning" : "Crop residue burning",
        areaBurnedHa: status === "unsubstantiated" ? 0 : Number((0.4 + rand() * 3.2).toFixed(2)),
        cropAffected: status === "unsubstantiated" ? "Non-agricultural" : "Paddy",
        evidenceUrls: [
          `https://evidence.firewatch.gov.in/${district.code.toLowerCase()}/${incident.reference}-1.jpg`,
          `https://evidence.firewatch.gov.in/${district.code.toLowerCase()}/${incident.reference}-2.jpg`,
        ],
        recommendation:
          status === "unsubstantiated"
            ? "Refer the kiln to the State Pollution Control Board for consent review."
            : "Recover environmental compensation from the landholder and flag the village for targeted awareness camps.",
        submittedAt: new Date(createdAt.getTime() + 1000 * 60 * 60 * 20),
      });
    }
  }

  const runRows = [];
  for (let i = 5; i >= 0; i -= 1) {
    const startedAt = new Date(today.getTime() - i * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);
    runRows.push({
      source: "VIIRS_NOAA20_NRT",
      bbox: "73.7,28.9,77.6,32.6",
      status: i === 3 ? "failed" : "success",
      fetched: i === 3 ? 0 : 120 + i * 11,
      inserted: i === 3 ? 0 : 108 + i * 9,
      duplicates: i === 3 ? 0 : 12 + i * 2,
      rejected: i === 3 ? 0 : i % 3,
      message:
        i === 3
          ? "NASA FIRMS API key not configured on the server. No detections were stored."
          : "Automated cron ingestion completed. Detections geofenced against district boundaries.",
      triggeredById: admin.id,
      startedAt,
      finishedAt: new Date(startedAt.getTime() + 1000 * 42),
    });
  }
  await db.insert(ingestRuns).values(runRows);
}

let seedPromise = null;

/**
 * Idempotent, cached bootstrap. Safe to call from any server component or route
 * handler; the heavy work runs once per process and only on an empty database.
 */
export async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seed().catch((error) => {
      seedPromise = null;
      console.error("[seed] failed", error);
    });
  }
  return seedPromise;
}

export async function geofenceCoordinates(rows) {
  const shapes = await db.select().from(districts);
  return rows.map((row) => {
    const district = resolveDistrict(shapes, row.latitude, row.longitude);
    return { ...row, districtId: district?.id ?? null };
  });
}
