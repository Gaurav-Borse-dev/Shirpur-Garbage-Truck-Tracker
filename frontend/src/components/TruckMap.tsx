import { MapContainer, Marker, Polyline, Circle, useMap, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { memo, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useTrucks, startSimulation, type LiveTruck } from "@/store/trucks";
import type { LatLng } from "@/lib/geo";
import { haversine } from "@/lib/geo";
import { bumpRender } from "@/store/perf";
import { formatEta, formatDistance } from "@/lib/format";
import { useI18n } from "@/store/i18n";
import { translate } from "@/lib/i18n";
import { SHIRPUR } from "@/lib/trucks";

// ── High-Quality Map Tile Layer Definitions ──
// Google Hybrid — Ultra-crisp satellite imagery with all roads, narrow galis, lanes & street labels
// Zero watermarks, no API keys needed, full detail for Shirpur down to zoom 20
const TILE_HYBRID = {
  url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  subdomains: "0123",
  maxZoom: 20,
  maxNativeZoom: 20,
  attr: '&copy; <a href="https://maps.google.com">Google Maps</a>',
};

// Google Satellite — Pure satellite imagery (real buildings, terrain, fields, water bodies)
const TILE_SATELLITE = {
  url: "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  subdomains: "0123",
  maxZoom: 20,
  maxNativeZoom: 20,
  attr: '&copy; <a href="https://maps.google.com">Google Maps</a>',
};

// Google Streets — Clear high-contrast street map with all tiny roads, alleys, and landmarks
const TILE_STREETS = {
  url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  subdomains: "0123",
  maxZoom: 20,
  maxNativeZoom: 20,
  attr: '&copy; <a href="https://maps.google.com">Google Maps</a>',
};

type MapStyle = "satellite" | "hybrid" | "streets";
const MAP_STYLE_OPTIONS: { id: MapStyle; icon: string; label: string }[] = [
  { id: "satellite", icon: "🛰", label: "Satellite" },
  { id: "hybrid",    icon: "🛰", label: "Satellite + Labels" },
  { id: "streets",   icon: "🗺", label: "Streets" },
];

/** Compact map-style switcher rendered as a Leaflet-aware overlay */
function MapLayerSwitcher() {
  const [style, setStyle] = useState<MapStyle>("hybrid");
  const [open, setOpen] = useState(false);
  const map = useMap();
  const currentLayerRef = useRef<L.TileLayer | null>(null);

  const getTileConfig = useCallback((s: MapStyle) => {
    switch (s) {
      case "satellite":
        return TILE_SATELLITE;
      case "streets":
        return TILE_STREETS;
      case "hybrid":
      default:
        return TILE_HYBRID;
    }
  }, []);

  const applyStyle = useCallback(
    (s: MapStyle) => {
      if (currentLayerRef.current) {
        map.removeLayer(currentLayerRef.current);
      }
      const cfg = getTileConfig(s);
      const layer = L.tileLayer(cfg.url, {
        attribution: cfg.attr,
        subdomains: cfg.subdomains,
        maxZoom: cfg.maxZoom,
        maxNativeZoom: cfg.maxNativeZoom,
      });
      layer.addTo(map);
      currentLayerRef.current = layer;
      setStyle(s);
      setOpen(false);
    },
    [map, getTileConfig],
  );

  // Initialize default "hybrid" (Satellite + Labels) layer on mount
  useEffect(() => {
    const cfg = TILE_HYBRID;
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attr,
      subdomains: cfg.subdomains,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.maxNativeZoom,
    });
    layer.addTo(map);
    currentLayerRef.current = layer;

    return () => {
      if (currentLayerRef.current) {
        map.removeLayer(currentLayerRef.current);
      }
    };
  }, [map]);


  return (
    <div className="ct-layer-switcher">
      <button
        className="ct-layer-switcher-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change map style"
        title="Map layers"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 22 8.5 12 15 2 8.5" />
          <polyline points="2 15.5 12 22 22 15.5" />
        </svg>
      </button>
      {open && (
        <div className="ct-layer-switcher-menu">
          {MAP_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={`ct-layer-switcher-option${style === opt.id ? " active" : ""}`}
              onClick={() => applyStyle(opt.id)}
            >
              <span className="ct-layer-switcher-icon">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Top-down navigation garbage-tipper truck SVG with direction cone & headlights.
 * Orientation: NORTH (0°) -> rotated by vehicle compass bearing.
 */
function navigationTruckSvgHTML(active = false, offline = false): string {
  const bodyColor = offline ? "#64748B" : "#22C55E";
  const bodyDark = offline ? "#475569" : "#16A34A";
  const cabColor = "#FFFFFF";
  const accentColor = active ? "#3B82F6" : bodyColor;

  return `
<div class="ct-nav-truck-container" style="position:relative;width:100%;height:100%;">
  <!-- Headlight beam / direction cone -->
  ${
    active && !offline
      ? `<div class="ct-headlight-beam"></div>`
      : ""
  }
  <svg viewBox="0 0 44 64" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;overflow:visible">
    <!-- Outer glow / drop shadow -->
    <filter id="truck-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.3"/>
    </filter>

    <g filter="url(#truck-shadow)">
      <!-- Rear & Front Heavy Duty Tires -->
      <rect x="1"  y="40" width="7" height="13" rx="2.5" fill="#0F172A"/>
      <rect x="36" y="40" width="7" height="13" rx="2.5" fill="#0F172A"/>
      <rect x="1"  y="14" width="7" height="11" rx="2.5" fill="#0F172A"/>
      <rect x="36" y="14" width="7" height="11" rx="2.5" fill="#0F172A"/>

      <!-- Tipper Cargo Body (CleanTrack Green) -->
      <rect x="6" y="22" width="32" height="36" rx="4" fill="${bodyColor}" stroke="#0F172A" stroke-width="1.4"/>
      <rect x="9" y="26" width="26" height="28" rx="2" fill="${bodyDark}" opacity="0.3"/>
      
      <!-- Reinforcement Ribs -->
      <line x1="10" y1="34" x2="34" y2="34" stroke="#0F172A" stroke-width="0.8" opacity="0.4"/>
      <line x1="10" y1="42" x2="34" y2="42" stroke="#0F172A" stroke-width="0.8" opacity="0.4"/>
      <line x1="10" y1="50" x2="34" y2="50" stroke="#0F172A" stroke-width="0.8" opacity="0.4"/>

      <!-- Cab (White Top) -->
      <rect x="7" y="6" width="30" height="19" rx="4" fill="${cabColor}" stroke="#0F172A" stroke-width="1.4"/>

      <!-- Windshield -->
      <rect x="10" y="9" width="24" height="7" rx="2" fill="#1E293B" opacity="0.75"/>

      <!-- Side Mirrors -->
      <rect x="3" y="10" width="4" height="3" rx="1" fill="#0F172A"/>
      <rect x="37" y="10" width="4" height="3" rx="1" fill="#0F172A"/>

      <!-- Dual Headlights (Vibrant Warm Yellow) -->
      <circle cx="12" cy="7" r="1.5" fill="#FDE047"/>
      <circle cx="32" cy="7" r="1.5" fill="#FDE047"/>

      <!-- CleanTrack Identity Crest / Beacon -->
      <circle cx="22" cy="18" r="2" fill="${accentColor}"/>
    </g>
  </svg>
</div>`;
}

/** Quantized icon cache for smooth RAF updates without re-instantiating L.DivIcon */
const ICON_CACHE = new Map<string, L.DivIcon>();
function truckDivIcon(bearing: number, opts: { size?: "lg" | "sm"; offline?: boolean; active?: boolean } = {}) {
  const size = opts.size ?? "sm";
  const bucket = Math.round(((bearing % 360) + 360) % 360 / 5) * 5;
  const key = `${size}|${opts.offline ? 1 : 0}|${opts.active ? 1 : 0}|${bucket}`;
  const cached = ICON_CACHE.get(key);
  if (cached) return cached;

  const dim = size === "sm" ? { w: 30, h: 44 } : { w: 44, h: 64 };
  const html = `
    <div style="position:relative;width:${dim.w}px;height:${dim.h}px;">
      ${opts.active && !opts.offline ? '<div class="ct-truck-active-pulse"></div>' : ""}
      <div class="ct-truck-wrapper ${opts.offline ? "offline" : ""}" style="width:${dim.w}px;height:${dim.h}px;transform:rotate(${bucket}deg);">
        ${navigationTruckSvgHTML(opts.active, opts.offline)}
      </div>
      ${opts.active && !opts.offline ? '<div class="ct-truck-green-dot"></div>' : ""}
    </div>`;
  const icon = L.divIcon({
    html,
    className: "ct-truck-leaflet-marker",
    iconSize: [dim.w, dim.h],
    iconAnchor: [dim.w / 2, dim.h / 2],
  });
  ICON_CACHE.set(key, icon);
  return icon;
}

const RESIDENT_ICON = L.divIcon({
  html: `
    <div class="ct-resident-marker-container">
      <div class="ct-resident-accuracy-pulse"></div>
      <div class="ct-resident-dot"></div>
    </div>`,
  className: "ct-resident-leaflet-marker",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
function residentIcon() { return RESIDENT_ICON; }

const ETA_ICON_CACHE = new Map<string, L.DivIcon>();
function etaBadgeIcon(text: string, distanceStr?: string) {
  const key = `${text}|${distanceStr ?? ""}`;
  const cached = ETA_ICON_CACHE.get(key);
  if (cached) return cached;
  const html = `
    <div class="ct-navigation-eta-badge">
      <span class="ct-eta-time">${text}</span>
      ${distanceStr ? `<span class="ct-eta-dist">${distanceStr}</span>` : ""}
    </div>`;
  const icon = L.divIcon({
    html,
    className: "ct-eta-leaflet-badge",
    iconSize: [90, 32],
    iconAnchor: [45, 42],
  });
  ETA_ICON_CACHE.set(key, icon);
  if (ETA_ICON_CACHE.size > 64) {
    const first = ETA_ICON_CACHE.keys().next().value;
    if (first) ETA_ICON_CACHE.delete(first);
  }
  return icon;
}

const LANDMARK_CACHE = new Map<string, L.DivIcon>();
function landmarkIcon(name: string, color = "#3B82F6") {
  const key = `${name}|${color}`;
  const cached = LANDMARK_CACHE.get(key);
  if (cached) return cached;
  const html = `
    <div class="ct-navigation-landmark">
      <div class="ct-landmark-pin" style="background:${color}"></div>
      <span>${name}</span>
    </div>`;
  const icon = L.divIcon({
    html,
    className: "",
    iconSize: [12, 12],
    iconAnchor: [14, 28],
  });
  LANDMARK_CACHE.set(key, icon);
  return icon;
}

const HOME_ICON_CACHE = new Map<string, L.DivIcon>();
function homeIcon(lang: "en" | "hi" | "mr") {
  const cached = HOME_ICON_CACHE.get(lang);
  if (cached) return cached;
  const icon = L.divIcon({
    html: `<div class="ct-home-pin">${translate("Home", lang)}</div>`,
    className: "",
    iconSize: [12, 12],
    iconAnchor: [-10, 32],
  });
  HOME_ICON_CACHE.set(lang, icon);
  return icon;
}

const CITY_BADGE_CACHE = new Map<string, L.DivIcon>();
function cityBadge(name: string) {
  const c = CITY_BADGE_CACHE.get(name);
  if (c) return c;
  const icon = L.divIcon({
    html: `<div class="ct-city-badge">${name}</div>`,
    className: "",
    iconSize: [90, 26],
    iconAnchor: [45, 13],
  });
  CITY_BADGE_CACHE.set(name, icon);
  return icon;
}

/** Landmark points around Shirpur for navigation map POIs */
const SHIRPUR_LANDMARKS: { name: string; pos: LatLng; color: string }[] = [
  { name: "Shirpur Park", pos: { lat: SHIRPUR.lat + 0.006, lng: SHIRPUR.lng - 0.005 }, color: "#22C55E" },
  { name: "Old Cotton Market", pos: { lat: SHIRPUR.lat + 0.010, lng: SHIRPUR.lng + 0.002 }, color: "#3B82F6" },
  { name: "Municipal Office", pos: { lat: SHIRPUR.lat - 0.004, lng: SHIRPUR.lng + 0.001 }, color: "#0EA5E9" },
  { name: "Gandhi Chowk", pos: { lat: SHIRPUR.lat - 0.002, lng: SHIRPUR.lng - 0.006 }, color: "#F97316" },
];

/**
 * Controller component for Driver Mode navigation camera.
 * Places the vehicle in the lower-middle section of the screen so the road ahead is visible.
 */
function DriverNavigationCameraController({
  position,
  bearing,
  active,
}: {
  position: LatLng;
  bearing: number;
  active: boolean;
}) {
  const map = useMap();
  const lastPos = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!active) return;
    if (
      lastPos.current &&
      Math.abs(lastPos.current.lat - position.lat) < 0.00005 &&
      Math.abs(lastPos.current.lng - position.lng) < 0.00005
    ) {
      return;
    }
    lastPos.current = position;

    // Offset camera slightly forward in direction of bearing so road ahead is visible
    const rad = (bearing * Math.PI) / 180;
    const offsetLat = Math.cos(rad) * 0.0012;
    const offsetLng = Math.sin(rad) * 0.0012;

    const targetCenter: [number, number] = [position.lat + offsetLat, position.lng + offsetLng];
    map.panTo(targetCenter, { animate: true, duration: 0.8, easeLinearity: 0.25 });
  }, [position.lat, position.lng, bearing, active, map]);

  return null;
}

/** Recenter camera on target key change */
function RecenterOnKey({ center, zoom, triggerKey }: { center: LatLng; zoom?: number; triggerKey: string }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true, duration: 0.7 });
  }, [triggerKey]); // eslint-disable-line
  return null;
}

/** Floating Navigation Map Controls (+, -, compass, recenter, speed limit) */
function NavigationControls({
  onRecenter,
  speedKmh,
  signalFresh = true,
  lastFixSec,
}: {
  onRecenter?: () => void;
  speedKmh?: number;
  signalFresh?: boolean;
  lastFixSec?: number;
}) {
  const map = useMap();

  const handleZoomIn = useCallback(() => map.zoomIn(), [map]);
  const handleZoomOut = useCallback(() => map.zoomOut(), [map]);

  return (
    <div className="absolute right-3 bottom-24 z-[500] flex flex-col items-center gap-2 pointer-events-auto">
      {/* Speed badge if vehicle is moving */}
      {typeof speedKmh === "number" && speedKmh > 1 && (
        <div className="ct-speed-badge shadow-md">
          <span className="ct-speed-val">{Math.round(speedKmh)}</span>
          <span className="ct-speed-unit">km/h</span>
        </div>
      )}

      {/* GPS Stale Warning Badge */}
      {!signalFresh && (
        <div className="ct-gps-stale-badge shadow-md animate-pulse">
          <span>⚠️ {lastFixSec ? `GPS Stale (${lastFixSec}s)` : "Weak Signal"}</span>
        </div>
      )}

      {/* Recenter / Target Lock Button */}
      {onRecenter && (
        <button
          onClick={onRecenter}
          className="ct-nav-btn ct-nav-btn-accent shadow-lg"
          title="Recenter Camera"
          aria-label="Recenter camera"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm0-13a5 5 0 100 10 5 5 0 000-10zm0 8a3 3 0 110-6 3 3 0 010 6z" />
          </svg>
        </button>
      )}

      {/* Zoom In & Out Controls */}
      <div className="flex flex-col bg-white rounded-2xl shadow-lg border border-neutral-200/80 overflow-hidden">
        <button
          onClick={handleZoomIn}
          className="ct-nav-btn border-b border-neutral-100 hover:bg-neutral-50"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="ct-nav-btn hover:bg-neutral-50"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}

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

type Props = ResidentMapProps | DriverMapProps | AdminMapProps;

export function TruckMap(props: Props) {
  const lang = useI18n((s) => s.lang);
  useEffect(() => { startSimulation(); }, []);
  const trucks = useTrucks((s) => s.trucks);
  const list = useMemo(() => Object.values(trucks), [trucks]);

  // RESIDENT MODE
  if (props.mode === "resident") {
    const onlineTrucks = list.filter((t) => t.status !== "offline");
    const nearest =
      onlineTrucks.length === 0
        ? undefined
        : onlineTrucks.reduce((best, cur) =>
            haversine(cur.position, props.resident) < haversine(best.position, props.resident) ? cur : best,
          );
    const active = props.activeTruckId ? trucks[props.activeTruckId] : nearest;
    const distanceM = active ? haversine(active.position, props.resident) : 0;
    const etaText = formatEta(distanceM, lang).toUpperCase();
    const distText = formatDistance(distanceM, lang);

    // Calculate GPS fix freshness (fresh if updated within 20s)
    const now = Date.now();
    const fixAgeSec = active?.lastUpdate ? Math.round((now - active.lastUpdate) / 1000) : 0;
    const signalFresh = fixAgeSec < 20;

    return (
      <MapContainer
        center={[props.resident.lat, props.resident.lng]}
        zoom={16}
        minZoom={10}
        maxZoom={20}
        zoomControl={false}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
        touchZoom={true}
        boxZoom={true}
        keyboard={true}
        attributionControl={false}
        className="w-full h-full"
      >
        <MapLayerSwitcher />

        <RecenterOnKey
          center={props.resident}
          zoom={15}
          triggerKey={active?.id ?? "none"}
        />

        {/* Soft Geofence Halo Ring */}
        <Circle
          center={[props.resident.lat, props.resident.lng]}
          radius={props.radius}
          pathOptions={{
            color: "#22C55E",
            weight: 1.5,
            opacity: 0.45,
            fillColor: "#22C55E",
            fillOpacity: 0.08,
            dashArray: "6 8",
          }}
        />

        {/* Landmark POIs */}
        {SHIRPUR_LANDMARKS.map((lm) => (
          <Marker key={lm.name} position={[lm.pos.lat, lm.pos.lng]} icon={landmarkIcon(lm.name, lm.color)} interactive={false} />
        ))}

        {/* OSRM Navigation Route Line with Dual-Casing Outline */}
        {active && active.truck.route.length >= 2 && (
          <NavigationPolyline positions={active.truck.route} active={true} />
        )}

        {/* Resident Location Marker & Home Label */}
        <Marker position={[props.resident.lat, props.resident.lng]} icon={residentIcon()} />
        <Marker position={[props.resident.lat, props.resident.lng]} icon={homeIcon(lang)} interactive={false} />

        {/* Idle Trucks Roster */}
        {list
          .filter((t) => t.id !== active?.id)
          .map((t) => (
            <IdleTruckMarker key={t.id} truck={t} />
          ))}

        {/* Active Truck + Navigation ETA Badge */}
        {active && (
          <>
            <Marker
              position={[active.position.lat, active.position.lng]}
              icon={etaBadgeIcon(etaText, distText)}
              interactive={false}
            />
            <Marker
              position={[active.position.lat, active.position.lng]}
              icon={truckDivIcon(active.bearing, { size: "lg", active: true })}
            />
          </>
        )}

        <NavigationControls
          onRecenter={() => {}}
          speedKmh={active ? active.speedMps * 3.6 : 0}
          signalFresh={signalFresh}
          lastFixSec={fixAgeSec}
        />
      </MapContainer>
    );
  }

  // DRIVER MODE
  if (props.mode === "driver") {
    const truck = trucks[props.truckId];
    if (!truck) return null;

    const speedKmh = truck.speedMps * 3.6;
    const now = Date.now();
    const fixAgeSec = Math.round((now - truck.lastUpdate) / 1000);
    const signalFresh = fixAgeSec < 20;

    return (
      <MapContainer
        center={[truck.position.lat, truck.position.lng]}
        zoom={17}
        minZoom={10}
        maxZoom={20}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
      >
        <MapLayerSwitcher />

        {/* Navigation Camera Controller (Keeps road ahead visible) */}
        <DriverNavigationCameraController
          position={truck.position}
          bearing={truck.bearing}
          active={truck.status !== "offline"}
        />

        {/* OSRM Route with Casing Outline */}
        {truck.truck.route.length >= 2 && (
          <NavigationPolyline positions={truck.truck.route} active={true} />
        )}

        {/* Driver Vehicle Marker */}
        <Marker
          position={[truck.position.lat, truck.position.lng]}
          icon={truckDivIcon(truck.bearing, { size: "lg", active: true, offline: truck.status === "offline" })}
        />

        <NavigationControls
          speedKmh={speedKmh}
          signalFresh={signalFresh}
          lastFixSec={fixAgeSec}
        />
      </MapContainer>
    );
  }

  // ADMIN FLEET OVERVIEW MODE
  const bounds: L.LatLngBoundsExpression = [
    [SHIRPUR.lat - 0.035, SHIRPUR.lng - 0.035],
    [SHIRPUR.lat + 0.035, SHIRPUR.lng + 0.035],
  ];
  const highlighted = props.highlightId ? trucks[props.highlightId] : undefined;

  return (
    <MapContainer
      bounds={bounds}
      minZoom={10}
      maxZoom={20}
      zoomControl={false}
      attributionControl={false}
      className="w-full h-full"
    >
      <MapLayerSwitcher />

      <Marker position={[SHIRPUR.lat, SHIRPUR.lng]} icon={cityBadge("Shirpur")} interactive={false} />
      {SHIRPUR_LANDMARKS.map((lm) => (
        <Marker key={lm.name} position={[lm.pos.lat, lm.pos.lng]} icon={landmarkIcon(lm.name, lm.color)} interactive={false} />
      ))}

      {highlighted && (
        <RecenterOnKey center={highlighted.position} zoom={16} triggerKey={highlighted.id} />
      )}

      {/* Fleet Routes */}
      {list.map((t) => (
        <PolyRoute key={t.id} truck={t} showRoute={!!props.showRoutes} highlight={props.highlightId === t.id} />
      ))}

      {/* Fleet Markers */}
      {list.map((t) => (
        <AdminTruckMarker
          key={t.id}
          truck={t}
          highlighted={props.highlightId === t.id}
          onClick={props.onTruckClick}
        />
      ))}

      <NavigationControls />
    </MapContainer>
  );
}

/** Dual-cased navigation polyline with glow for satellite visibility */
function NavigationPolyline({ positions, active }: { positions: LatLng[]; active?: boolean }) {
  const coords = useMemo(() => positions.map((p) => [p.lat, p.lng] as [number, number]), [positions]);
  if (coords.length < 2) return null;

  return (
    <>
      {/* Outer Glow — white halo so route is visible on dark satellite */}
      <Polyline
        positions={coords}
        pathOptions={{
          color: "#FFFFFF",
          weight: active ? 14 : 9,
          opacity: 0.25,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      {/* Dark Casing */}
      <Polyline
        positions={coords}
        pathOptions={{
          color: "#0F172A",
          weight: active ? 10 : 6,
          opacity: 0.5,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      {/* Inner Navigation Line — bright green/blue */}
      <Polyline
        positions={coords}
        pathOptions={{
          color: active ? "#4ADE80" : "#60A5FA",
          weight: active ? 6 : 3.5,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    </>
  );
}

/** Memoized Idle Truck Marker */
const IdleTruckMarker = memo(
  function IdleTruckMarker({ truck }: { truck: LiveTruck }) {
    bumpRender();
    return (
      <Marker
        position={[truck.position.lat, truck.position.lng]}
        icon={truckDivIcon(truck.bearing, { size: "sm", offline: truck.status === "offline" })}
        interactive={false}
      />
    );
  },
  (prev, next) =>
    prev.truck.status === next.truck.status &&
    Math.round(prev.truck.position.lat * 1e5) === Math.round(next.truck.position.lat * 1e5) &&
    Math.round(prev.truck.position.lng * 1e5) === Math.round(next.truck.position.lng * 1e5) &&
    Math.round(prev.truck.bearing / 5) === Math.round(next.truck.bearing / 5),
);

/** Memoized Admin Fleet Truck Marker */
const AdminTruckMarker = memo(
  function AdminTruckMarker({
    truck,
    highlighted,
    onClick,
  }: {
    truck: LiveTruck;
    highlighted: boolean;
    onClick?: (id: string) => void;
  }) {
    bumpRender();
    const lang = useI18n((s) => s.lang);
    return (
      <Marker
        position={[truck.position.lat, truck.position.lng]}
        icon={truckDivIcon(truck.bearing, {
          size: highlighted ? "lg" : "sm",
          offline: truck.status === "offline",
          active: highlighted,
        })}
        eventHandlers={{ click: () => onClick?.(truck.id) }}
      >
        <Tooltip direction="top" offset={[0, -12]} opacity={1} permanent={highlighted}>
          <span style={{ fontWeight: 700, fontSize: 11 }}>{truck.id}</span>
        </Tooltip>
        <Popup>
          <div style={{ minWidth: 190, padding: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{truck.truck.id} · {truck.truck.name}</div>
            <div style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{truck.truck.driverName}</div>
            <div style={{ color: "#64748B", fontSize: 12 }}>{truck.truck.wardName}</div>
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600 }}>
              {translate("Stops", lang)}: {truck.completedStops}/{truck.truck.totalStops}
            </div>
            <div style={{ fontSize: 12, textTransform: "capitalize", color: truck.status === "offline" ? "#EF4444" : "#22C55E" }}>
              {translate("Status", lang)}: {truck.status}
            </div>
          </div>
        </Popup>
      </Marker>
    );
  },
  (prev, next) =>
    prev.highlighted === next.highlighted &&
    prev.onClick === next.onClick &&
    prev.truck.status === next.truck.status &&
    prev.truck.completedStops === next.truck.completedStops &&
    Math.round(prev.truck.position.lat * 1e5) === Math.round(next.truck.position.lat * 1e5) &&
    Math.round(prev.truck.position.lng * 1e5) === Math.round(next.truck.position.lng * 1e5) &&
    Math.round(prev.truck.bearing / 5) === Math.round(next.truck.bearing / 5),
);

const PolyRoute = memo(function PolyRoute({ truck, showRoute, highlight }: { truck: LiveTruck; showRoute: boolean; highlight: boolean }) {
  const positions = useMemo(
    () => (truck.path ?? truck.truck.route),
    [truck.path, truck.truck.route],
  );
  if (!showRoute && !highlight) return null;
  return <NavigationPolyline positions={positions} active={highlight} />;
}, (prev, next) =>
  prev.showRoute === next.showRoute &&
  prev.highlight === next.highlight &&
  prev.truck.status === next.truck.status &&
  prev.truck.truck.route === next.truck.truck.route,
);