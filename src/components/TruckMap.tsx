import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useTrucks, startSimulation, type LiveTruck } from "@/store/trucks";
import type { LatLng } from "@/lib/geo";
import { fmtDistance, fmtEta, haversine, midpoint } from "@/lib/geo";

const CARTO_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Top-down garbage tipper truck icon.
 * Default orientation is NORTH (up). We rotate by real bearing so every
 * truck sits aligned with its road (Uber-style scattered vehicles).
 *
 * variant: "active" = tracked truck (larger, green online dot),
 *          "idle"   = other online trucks (slightly muted),
 *          "offline"= faded grey, no dot.
 */
function truckDivIcon(bearing: number, variant: "active" | "idle" | "offline" = "idle") {
  const dim = variant === "active" ? 40 : 34;
  const dotClass = variant === "active"
    ? '<circle cx="32" cy="8" r="4" fill="#22C55E" stroke="#fff" stroke-width="1.6"/>'
    : "";
  const bodyFill = "#ffffff";
  const cabFill = "#111827";
  const bedFill = "#22C55E"; // garbage container green
  const stroke = "#0b0b0b";
  const wheel = "#0b0b0b";
  const cls = `ct-truck-top ${variant === "idle" ? "idle" : ""} ${variant === "offline" ? "dim" : ""}`;
  // viewBox 40x40; truck vertical, pointing up (north).
  const svg = `
    <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${bearing}deg); transform-origin: 50% 50%; transition: transform 220ms linear;">
      <!-- wheels (behind body) -->
      <rect x="6" y="12" width="3.2" height="6" rx="1.2" fill="${wheel}"/>
      <rect x="30.8" y="12" width="3.2" height="6" rx="1.2" fill="${wheel}"/>
      <rect x="6" y="24" width="3.2" height="6" rx="1.2" fill="${wheel}"/>
      <rect x="30.8" y="24" width="3.2" height="6" rx="1.2" fill="${wheel}"/>
      <!-- tipper bed (rear two-thirds) -->
      <rect x="10" y="14" width="20" height="20" rx="2.5" fill="${bedFill}" stroke="${stroke}" stroke-width="1.2"/>
      <line x1="12" y1="20" x2="28" y2="20" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>
      <line x1="12" y1="26" x2="28" y2="26" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>
      <!-- cab (front third, top = north) -->
      <rect x="11" y="5" width="18" height="10" rx="2.2" fill="${bodyFill}" stroke="${stroke}" stroke-width="1.2"/>
      <rect x="13.5" y="7.5" width="13" height="4.5" rx="1" fill="${cabFill}" opacity="0.85"/>
      ${dotClass}
    </svg>`;
  const html = `<div class="${cls}">${svg}</div>`;
  return L.divIcon({ html, className: "", iconSize: [dim, dim], iconAnchor: [dim / 2, dim / 2] });
}

function residentIcon() {
  return L.divIcon({
    html: `<div class="ct-resident-dot"></div>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function etaIcon(text: string) {
  return L.divIcon({
    html: `<div class="ct-eta-badge">${text}</div>`,
    className: "",
    iconSize: [60, 24],
    iconAnchor: [30, 12],
  });
}

function landmarkIcon(name: string) {
  return L.divIcon({
    html: `<div class="ct-landmark"><span class="dot"></span>${name}</div>`,
    className: "", iconSize: [120, 24], iconAnchor: [60, 12],
  });
}

function FlyTo({ center, zoom }: { center: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }, [center.lat, center.lng]); // eslint-disable-line
  return null;
}

function MapControls({ onLocate }: { onLocate?: () => void }) {
  const map = useMap();
  return (
    <div className="absolute right-3 bottom-32 z-[500] flex flex-col gap-2">
      <button className="ct-map-btn" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button className="ct-map-btn" aria-label="Zoom out" onClick={() => map.zoomOut()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      {onLocate && (
        <button className="ct-map-btn" aria-label="My location" onClick={onLocate}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        </button>
      )}
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
  useEffect(() => { startSimulation(); }, []);
  const trucks = useTrucks((s) => s.trucks);
  useTrucks((s) => s.tick); // subscribe

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
    const center = active ? active.position : props.resident;
    return (
      <MapContainer
        center={[props.resident.lat, props.resident.lng]}
        zoom={15}
        zoomControl={false}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
        touchZoom={true}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} subdomains={["a", "b", "c", "d"]} />
        <FlyTo center={midpoint(props.resident, active?.position ?? props.resident)} zoom={15} />
        <MapControls />

        {/* Home landmark pin */}
        <Marker
          position={[props.resident.lat + 0.0007, props.resident.lng]}
          icon={landmarkIcon("Home")}
          interactive={false}
        />

        {/* Geofence */}
        <Circle
          center={[props.resident.lat, props.resident.lng]}
          radius={props.radius}
          pathOptions={{ color: "#3b82f6", weight: 1.5, dashArray: "6 6", fillColor: "#3b82f6", fillOpacity: 0.06 }}
        />

        {/* Resident */}
        <Marker position={[props.resident.lat, props.resident.lng]} icon={residentIcon()} />

        {/* Other online trucks (small) */}
        {onlineTrucks
          .filter((t) => t.id !== active?.id)
          .map((t) => (
            <Marker
              key={t.id}
              position={[t.position.lat, t.position.lng]}
              icon={truckDivIcon(t.bearing, "idle")}
            />
          ))}

        {/* Active truck */}
        {active && (
          <>
            <Polyline
              positions={[
                [active.position.lat, active.position.lng],
                [props.resident.lat, props.resident.lng],
              ]}
              pathOptions={{ color: "#2563eb", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
            />
            <Marker
              position={[
                (active.position.lat + props.resident.lat) / 2,
                (active.position.lng + props.resident.lng) / 2,
              ]}
              icon={etaIcon(fmtEta(haversine(active.position, props.resident)).toUpperCase())}
            />
            <Marker
              position={[active.position.lat, active.position.lng]}
              icon={truckDivIcon(active.bearing, "active")}
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
        <FlyTo center={truck.position} zoom={15} />
        <MapControls />
        <Polyline
          positions={truck.truck.route.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
        />
        <Marker
          position={[truck.position.lat, truck.position.lng]}
          icon={truckDivIcon(truck.bearing, truck.status === "offline" ? "offline" : "active")}
        />
      </MapContainer>
    );
  }

  // admin
  const bounds: L.LatLngBoundsExpression = [
    [20.85, 74.72],
    [21.4, 74.93],
  ];
  return (
    <MapContainer
      bounds={bounds}
      zoomControl={true}
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} subdomains={["a", "b", "c", "d"]} />
      <Marker position={[21.3483, 74.8827]} icon={landmarkIcon("Shirpur")} interactive={false} />
      {list.map((t) => (
        <PolyRoute key={t.id} truck={t} showRoute={!!props.showRoutes} highlight={props.highlightId === t.id} />
      ))}
      {list.map((t) => (
        <Marker
          key={t.id}
          position={[t.position.lat, t.position.lng]}
          icon={truckDivIcon(
            t.bearing,
            t.status === "offline" ? "offline" : props.highlightId === t.id ? "active" : "idle",
          )}
          eventHandlers={{ click: () => props.onTruckClick?.(t.id) }}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={props.highlightId === t.id}>
            <span style={{ fontWeight: 700, fontSize: 11 }}>{t.id}</span>
          </Tooltip>
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 700 }}>{t.truck.id} · {t.truck.name}</div>
              <div style={{ color: "#666", fontSize: 12 }}>{t.truck.driverName}</div>
              <div style={{ color: "#666", fontSize: 12 }}>{t.truck.wardName}</div>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Stops: {t.completedStops}/{t.truck.totalStops}
              </div>
              <div style={{ fontSize: 12 }}>Status: {t.status}</div>
            </div>
          </Popup>
        </Marker>
      ))}
      {props.highlightId && trucks[props.highlightId] && (
        <FlyTo center={trucks[props.highlightId].position} zoom={16} />
      )}
    </MapContainer>
  );
}

function PolyRoute({ truck, showRoute, highlight }: { truck: LiveTruck; showRoute: boolean; highlight: boolean }) {
  if (!showRoute && !highlight) return null;
  const offline = truck.status === "offline";
  return (
    <Polyline
      positions={truck.truck.route.map((p) => [p.lat, p.lng] as [number, number])}
      pathOptions={{
        color: offline ? "#9ca3af" : highlight ? "#2563eb" : truck.truck.color,
        weight: highlight ? 6 : 3,
        opacity: offline ? 0.5 : highlight ? 0.95 : 0.75,
        lineCap: "round",
        lineJoin: "round",
        dashArray: offline ? "6 8" : undefined,
      }}
    />
  );
}