"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { daysAgo, isoDate, formatDateTime, formatNumber, statusMeta } from "@/lib/constants";
import { LayersIcon, PlusIcon, RefreshIcon } from "@/components/icons";

const BASEMAP_STYLE = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO · Fires: NASA FIRMS (demo fixtures) · Imagery: NASA GIBS",
    },
  },
  layers: [{ id: "carto-base", type: "raster", source: "carto", minzoom: 0, maxzoom: 20 }],
};

const EMPTY_FC = { type: "FeatureCollection", features: [] };

export default function FireMap({ districts, canRaiseIncident, compact = false, focus = null }) {
  const router = useRouter();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [featureCount, setFeatureCount] = useState(0);
  const [syntheticCount, setSyntheticCount] = useState(0);

  const [districtId, setDistrictId] = useState("all");
  const [from, setFrom] = useState(isoDate(daysAgo(7)));
  const [to, setTo] = useState(isoDate(new Date()));
  const [minConfidence, setMinConfidence] = useState("0");
  const [linked, setLinked] = useState("all");
  const [imagery, setImagery] = useState(false);
  const [imageryDate, setImageryDate] = useState(isoDate(daysAgo(1)));

  const hasImageryDate = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(imageryDate), [imageryDate]);

  const buildGeoJson = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format: "geojson", from, to, limit: "900" });
      if (districtId !== "all") params.set("districtId", districtId);
      if (Number(minConfidence) > 0) params.set("minConfidence", minConfidence);
      if (linked !== "all") params.set("linked", linked);
      const response = await fetch(`/api/observations?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load detections");
      setFeatureCount(payload.features?.length ?? 0);
      setSyntheticCount(payload.meta?.synthetic ?? 0);
      const map = mapRef.current;
      const source = map?.getSource("fires");
      if (source) source.setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load detections");
    } finally {
      setLoading(false);
    }
  }, [from, to, districtId, minConfidence, linked]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: focus ? [focus.longitude, focus.latitude] : [75.9, 30.6],
        zoom: focus ? 11 : compact ? 6.2 : 6.8,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      if (!compact) map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
      if (focus) {
        new maplibregl.Marker({ color: "#fb923c" }).setLngLat([focus.longitude, focus.latitude]).addTo(map);
      }

      map.on("load", () => {
        if (cancelled) return;

        map.addSource("districts", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: districts.map((d) => ({
              type: "Feature",
              properties: { name: `${d.name}, ${d.state}`, code: d.code },
              geometry: d.geometry,
            })),
          },
        });
        map.addLayer({
          id: "district-fill",
          type: "fill",
          source: "districts",
          paint: { "fill-color": "#38bdf8", "fill-opacity": 0.03 },
        });
        map.addLayer({
          id: "district-outline",
          type: "line",
          source: "districts",
          paint: { "line-color": "#38bdf8", "line-opacity": 0.28, "line-width": 1, "line-dasharray": [2, 2] },
        });
        map.addSource("fires", { type: "geojson", data: EMPTY_FC, cluster: true, clusterRadius: 38, clusterMaxZoom: 9 });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "fires",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": ["step", ["get", "point_count"], "#f59e0b", 10, "#fb923c", 30, "#ef4444"],
            "circle-opacity": 0.32,
            "circle-stroke-color": ["step", ["get", "point_count"], "#fbbf24", 10, "#fdba74", 30, "#fca5a5"],
            "circle-stroke-width": 1.2,
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "fires",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 10, "text-font": ["Open Sans Regular"] },
          paint: { "text-color": "#fff7ed" },
        });
        map.addLayer({
          id: "fire-glow",
          type: "circle",
          source: "fires",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#fb923c",
            "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 0, 7, 70, 16],
            "circle-opacity": 0.14,
            "circle-blur": 1,
          },
        });
        map.addLayer({
          id: "fire-points",
          type: "circle",
          source: "fires",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "incidentStatus"], "confirmed"],
              "#fb923c",
              ["==", ["get", "incidentStatus"], "closed"],
              "#34d399",
              ["!=", ["coalesce", ["get", "incidentStatus"], ""], ""],
              "#38bdf8",
              ["get", "synthetic"],
              "#f59e0b",
              "#ef4444",
            ],
            "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 0, 3.2, 40, 6, 70, 8],
            "circle-stroke-width": 1,
            "circle-stroke-color": "rgba(5,8,14,0.85)",
          },
        });

        map.on("click", "clusters", async (event) => {
          const feature = map.queryRenderedFeatures(event.point, { layers: ["clusters"] })[0];
          const clusterId = feature.properties?.cluster_id;
          const source = map.getSource("fires");
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: feature.geometry.coordinates, zoom: zoom + 0.4 });
        });

        map.on("click", "fire-points", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const coords = feature.geometry.coordinates;
          const props = feature.properties;
          setSelected({ ...props, longitude: coords[0], latitude: coords[1] });
          setCreateError(null);
        });

        map.on("mouseenter", "fire-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "fire-points", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "clusters", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "clusters", () => {
          map.getCanvas().style.cursor = "";
        });

        loadedRef.current = true;
        setReady(true);
        void buildGeoJson();
      });

      return map;
    }
    void init();
    return () => {
      cancelled = true;
      loadedRef.current = false;
      setReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts]);

  const changeDistrict = (value) => setDistrictId(value);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (districtId === "all") return;
    const district = districts.find((d) => String(d.id) === districtId);
    if (district) map.easeTo({ center: [district.centerLng, district.centerLat], zoom: 8.2 });
  }, [districtId, districts, ready]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    if (imagery && hasImageryDate) {
      const sourceId = "gibs-overlay";
      const tiles = [
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${imageryDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      ];
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: "raster", tiles, tileSize: 256, maxzoom: 9, attribution: "NASA GIBS / VIIRS" });
        map.addLayer({ id: sourceId, type: "raster", source: sourceId, paint: { "raster-opacity": 0.78 } }, "district-fill");
      } else {
        map.getSource(sourceId).setTiles(tiles);
      }
    } else if (map.getLayer("gibs-overlay")) {
      map.removeLayer("gibs-overlay");
      if (map.getSource("gibs-overlay")) map.removeSource("gibs-overlay");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagery, imageryDate, ready]);

  async function raiseIncident() {
    if (!selected) return;
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observationId: selected.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setCreateError(payload.error ?? "Unable to raise incident");
        setCreating(false);
        return;
      }
      setSelected(null);
      await buildGeoJson();
      router.push(`/incidents/${payload.incident.id}`);
    } catch {
      setCreateError("Network error while raising incident");
    } finally {
      setCreating(false);
    }
  }

  const selectClass =
    "w-full rounded-md border border-white/10 bg-[#080d16] px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-orange-400/60";

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#070b12]">
      <div className="absolute left-3 top-3 z-10 w-[188px] space-y-2 rounded-lg border border-white/10 bg-[#05080e]/90 p-2.5 backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Detection filters</p>
          <button type="button" onClick={() => void buildGeoJson()} className="text-slate-400 transition hover:text-orange-300" title="Refresh">
            <RefreshIcon width={13} height={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div>
          <label className="mb-1 block text-[9.5px] uppercase tracking-wider text-slate-500">District</label>
          <select value={districtId} onChange={(e) => changeDistrict(e.target.value)} className={selectClass}>
            <option value="all">All districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="mb-1 block text-[9.5px] uppercase tracking-wider text-slate-500">From</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={selectClass} />
          </div>
          <div>
            <label className="mb-1 block text-[9.5px] uppercase tracking-wider text-slate-500">To</label>
            <input type="date" value={to} min={from} max={isoDate(new Date())} onChange={(e) => setTo(e.target.value)} className={selectClass} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[9.5px] uppercase tracking-wider text-slate-500">Min confidence ({minConfidence}%)</label>
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
            className="w-full accent-orange-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-[9.5px] uppercase tracking-wider text-slate-500">Case linkage</label>
          <select value={linked} onChange={(e) => setLinked(e.target.value)} className={selectClass}>
            <option value="all">All detections</option>
            <option value="unlinked">Unlinked only</option>
            <option value="linked">Linked to incident</option>
          </select>
        </div>
        <button type="button" onClick={() => void buildGeoJson()} className="btn btn-sm w-full">
          Apply to map
        </button>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400">
            <LayersIcon width={11} height={11} /> GIBS imagery
          </span>
          <button
            type="button"
            onClick={() => setImagery((v) => !v)}
            className={`relative h-4 w-8 rounded-full transition ${imagery ? "bg-orange-500/70" : "bg-white/15"}`}
            aria-label="Toggle NASA GIBS imagery"
          >
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${imagery ? "left-4" : "left-0.5"}`} />
          </button>
        </div>
        {imagery ? (
          <input type="date" value={imageryDate} max={isoDate(new Date())} onChange={(e) => setImageryDate(e.target.value)} className={selectClass} />
        ) : null}
      </div>

      <div ref={containerRef} className={compact ? "h-[360px] w-full" : "h-[calc(100vh-190px)] min-h-[520px] w-full"} />

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#05080e]/85 px-2.5 py-2 text-[9.5px] uppercase tracking-wider text-slate-400 backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Unlinked detection
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-400" /> Case open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-400" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Closed
        </span>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md border border-white/10 bg-[#05080e]/85 px-2 py-1 font-mono text-[10px] text-slate-400 backdrop-blur">
        {loading ? "loading detections…" : `${formatNumber(featureCount)} detections · ${formatNumber(syntheticCount)} fixture`}
      </div>

      {error ? (
        <div className="absolute inset-x-4 top-16 z-10 rounded-md border border-rose-500/30 bg-rose-950/80 px-3 py-2 text-[11px] text-rose-200">
          {error}
        </div>
      ) : null}

      {selected ? (
        <div className="absolute bottom-3 right-3 z-10 w-[292px] rounded-xl border border-white/12 bg-[#0b111c]/97 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="eyebrow">Satellite detection · #{selected.id}</p>
              <p className="mt-0.5 text-[13px] font-semibold text-slate-100">
                {selected.district ?? "Outside mapped boundary"}
                {selected.districtCode ? <span className="ml-1 font-mono text-[10px] text-slate-500">{selected.districtCode}</span> : null}
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-200" aria-label="Close">
              ✕
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <span className="text-slate-500">Confidence</span>
            <span className="text-right font-mono text-slate-200">{selected.confidence ?? "—"}%</span>
            <span className="text-slate-500">FRP</span>
            <span className="text-right font-mono text-orange-300">{selected.frp ?? "—"} MW</span>
            <span className="text-slate-500">Acquired</span>
            <span className="text-right font-mono text-slate-300">
              {selected.acqDate} {selected.acqTime?.slice(0, 2)}:{selected.acqTime?.slice(2)}
            </span>
            <span className="text-slate-500">Platform</span>
            <span className="text-right text-slate-300">{selected.satellite ?? selected.source}</span>
            <span className="text-slate-500">Coordinates</span>
            <span className="text-right font-mono text-slate-300">
              {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
            </span>
          </div>
          <p className="mt-2 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 text-[10px] leading-relaxed text-slate-500">
            A thermal anomaly is <span className="text-slate-300">not</span> evidence of crop burning. Classification requires field verification.
          </p>
          {selected.incidentId ? (
            <a href={`/incidents/${selected.incidentId}`} className="btn btn-sm mt-2 w-full justify-between">
              <span>{selected.incidentRef}</span>
              <span className="text-[10px] text-slate-400">{statusMeta(selected.incidentStatus ?? "suspected").label} →</span>
            </a>
          ) : canRaiseIncident ? (
            <>
              <button type="button" onClick={() => void raiseIncident()} disabled={creating} className="btn btn-primary btn-sm mt-2 w-full">
                <PlusIcon width={12} height={12} /> {creating ? "Raising incident…" : "Raise investigation incident"}
              </button>
              {createError ? <p className="mt-1.5 text-[10px] text-rose-300">{createError}</p> : null}
            </>
          ) : (
            <p className="mt-2 text-[10px] text-slate-500">Your role cannot raise incidents.</p>
          )}
          <p className="mt-2 flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-slate-600">
            <span className={`h-1.5 w-1.5 rounded-full ${selected.synthetic ? "bg-amber-400" : "bg-emerald-400"}`} />
            {selected.synthetic ? "Simulated fixture row" : `Live source · ${selected.source}`}
          </p>
        </div>
      ) : null}

      {focus && ready ? (
        <div className="pointer-events-none absolute right-3 bottom-16 z-10 rounded border border-orange-500/40 bg-[#05080e]/90 px-2 py-1 font-mono text-[10px] text-orange-200">
          {focus.reference ?? "Incident location"} · {focus.latitude.toFixed(4)}, {focus.longitude.toFixed(4)}
        </div>
      ) : null}
      {compact ? null : (
        <p className="pointer-events-none absolute bottom-3 right-3 z-10 hidden text-[9.5px] text-slate-600 lg:block">
          Last filter refresh: {formatDateTime(new Date())} IST
        </p>
      )}
    </div>
  );
}
