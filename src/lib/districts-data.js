/**
 * Simplified administrative boundaries for the pilot region (Punjab + Haryana).
 * Deliberately stored as polygons so the geofencing service is data-driven:
 * production boundary datasets can replace these rows without code changes.
 */
export const DISTRICT_SEEDS = [
  { code: "PB-AMR", name: "Amritsar", state: "Punjab", centerLat: 31.64, centerLng: 74.87, dLat: 0.42, dLng: 0.38, weight: 1.1 },
  { code: "PB-JAL", name: "Jalandhar", state: "Punjab", centerLat: 31.33, centerLng: 75.58, dLat: 0.3, dLng: 0.3, weight: 0.9 },
  { code: "PB-LDH", name: "Ludhiana", state: "Punjab", centerLat: 30.9, centerLng: 75.85, dLat: 0.42, dLng: 0.4, weight: 1.8 },
  { code: "PB-PAT", name: "Patiala", state: "Punjab", centerLat: 30.34, centerLng: 76.39, dLat: 0.4, dLng: 0.38, weight: 1.6 },
  { code: "PB-SGR", name: "Sangrur", state: "Punjab", centerLat: 30.25, centerLng: 75.84, dLat: 0.36, dLng: 0.36, weight: 1.7 },
  { code: "PB-BTI", name: "Bathinda", state: "Punjab", centerLat: 30.21, centerLng: 74.95, dLat: 0.42, dLng: 0.38, weight: 1.3 },
  { code: "PB-FZR", name: "Firozpur", state: "Punjab", centerLat: 30.93, centerLng: 74.61, dLat: 0.4, dLng: 0.36, weight: 1.2 },
  { code: "PB-MOG", name: "Moga", state: "Punjab", centerLat: 30.82, centerLng: 75.17, dLat: 0.28, dLng: 0.26, weight: 1.0 },
  { code: "HR-KNL", name: "Karnal", state: "Haryana", centerLat: 29.69, centerLng: 76.99, dLat: 0.34, dLng: 0.32, weight: 1.5 },
  { code: "HR-KKR", name: "Kurukshetra", state: "Haryana", centerLat: 29.97, centerLng: 76.88, dLat: 0.28, dLng: 0.26, weight: 1.2 },
  { code: "HR-SIR", name: "Sirsa", state: "Haryana", centerLat: 29.53, centerLng: 75.03, dLat: 0.44, dLng: 0.42, weight: 1.4 },
  { code: "HR-HSR", name: "Hisar", state: "Haryana", centerLat: 29.15, centerLng: 75.72, dLat: 0.42, dLng: 0.4, weight: 1.1 },
  { code: "HR-FTB", name: "Fatehabad", state: "Haryana", centerLat: 29.51, centerLng: 75.45, dLat: 0.28, dLng: 0.24, weight: 1.0 },
  { code: "HR-KTL", name: "Kaithal", state: "Haryana", centerLat: 29.8, centerLng: 76.4, dLat: 0.3, dLng: 0.26, weight: 1.3 },
];

/**
 * Builds an irregular closed polygon around a centre point. The jitter is
 * deterministic per district code so boundaries stay stable across seeds.
 */
export function buildDistrictPolygon(seed) {
  let h = 2166136261;
  for (const ch of seed.code) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const steps = 12;
  const ring = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const scale = 0.82 + rand() * 0.36;
    const lng = seed.centerLng + Math.cos(angle) * seed.dLng * scale;
    const lat = seed.centerLat + Math.sin(angle) * seed.dLat * scale;
    ring.push([Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
  }
  ring.push([...ring[0]]);
  return { type: "Polygon", coordinates: [ring] };
}

export const PILOT_REGION_LABEL = "Punjab & Haryana";
