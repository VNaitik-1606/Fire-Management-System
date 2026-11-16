import "server-only";
import { z } from "zod";
import { bboxOf, pointInPolygon } from "@/lib/geo";
import { getFirmsApiKey } from "@/lib/env";

export const FIRMS_SOURCES = [
  { id: "VIIRS_SNPP_NRT", label: "VIIRS Suomi-NPP (near real time)", sensor: "VIIRS" },
  { id: "VIIRS_NOAA20_NRT", label: "VIIRS NOAA-20 (near real time)", sensor: "VIIRS" },
  { id: "VIIRS_NOAA21_NRT", label: "VIIRS NOAA-21 (near real time)", sensor: "VIIRS" },
  { id: "MODIS_NRT", label: "MODIS Terra/Aqua (near real time)", sensor: "MODIS" },
];

export function firmsMapKey() {
  return getFirmsApiKey();
}

const rawRowSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  acq_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acq_time: z.string().min(1),
  confidence: z.string().optional().default(""),
  frp: z.coerce.number().min(0).max(20000).optional(),
  brightness: z.coerce.number().min(0).max(2000).optional(),
  bright_ti4: z.coerce.number().min(0).max(2000).optional(),
  bright_ti5: z.coerce.number().min(0).max(2000).optional(),
  satellite: z.string().optional().default(""),
  instrument: z.string().optional().default(""),
  daynight: z.string().optional().default(""),
  version: z.string().optional().default(""),
  type: z.string().optional().default(""),
});

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line) => {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  };
  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const record = {};
    header.forEach((key, i) => {
      record[key] = (cells[i] ?? "").trim();
    });
    return record;
  });
}

function normalizeConfidence(raw, sensor) {
  if (!raw) return { pct: null, label: null };
  if (/^[lnh]$/i.test(raw)) {
    const map = { l: 50, n: 75, h: 95 };
    return {
      pct: map[raw.toLowerCase()],
      label: raw.toLowerCase() === "n" ? "nominal" : raw.toLowerCase() === "h" ? "high" : "low",
    };
  }
  const num = Number(raw);
  if (Number.isFinite(num)) {
    return { pct: Math.round(num), label: `${sensor} numeric` };
  }
  return { pct: null, label: null };
}

export function buildDedupeKey(input) {
  return [
    input.source,
    input.satellite || "unknown",
    input.latitude.toFixed(4),
    input.longitude.toFixed(4),
    input.acqDate,
    input.acqTime,
  ].join("|");
}

/**
 * Calls the NASA FIRMS Area API. The API key is read from server env only and
 * never returned to the client. Rows are validated before normalization.
 */
export async function fetchFirmsArea(options) {
  const key = firmsMapKey();
  if (!key) {
    return {
      ok: false,
      missingKey: true,
      error:
        "FIRMS_API_KEY is not configured on the server. Set FIRMS_API_KEY in .env to enable live NASA ingestion.",
    };
  }
  const dayRange = Math.min(Math.max(options.dayRange, 1), 10);
  const bboxString = `${options.bbox.west},${options.bbox.south},${options.bbox.east},${options.bbox.north}`;
  const url =
    `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${options.source}/${bboxString}/${dayRange}` +
    (options.date ? `/${options.date}` : "");

  let response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25000) });
  } catch {
    return { ok: false, error: "Unable to reach the NASA FIRMS API. Upstream request timed out." };
  }
  if (!response.ok) {
    return { ok: false, error: `NASA FIRMS responded with HTTP ${response.status}.` };
  }
  const text = await response.text();
  if (!text.toLowerCase().startsWith("latitude") && !text.toLowerCase().includes("latitude,longitude")) {
    return { ok: false, error: text.slice(0, 220) || "Unexpected FIRMS response payload." };
  }
  const rows = parseCsv(text);
  const detections = [];
  let rejected = 0;

  for (const raw of rows) {
    const parsed = rawRowSchema.safeParse(raw);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    const row = parsed.data;
    const acqTime = row.acq_time.padStart(4, "0").slice(0, 4);
    const confidence = normalizeConfidence(row.confidence, options.source.startsWith("MODIS") ? "MODIS" : "VIIRS");
    const acquiredAt = new Date(`${row.acq_date}T${acqTime.slice(0, 2)}:${acqTime.slice(2, 4)}:00Z`);
    if (Number.isNaN(acquiredAt.getTime())) {
      rejected += 1;
      continue;
    }
    const satellite =
      row.satellite || (options.source.startsWith("MODIS") ? "Terra/Aqua" : options.source.replace(/_NRT$/, ""));
    detections.push({
      source: options.source,
      satellite,
      instrument: row.instrument || (options.source.startsWith("MODIS") ? "MODIS" : "VIIRS"),
      latitude: row.latitude,
      longitude: row.longitude,
      brightness: row.brightness ?? row.bright_ti4 ?? null,
      frp: row.frp ?? null,
      confidencePct: confidence.pct,
      confidenceLabel: confidence.label,
      acqDate: row.acq_date,
      acqTime,
      acquiredAt,
      dayNight: row.daynight || null,
      isSynthetic: false,
      payload: { ...raw, version: row.version, type: row.type, firms_source: options.source },
      dedupeKey: buildDedupeKey({
        source: options.source,
        latitude: row.latitude,
        longitude: row.longitude,
        acqDate: row.acq_date,
        acqTime,
        satellite,
      }),
    });
  }

  return { ok: true, detections, rejected, rawCount: rows.length };
}

/**
 * Explicitly labelled simulation used only when no FIRMS key is provisioned, so
 * the ingestion + geofencing workflow can be demonstrated end to end. Rows are
 * persisted with isSynthetic = true and a "simulated" satellite name.
 */
export function simulateDetections(districts, dayRange = 2) {
  if (districts.length === 0) return [];
  const out = [];
  let seed = 987654321;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return Math.abs(seed % 10000) / 10000;
  };
  const now = new Date();
  for (let d = 0; d < Math.min(dayRange, 3); d += 1) {
    for (const district of districts) {
      const box = bboxOf(district.geometry);
      let placed = 0;
      let attempts = 0;
      const target = 1 + Math.floor(rand() * 4);
      while (placed < target && attempts < 60) {
        attempts += 1;
        const lat = box.south + rand() * (box.north - box.south);
        const lng = box.west + rand() * (box.east - box.west);
        if (!pointInPolygon(district.geometry, lat, lng)) continue;
        placed += 1;
        const at = new Date(now.getTime() - d * 86400000 - Math.floor(rand() * 6) * 3600000);
        const acqDate = at.toISOString().slice(0, 10);
        const acqTime = `${String(at.getUTCHours()).padStart(2, "0")}${String(at.getUTCMinutes()).padStart(2, "0")}`;
        const satellite = "NOAA-20 (simulated)";
        const source = "DEMO_FIXTURE";
        const latitude = Number(lat.toFixed(4));
        const longitude = Number(lng.toFixed(4));
        const confidencePct = Math.round(50 + rand() * 49);
        out.push({
          source,
          satellite,
          instrument: "VIIRS",
          latitude,
          longitude,
          brightness: Number((300 + rand() * 45).toFixed(1)),
          frp: Number((2 + rand() * 55).toFixed(1)),
          confidencePct,
          confidenceLabel: confidencePct >= 80 ? "high" : "nominal",
          acqDate,
          acqTime,
          acquiredAt: at,
          dayNight: rand() > 0.6 ? "D" : "N",
          isSynthetic: true,
          payload: { note: "Simulated ingest — FIRMS_API_KEY not configured", district: district.code },
          dedupeKey: buildDedupeKey({ source, latitude, longitude, acqDate, acqTime, satellite }),
        });
      }
    }
  }
  return out;
}
