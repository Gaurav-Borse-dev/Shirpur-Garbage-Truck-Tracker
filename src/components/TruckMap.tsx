import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useTrucks, startSimulation, type LiveTruck } from "@/store/trucks";
import type { LatLng } from "@/lib/geo";
import { fmtDistance, fmtEta, haversine, midpoint } from "@/lib/geo";

const CARTO_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function truckDivIcon(color: string, bearing: number, size: "lg" | "sm" = "lg", offline = false) {
  const cls = `ct-truck-marker ${size === "sm" ? "small" : ""} ${offline ? "offline" : ""}`;
  const bg = offline ? "#9ca3af" : color;
  const html = `
    <div class="${cls}" style="background:${bg}; transform: rotate(0deg)">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${bearing - 90}deg); transition: transform 200ms linear;">
        <path d="M10 17h4V5H2v12h3" />
        <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" />
        <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    </div>`;
  const dim = size === "sm" ? 28 : 44;
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

function cityBadge(name: string) {
  return L.divIcon({
    html: `<div style="background:white;border:1px solid #e5e7eb;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;color:#111;box-shadow:0 2px 8px rgba(0,0,0,0.06)">${name}</div>`,
    className: "", iconSize: [70, 22], iconAnchor: [35, 11],
  });
}

function FlyTo({ center, zoom }: { center: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }, [center.lat, center.lng]); // eslint-disable-line
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
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} subdomains={["a", "b", "c", "d"]} />
        <FlyTo center={midpoint(props.resident, active?.position ?? props.resident)} zoom={15} />

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
              icon={truckDivIcon(t.truck.color, t.bearing, "sm")}
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
              pathOptions={{ color: "#111", weight: 5, lineCap: "round", lineJoin: "round" }}
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
              icon={truckDivIcon("#22C55E", active.bearing, "lg")}
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
        <Polyline
          positions={truck.truck.route.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: truck.truck.color, weight: 4, opacity: 0.8 }}
        />
        <Marker
          position={[truck.position.lat, truck.position.lng]}
          icon={truckDivIcon(truck.truck.color, truck.bearing, "lg", truck.status === "offline")}
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
      <Marker position={[21.3483, 74.8827]} icon={cityBadge("Shirpur")} interactive={false} />
      <Marker position={[20.9042, 74.7749]} icon={cityBadge("Dhule")} interactive={false} />
      {list.map((t) => (
        <PolyRoute key={t.id} truck={t} showRoute={!!props.showRoutes} highlight={props.highlightId === t.id} />
      ))}
      {list.map((t) => (
        <Marker
          key={t.id}
          position={[t.position.lat, t.position.lng]}
          icon={truckDivIcon(t.truck.color, t.bearing, "sm", t.status === "offline")}
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
    </MapContainer>
  );
}

function PolyRoute({ truck, showRoute, highlight }: { truck: LiveTruck; showRoute: boolean; highlight: boolean }) {
  if (!showRoute && !highlight) return null;
  const offline = truck.status === "offline";
  return (
    <Polyline
      positions={truck.truck.route.map((p) => [p.lat, p.lng])}
      pathOptions={{
        color: offline ? "#9ca3af" : truck.truck.color,
        weight: highlight ? 5 : 3,
        opacity: offline ? 0.5 : 0.85,
        dashArray: offline ? "6 8" : undefined,
      }}
    />
  );
}