export function bboxOf(geometry) {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const ring of geometry.coordinates) {
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return { west, south, east, north };
}

export function bboxContains(bbox, lat, lng) {
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east;
}

/** Ray-casting point-in-polygon test (lng/lat in WGS84 degrees). */
export function pointInRing(ring, lat, lng) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(geometry, lat, lng) {
  const [outer, ...holes] = geometry.coordinates;
  if (!outer || !pointInRing(outer, lat, lng)) return false;
  return holes.every((hole) => !pointInRing(hole, lat, lng));
}

/**
 * Resolves the administrative district for a coordinate.
 * Returns null when the coordinate is outside every loaded boundary: we never
 * guess a jurisdiction for a satellite detection.
 */
export function resolveDistrict(districts, lat, lng) {
  for (const district of districts) {
    if (bboxContains(bboxOf(district.geometry), lat, lng) && pointInPolygon(district.geometry, lat, lng)) {
      return district;
    }
  }
  return null;
}

/** Great-circle distance in kilometres. */
export function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Rough polygon area in hectares (equirectangular approximation; boundary polygons are simplified). */
export function approximateAreaHa(geometry) {
  const ring = geometry.coordinates[0] ?? [];
  if (ring.length < 3) return 0;
  const latRef = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((latRef * Math.PI) / 180);
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * mPerDegLng * (ring[i][1] * mPerDegLat) - ring[i][0] * mPerDegLng * (ring[j][1] * mPerDegLat);
  }
  return Math.abs(area / 2) / 10000;
}

export function rectangle(lat, lng, dLat, dLng) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng - dLng, lat - dLat],
        [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat],
        [lng - dLng, lat + dLat],
        [lng - dLng, lat - dLat],
      ],
    ],
  };
}

export const STUDY_AREA = { west: 73.7, south: 28.9, east: 77.6, north: 32.6 };

export function bboxToString(bbox) {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}
