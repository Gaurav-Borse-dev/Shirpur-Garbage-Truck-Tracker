/**
 * NavigationMap — the core MapLibre GL JS map component.
 *
 * Creates a single stable map instance that persists across React renders.
 * All child layers (trucks, routes, resident) update via imperative GeoJSON
 * source.setData() calls — never by recreating layers or sources.
 *
 * Modes: resident | driver | admin
 */
import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { buildNavStyle, MAP_COLORS } from "./map-style";
import { registerTruckSprites, truckImageName } from "./truck-sprite";
import { useTrucks, type LiveTruck } from "@/store/trucks";
import { haversine, type LatLng } from "@/lib/geo";
import { SHIRPUR } from "@/lib/trucks";

// ── Map context ──

const MapContext = createContext<MaplibreMap | null>(null);
export function useMapInstance() {
  return useContext(MapContext);
}

// ── Types ──

type ResidentMapProps = {
  mode: "resident";
  resident: LatLng;
  radius: number;
  activeTruckId?: string;
};
type DriverMapProps = {
  mode: "driver";
  truckId: string;
};
type AdminMapProps = {
  mode: "admin";
  highlightId?: string;
  showRoutes?: boolean;
  onTruckClick?: (id: string) => void;
};
type Props = (ResidentMapProps | DriverMapProps | AdminMapProps) & { children?: ReactNode };

// ── Constants ──

const SHIRPUR_CENTER: [number, number] = [SHIRPUR.lng, SHIRPUR.lat];
const DEFAULT_ZOOM: Record<string, number> = { resident: 15, driver: 16, admin: 13 };
const DRIVER_PITCH = 50;
const FOLLOW_DURATION = 1200;
const CAMERA_THROTTLE_MS = 800;

// ── Component ──

export function NavigationMap(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const followEnabledRef = useRef(true);
  const lastCameraUpdateRef = useRef(0);
  const prevTruckDataRef = useRef<string>("");

  // Truck store
  const trucks = useTrucks((s) => s.trucks);
  const truckList = useMemo(() => Object.values(trucks), [trucks]);

  // Determine the initial center
  const initialCenter = useMemo((): [number, number] => {
    if (props.mode === "resident") return [props.resident.lng, props.resident.lat];
    if (props.mode === "driver") {
      const t = trucks[props.truckId];
      return t ? [t.position.lng, t.position.lat] : SHIRPUR_CENTER;
    }
    return SHIRPUR_CENTER;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialize map ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: buildNavStyle(),
        center: initialCenter,
        zoom: DEFAULT_ZOOM[props.mode],
        pitch: props.mode === "driver" ? DRIVER_PITCH : 0,
        bearing: 0,
        attributionControl: false,
        antialias: true,
        maxZoom: 19,
        minZoom: 8,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-left",
      );

      map.on("load", () => {
        registerTruckSprites(map);
        initSources(map);
        setMapReady(true);
      });

      map.on("error", (e) => {
        console.error("[map] MapLibre error:", e.error);
        setMapError("Map failed to load. Check your connection.");
      });

      // Disable follow on user interaction
      map.on("dragstart", () => { followEnabledRef.current = false; });

      mapRef.current = map;
    } catch (err) {
      console.error("[map] Failed to create map:", err);
      setMapError("Map engine unavailable.");
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update trucks GeoJSON source ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const activeTruckId =
      props.mode === "driver"
        ? props.truckId
        : props.mode === "admin"
          ? props.highlightId
          : props.activeTruckId ?? findNearest(truckList, props.mode === "resident" ? props.resident : null);

    const geojson = trucksToGeoJSON(truckList, activeTruckId);
    const dataStr = JSON.stringify(geojson);
    if (dataStr === prevTruckDataRef.current) return;
    prevTruckDataRef.current = dataStr;

    const source = map.getSource("trucks") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }

    // Update route for active truck
    const activeTruck = activeTruckId ? trucks[activeTruckId] : undefined;
    updateRoute(map, activeTruck);

    // Update resident location
    if (props.mode === "resident") {
      updateResident(map, props.resident, props.radius);
    }
  }, [truckList, mapReady, trucks, props]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Camera follow ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !followEnabledRef.current) return;

    const now = Date.now();
    if (now - lastCameraUpdateRef.current < CAMERA_THROTTLE_MS) return;
    lastCameraUpdateRef.current = now;

    if (props.mode === "driver") {
      const t = trucks[props.truckId];
      if (!t) return;
      map.easeTo({
        center: [t.position.lng, t.position.lat],
        bearing: t.bearing,
        pitch: DRIVER_PITCH,
        zoom: map.getZoom(),
        duration: FOLLOW_DURATION,
        // Offset truck to lower 1/3 of viewport
        offset: [0, -map.getCanvas().height / 6],
      });
    } else if (props.mode === "resident") {
      // Don't aggressively follow in resident mode — only when activeTruckId changes
    } else if (props.mode === "admin" && props.highlightId) {
      const t = trucks[props.highlightId];
      if (t) {
        map.easeTo({
          center: [t.position.lng, t.position.lat],
          zoom: 16,
          duration: FOLLOW_DURATION,
        });
      }
    }
  }, [trucks, mapReady, props]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recenter button handler ──
  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    followEnabledRef.current = true;

    if (props.mode === "driver") {
      const t = trucks[props.truckId];
      if (t) {
        map.easeTo({
          center: [t.position.lng, t.position.lat],
          bearing: t.bearing,
          pitch: DRIVER_PITCH,
          zoom: 16,
          duration: 800,
          offset: [0, -map.getCanvas().height / 6],
        });
      }
    } else if (props.mode === "resident") {
      map.easeTo({
        center: [props.resident.lng, props.resident.lat],
        bearing: 0,
        pitch: 0,
        zoom: 15,
        duration: 800,
      });
    } else {
      map.easeTo({
        center: SHIRPUR_CENTER,
        bearing: 0,
        pitch: 0,
        zoom: 13,
        duration: 800,
      });
    }
  }, [props, trucks]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin click handler ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || props.mode !== "admin" || !props.onTruckClick) return;

    const handler = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["trucks-layer"] });
      if (features.length > 0 && features[0].properties) {
        const id = features[0].properties["truckId"] as string;
        if (id) props.onTruckClick!(id);
      }
    };

    map.on("click", "trucks-layer", handler);
    map.on("mouseenter", "trucks-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "trucks-layer", () => { map.getCanvas().style.cursor = ""; });

    return () => {
      map.off("click", "trucks-layer", handler);
    };
  }, [mapReady, props]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──
  if (mapError) {
    return (
      <div className="ct-map-error">
        <div className="ct-map-error-icon">⚠</div>
        <div className="ct-map-error-text">{mapError}</div>
        <button className="ct-map-error-retry" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }} className="ct-navigation-map">
      {mapReady && mapRef.current && (
        <MapContext.Provider value={mapRef.current}>
          {/* Floating controls */}
          <MapControls mode={props.mode} onRecenter={recenter} />
          {/* Speed badge for driver */}
          {props.mode === "driver" && <SpeedBadge truckId={props.truckId} />}
          {/* Driver nav panels */}
          {props.mode === "driver" && <DriverTopPanel truckId={props.truckId} />}
          {props.mode === "driver" && <DriverBottomPanel truckId={props.truckId} />}
          {props.children}
        </MapContext.Provider>
      )}
      {!mapReady && !mapError && (
        <div className="ct-map-loading">
          <div className="ct-map-loading-spinner" />
          <div>Loading map…</div>
        </div>
      )}
    </div>
  );
}

// ── GeoJSON helpers ──

function initSources(map: MaplibreMap) {
  const emptyFC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  const emptyLine: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [] },
    properties: {},
  };

  // Trucks source + layer
  map.addSource("trucks", { type: "geojson", data: emptyFC });
  map.addLayer({
    id: "trucks-layer",
    type: "symbol",
    source: "trucks",
    layout: {
      "icon-image": ["get", "icon"],
      "icon-size": ["case", ["==", ["get", "active"], true], 0.7, 0.5],
      "icon-rotate": ["get", "heading"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });

  // Route casing
  map.addSource("route", { type: "geojson", data: emptyLine });
  map.addLayer(
    {
      id: "route-casing",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": MAP_COLORS.routeCasing,
        "line-width": 10,
        "line-opacity": 0.25,
      },
    },
    "trucks-layer",
  );
  // Route fill
  map.addLayer(
    {
      id: "route-fill",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": MAP_COLORS.routeFill,
        "line-width": 6,
        "line-opacity": 0.9,
      },
    },
    "trucks-layer",
  );

  // Resident location source
  map.addSource("resident", { type: "geojson", data: emptyFC });
  // Accuracy circle
  map.addLayer(
    {
      id: "resident-accuracy",
      type: "fill",
      source: "resident",
      filter: ["==", ["get", "type"], "accuracy"],
      paint: {
        "fill-color": MAP_COLORS.resident,
        "fill-opacity": 0.1,
      },
    },
    "route-casing",
  );
  // Resident dot glow
  map.addLayer({
    id: "resident-glow",
    type: "circle",
    source: "resident",
    filter: ["==", ["get", "type"], "dot"],
    paint: {
      "circle-radius": 16,
      "circle-color": MAP_COLORS.residentGlow,
      "circle-opacity": 0.6,
    },
  });
  // Resident dot
  map.addLayer({
    id: "resident-dot",
    type: "circle",
    source: "resident",
    filter: ["==", ["get", "type"], "dot"],
    paint: {
      "circle-radius": 7,
      "circle-color": MAP_COLORS.resident,
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });
}

function trucksToGeoJSON(
  trucks: LiveTruck[],
  activeId?: string,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trucks.map((t) => {
      const isActive = t.id === activeId;
      const isOffline = t.status === "offline";
      const iconVariant = isActive ? "active" : isOffline ? "offline" : "online";
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [t.position.lng, t.position.lat],
        },
        properties: {
          truckId: t.id,
          icon: truckImageName(iconVariant),
          heading: t.bearing,
          status: t.status,
          active: isActive,
          driverName: t.truck.driverName,
          wardName: t.truck.wardName,
          completedStops: t.completedStops,
          totalStops: t.truck.totalStops,
        },
      };
    }),
  };
}

function updateRoute(map: MaplibreMap, truck?: LiveTruck) {
  const source = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
  if (!source) return;

  if (!truck || truck.truck.route.length === 0) {
    source.setData({ type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} });
    return;
  }

  const coords = (truck.path ?? truck.truck.route).map((p) => [p.lng, p.lat]);
  source.setData({
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: {},
  });
}

function updateResident(map: MaplibreMap, resident: LatLng, radius: number) {
  const source = map.getSource("resident") as maplibregl.GeoJSONSource | undefined;
  if (!source) return;

  // Create accuracy circle as a polygon
  const steps = 48;
  const coords: [number, number][] = [];
  const radiusDeg = radius / 111320; // approximate degrees
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    coords.push([
      resident.lng + radiusDeg * Math.cos(angle) / Math.cos(resident.lat * Math.PI / 180),
      resident.lat + radiusDeg * Math.sin(angle),
    ]);
  }

  source.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: { type: "accuracy" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [resident.lng, resident.lat] },
        properties: { type: "dot" },
      },
    ],
  });
}

function findNearest(trucks: LiveTruck[], resident: LatLng | null): string | undefined {
  if (!resident) return undefined;
  const online = trucks.filter((t) => t.status !== "offline");
  if (online.length === 0) return trucks[0]?.id;
  return online.reduce((best, cur) =>
    haversine(cur.position, resident) < haversine(best.position, resident) ? cur : best,
  ).id;
}

// ── Inline sub-components ──

function MapControls({ mode, onRecenter }: { mode: string; onRecenter: () => void }) {
  const map = useMapInstance();

  return (
    <div className="ct-map-controls">
      <button
        className="ct-map-control-btn"
        aria-label="Zoom in"
        onClick={() => map?.zoomIn({ duration: 300 })}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        className="ct-map-control-btn"
        aria-label="Zoom out"
        onClick={() => map?.zoomOut({ duration: 300 })}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <div className="ct-map-control-divider" />
      <button className="ct-map-control-btn" aria-label="Recenter" onClick={onRecenter}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
      {mode !== "admin" && (
        <button
          className="ct-map-control-btn"
          aria-label="Reset north"
          onClick={() => map?.easeTo({ bearing: 0, pitch: 0, duration: 500 })}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="12,2 20,20 12,16 4,20" fill="none" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SpeedBadge({ truckId }: { truckId: string }) {
  const truck = useTrucks((s) => s.trucks[truckId]);
  if (!truck || truck.status === "offline") return null;
  // Speed comes from real GPS data — truck.speed (km/h)
  const speed = Math.round(truck.speed ?? 0);
  if (speed <= 0) return null;

  return (
    <div className="ct-speed-badge">
      <div className="ct-speed-value">{speed}</div>
      <div className="ct-speed-unit">km/h</div>
    </div>
  );
}

function DriverTopPanel({ truckId }: { truckId: string }) {
  const truck = useTrucks((s) => s.trucks[truckId]);
  if (!truck) return null;
  const stopNum = Math.min(truck.completedStops + 1, truck.truck.totalStops);

  return (
    <div className="ct-driver-top-panel">
      <div className="ct-driver-top-label">NEXT STOP</div>
      <div className="ct-driver-top-ward">{truck.truck.wardName}</div>
      <div className="ct-driver-top-point">Collection Point #{stopNum}</div>
    </div>
  );
}

function DriverBottomPanel({ truckId }: { truckId: string }) {
  const truck = useTrucks((s) => s.trucks[truckId]);
  if (!truck) return null;
  const stopNum = Math.min(truck.completedStops + 1, truck.truck.totalStops);
  const progress = Math.round((truck.completedStops / truck.truck.totalStops) * 100);

  return (
    <div className="ct-driver-bottom-panel">
      <div className="ct-driver-bottom-stats">
        <div className="ct-driver-bottom-stat">
          <span className="ct-driver-bottom-stat-value">{stopNum}</span>
          <span className="ct-driver-bottom-stat-label">Next stop</span>
        </div>
        <div className="ct-driver-bottom-divider" />
        <div className="ct-driver-bottom-stat">
          <span className="ct-driver-bottom-stat-value">{progress}%</span>
          <span className="ct-driver-bottom-stat-label">Complete</span>
        </div>
      </div>
      <div className="ct-driver-bottom-progress">
        <div className="ct-driver-bottom-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="ct-driver-bottom-route">{truck.truck.wardName}</div>
    </div>
  );
}
