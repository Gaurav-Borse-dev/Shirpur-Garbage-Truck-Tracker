/**
 * Driver background location.
 *
 * Uses the device's real GPS (navigator.geolocation.watchPosition). Fixes are
 * emitted to the backend every 3-5s; when the socket is down they are queued
 * offline and replayed automatically on reconnect. No position is ever
 * synthesized.
 */
import { emitDriverGps } from "@/lib/realtime";
import { useOffline, type PendingAction } from "@/store/offline";

export type GpsPayload = {
  truckId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  ts: number;
};

const MIN_INTERVAL_MS = 3000;
const MAX_INTERVAL_MS = 5000;

let watchId: number | null = null;
let keepalive: number | null = null;
let lastSentAt = 0;
let latest: GpsPayload | null = null;

function send(p: GpsPayload) {
  lastSentAt = Date.now();
  if (!emitDriverGps(p)) useOffline.getState().enqueue("duty", p);
}

/** Start streaming real device GPS for this truck. Idempotent. */
export function startDriverLocation(truckId: string): { ok: boolean; error?: string } {
  if (typeof window === "undefined") return { ok: false, error: "unavailable" };
  if (!("geolocation" in navigator)) return { ok: false, error: "Geolocation is not available on this device" };
  if (watchId !== null) return { ok: true };

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      latest = {
        truckId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading ?? undefined,
        speed: pos.coords.speed ?? undefined,
        ts: pos.timestamp,
      };
      if (Date.now() - lastSentAt >= MIN_INTERVAL_MS) send(latest);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
  );

  // Guarantees an update at least every MAX_INTERVAL_MS even when parked.
  keepalive = window.setInterval(() => {
    if (latest && Date.now() - lastSentAt >= MAX_INTERVAL_MS) send({ ...latest, ts: Date.now() });
  }, 1000);

  return { ok: true };
}

export function stopDriverLocation() {
  if (watchId !== null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchId);
  if (keepalive) window.clearInterval(keepalive);
  watchId = null;
  keepalive = null;
  latest = null;
}

/** Replay queued writes once the socket is back. Returns items synced. */
export function syncPendingGps() {
  return useOffline.getState().flush((a: PendingAction) => {
    if (a.kind !== "duty") return false;
    return emitDriverGps(a.payload as GpsPayload);
  });
}