import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap, Tooltip, Popup, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { memo, useEffect, useMemo } from "react";
import { useTrucks, startSimulation, type LiveTruck } from "@/store/trucks";
import type { LatLng } from "@/lib/geo";
import { haversine } from "@/lib/geo";
import { bumpRender } from "@/store/perf";
import { formatEta } from "@/lib/format";
import { useI18n } from "@/store/i18n";
import { translate } from "@/lib/i18n";
import { SHIRPUR } from "@/lib/trucks";

const CARTO_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Top-down garbage-tipper SVG. Default orientation = NORTH (points up).
 *  Rotate the wrapper by the compass bearing. */
function truckSvgHTML(): string {
  return `
<svg viewBox="0 0 40 56" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;overflow:visible">
  <!-- wheels back -->
  <rect x="2"  y="34" width="6" height="11" rx="1.8" fill="#0f172a"/>
  <rect x="32" y="34" width="6" height="11" rx="1.8" fill="#0f172a"/>
  <!-- wheels front -->
  <rect x="2"  y="12" width="6" height="9"  rx="1.8" fill="#0f172a"/>
  <rect x="32" y="12" width="6" height="9"  rx="1.8" fill="#0f172a"/>
  <!-- tipper body (green) -->
  <rect x="6" y="20" width="28" height="30" rx="3.5"
        fill="#22C55E" stroke="#0f172a" stroke-width="1.2"/>
  <rect x="9" y="24" width="22" height="22" rx="1.5" fill="#16a34a" opacity="0.35"/>
  <line x1="10" y1="33" x2="30" y2="33" stroke="#0f172a" stroke-width="0.6" opacity="0.35"/>
  <line x1="10" y1="40" x2="30" y2="40" stroke="#0f172a" stroke-width="0.6" opacity="0.35"/>
  <!-- cab (white) -->
  <rect x="7" y="6" width="26" height="17" rx="3.5"
        fill="#ffffff" stroke="#0f172a" stroke-width="1.2"/>
  <!-- windshield tint -->
  <rect x="10" y="9" width="20" height="6" rx="1.5" fill="#334155" opacity="0.55"/>
  <!-- headlights -->
  <circle cx="11" cy="8"  r="1.1" fill="#fde68a"/>
  <circle cx="29" cy="8"  r="1.1" fill="#fde68a"/>
</svg>`;
}

/** Quantize bearing to 5-degree buckets so we reuse the same L.divIcon
 *  across frames — creating icons on every RAF tick killed FPS. */
const ICON_CACHE = new Map<string, L.DivIcon>();
function truckDivIcon(bearing: number, opts: { size?: "lg" | "sm"; offline?: boolean; active?: boolean } = {}) {
  const size = opts.size ?? "sm";
  const bucket = Math.round(((bearing % 360) + 360) % 360 / 5) * 5;
  const key = `${size}|${opts.offline ? 1 : 0}|${opts.active ? 1 : 0}|${bucket}`;
  const cached = ICON_CACHE.get(key);
  if (cached) return cached;
  const cls = `ct-truck ${size === "sm" ? "small" : ""} ${opts.offline ? "offline" : ""}`;
  const dim = size === "sm" ? { w: 26, h: 36 } : { w: 40, h: 56 };
  const html = `
    <div style="position:relative;width:${dim.w}px;height:${dim.h}px;">
      ${opts.active ? '<div class="ct-truck-active-ring"></div>' : ""}
      <div class="${cls}" style="width:${dim.w}px;height:${dim.h}px;transform:rotate(${bucket}deg);">
        ${truckSvgHTML()}
      </div>
      ${opts.active && !opts.offline ? '<div class="ct-truck-green-dot"></div>' : ""}
    </div>`;
  const icon = L.divIcon({
    html,
    className: "",
    iconSize: [dim.w, dim.h],
    iconAnchor: [dim.w / 2, dim.h / 2],
  });
  ICON_CACHE.set(key, icon);
  return icon;
}

const RESIDENT_ICON = L.divIcon({
  html: `<div class="ct-resident-dot"></div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});
function residentIcon() { return RESIDENT_ICON; }

const ETA_ICON_CACHE = new Map<string, L.DivIcon>();
function etaIcon(text: string) {
  const c = ETA_ICON_CACHE.get(text);
  if (c) return c;
  const icon = L.divIcon({
    html: `<div class="ct-eta-badge">${text}</div>`,
    className: "",
    iconSize: [70, 28],
    iconAnchor: [35, 32],
  });
  ETA_ICON_CACHE.set(text, icon);
  if (ETA_ICON_CACHE.size > 64) {
    const first = ETA_ICON_CACHE.keys().next().value;
    if (first) ETA_ICON_CACHE.delete(first);
  }
  return icon;
}

const LANDMARK_CACHE = new Map<string, L.DivIcon>();
function landmarkIcon(name: string, color = "#3B82F6") {
  const key = `${name}|${color}`;
  const c = LANDMARK_CACHE.get(key);
  if (c) return c;
  const html = `
    <div class="ct-landmark">
      <div class="ct-landmark-pin" style="background:${color}"></div>
      <span>${name}</span>
    </div>`;
  const icon = L.divIcon({
    html,
    className: "",
    iconSize: [10, 10],
    iconAnchor: [12, 24],
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
    iconSize: [10, 10],
    iconAnchor: [-12, 30],
  });
  HOME_ICON_CACHE.set(lang, icon);
  return icon;
}

const CITY_BADGE_CACHE = new Map<string, L.DivIcon>();
function cityBadge(name: string) {
  const c = CITY_BADGE_CACHE.get(name);
  if (c) return c;
  const icon = L.divIcon({
    html: `<div style="background:white;border:1px solid #e5e7eb;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;color:#111;box-shadow:0 2px 8px rgba(0,0,0,0.06)">${name}</div>`,
    className: "", iconSize: [70, 22], iconAnchor: [35, 11],
  });
  CITY_BADGE_CACHE.set(name, icon);
  return icon;
}

/** Landmark points around Shirpur for map POIs. */
const SHIRPUR_LANDMARKS: { name: string; pos: LatLng; color: string }[] = [
  { name: "Shirpur Park", pos: { lat: SHIRPUR.lat + 0.006, lng: SHIRPUR.lng - 0.005 }, color: "#22c55e" },
  { name: "Old Cotton Market", pos: { lat: SHIRPUR.lat + 0.010, lng: SHIRPUR.lng + 0.002 }, color: "#3B82F6" },
  { name: "Municipal Office", pos: { lat: SHIRPUR.lat - 0.004, lng: SHIRPUR.lng + 0.001 }, color: "#3B82F6" },
  { name: "Gandhi Chowk", pos: { lat: SHIRPUR.lat - 0.002, lng: SHIRPUR.lng - 0.006 }, color: "#3B82F6" },
];

function FlyTo({ center, zoom }: { center: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }, [center.lat, center.lng]); // eslint-disable-line
  return null;
}

/** Recenter only when the trigger key changes (e.g. active truck id), never on every tick. */
function RecenterOnKey({ center, zoom, triggerKey }: { center: LatLng; zoom?: number; triggerKey: string }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true, duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);
  return null;
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
  // trucks reference changes every step (immutable object replacement), so we
  // already re-render on every tick. No need for a separate `.tick` subscribe.
  const list = useMemo(() => Object.values(trucks), [trucks]);

  if (props.mode === "resident") {
    const onlineTrucks = list.filter((t) => t.status !== "offline");
    const nearest =
      onlineTrucks.length === 0
        ? undefined
        : onlineTrucks.reduce((best, cur) =>
            haversine(cur.position, props.resident) < haversine(best.position, props.resident) ? cur : best,
          );
    const active = props.activeTruckId ? trucks[props.activeTruckId] : nearest;
    return (
      <MapContainer
        center={[props.resident.lat, props.resident.lng]}
        zoom={15}
        zoomControl={false}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
        touchZoom={true}
        boxZoom={true}
        keyboard={true}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} subdomains={["a", "b", "c", "d"]} />
        <ZoomControl position="bottomright" />
        <RecenterOnKey
          center={props.resident}
          zoom={15}
          triggerKey={active?.id ?? "none"}
        />

        {/* Geofence (soft blue disk, matches reference) */}
        <Circle
          center={[props.resident.lat, props.resident.lng]}
          radius={props.radius}
          pathOptions={{ color: "#3b82f6", weight: 1.2, opacity: 0.35, fillColor: "#3b82f6", fillOpacity: 0.12 }}
        />

        {/* Landmark pins */}
        {SHIRPUR_LANDMARKS.map((lm) => (
          <Marker key={lm.name} position={[lm.pos.lat, lm.pos.lng]} icon={landmarkIcon(lm.name, lm.color)} interactive={false} />
        ))}

        {/* Active truck's route as thick blue navigation line */}
        {active && (
          <>
            <Polyline
              positions={active.truck.route.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: "#ffffff", weight: 10, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
            />
            <Polyline
              positions={active.truck.route.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: "#3B82F6", weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }}
            />
          </>
        )}

        {/* Resident location + Home label */}
        <Marker position={[props.resident.lat, props.resident.lng]} icon={residentIcon()} />
        <Marker position={[props.resident.lat, props.resident.lng]} icon={homeIcon(lang)} interactive={false} />

        {/* Idle scattered trucks — bearing matches their current road segment */}
        {list
          .filter((t) => t.id !== active?.id)
          .map((t) => (
            <IdleTruckMarker key={t.id} truck={t} />
          ))}

        {/* Active truck (top) + ETA badge riding on it */}
        {active && (
          <>
            <Marker
              position={[active.position.lat, active.position.lng]}
              icon={etaIcon(formatEta(haversine(active.position, props.resident), lang).toUpperCase())}
              interactive={false}
            />
            <Marker
              position={[active.position.lat, active.position.lng]}
              icon={truckDivIcon(active.bearing, { size: "lg", active: true })}
            />
          </>
        )}
      </MapContainer>
    );
  }

  if (props.mode === "driver") {
    const truck = trucks[props.truckId];
    if (!truck) return null;
    return (
      <MapContainer
        center={[truck.position.lat, truck.position.lng]}
        zoom={15}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} subdomains={["a", "b", "c", "d"]} />
        <ZoomControl position="bottomright" />
        <FlyTo center={truck.position} zoom={15} />
        <Polyline
          positions={truck.truck.route.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "#3B82F6", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
        />
        <Marker
          position={[truck.position.lat, truck.position.lng]}
          icon={truckDivIcon(truck.bearing, { size: "lg", active: true, offline: truck.status === "offline" })}
        />
      </MapContainer>
    );
  }

  // admin
  const bounds: L.LatLngBoundsExpression = [
    [SHIRPUR.lat - 0.03, SHIRPUR.lng - 0.03],
    [SHIRPUR.lat + 0.03, SHIRPUR.lng + 0.03],
  ];
  const highlighted = props.highlightId ? trucks[props.highlightId] : undefined;
  return (
    <MapContainer
      bounds={bounds}
      zoomControl={false}
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} subdomains={["a", "b", "c", "d"]} />
      <ZoomControl position="bottomright" />
      <Marker position={[SHIRPUR.lat, SHIRPUR.lng]} icon={cityBadge("Shirpur")} interactive={false} />
      {SHIRPUR_LANDMARKS.map((lm) => (
        <Marker key={lm.name} position={[lm.pos.lat, lm.pos.lng]} icon={landmarkIcon(lm.name, lm.color)} interactive={false} />
      ))}
      {highlighted && (
        <RecenterOnKey center={highlighted.position} zoom={16} triggerKey={highlighted.id} />
      )}
      {list.map((t) => (
        <PolyRoute key={t.id} truck={t} showRoute={!!props.showRoutes} highlight={props.highlightId === t.id} />
      ))}
      {list.map((t) => (
        <AdminTruckMarker
          key={t.id}
          truck={t}
          highlighted={props.highlightId === t.id}
          onClick={props.onTruckClick}
        />
      ))}
    </MapContainer>
  );
}

/**
 * Memoized marker for idle/scattered trucks on the resident map.
 * Only re-renders when position (~5m), bearing (~5°), or status actually change.
 */
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

/**
 * Memoized admin marker: skips re-render if the visible attributes are unchanged.
 */
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
        <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={highlighted}>
          <span style={{ fontWeight: 700, fontSize: 11 }}>{truck.id}</span>
        </Tooltip>
        <Popup>
          <div style={{ minWidth: 180 }}>
            <div style={{ fontWeight: 700 }}>{truck.truck.id} · {truck.truck.name}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{truck.truck.driverName}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{truck.truck.wardName}</div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              {translate("Stops", lang)}: {truck.completedStops}/{truck.truck.totalStops}
            </div>
            <div style={{ fontSize: 12 }}>{translate("Status", lang)}: {truck.status}</div>
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
  // Use the spline-smoothed drive path so the drawn route follows the same
  // curve the truck actually travels (no straight-line waypoint hops).
  const positions = useMemo(
    () => (truck.path ?? truck.truck.route).map((p) => [p.lat, p.lng] as [number, number]),
    [truck.path, truck.truck.route],
  );
  if (!showRoute && !highlight) return null;
  const offline = truck.status === "offline";
  if (highlight) {
    return (
      <>
        <Polyline
          positions={positions}
          pathOptions={{ color: "#ffffff", weight: 10, opacity: 0.9 }}
        />
        <Polyline
          positions={positions}
          pathOptions={{ color: "#3B82F6", weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }}
        />
      </>
    );
  }
  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: offline ? "#cbd5e1" : "#94a3b8",
        weight: 2,
        opacity: offline ? 0.35 : 0.5,
        dashArray: offline ? "4 6" : undefined,
      }}
    />
  );
}, (prev, next) =>
  prev.showRoute === next.showRoute &&
  prev.highlight === next.highlight &&
  prev.truck.status === next.truck.status &&
  prev.truck.truck.route === next.truck.truck.route,
);