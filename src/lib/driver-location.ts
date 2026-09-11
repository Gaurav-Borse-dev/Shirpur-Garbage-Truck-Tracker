/**
 * Driver background location.
 *
 * Uses the device's real GPS. When running inside a Capacitor native app,
 * uses @capacitor/geolocation which persists through screen-lock via the
 * Android foreground service. Falls back to navigator.geolocation for web.
 *
 * Fixes are emitted to the backend every 3-5s; when the socket is down they
 * are queued offline and replayed automatically on reconnect.
 */
import { SOCKET_ENABLED } from "@/lib/backend";
import { emitDriverGps } from "@/lib/realtime";
import { ingestDriverGps } from "@/lib/tracking.functions";
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

let watchId: string | number | null = null;
let keepalive: number | null = null;
let lastSentAt = 0;
let latest: GpsPayload | null = null;
let usingCapacitor = false;

/** Detect whether we're running inside Capacitor native shell. */
async function isCapacitorNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Pushes one fix to the backend; returns false when it must be queued. */
async function deliver(p: GpsPayload): Promise<boolean> {
  if (SOCKET_ENABLED) return emitDriverGps(p);
  try {
    const res = await ingestDriverGps({
      data: {
        truckCode: p.truckId,
        lat: p.lat,
        lng: p.lng,
        ...(p.heading === undefined || p.heading === null ? {} : { heading: p.heading }),
        ...(p.speed === undefined || p.speed === null ? {} : { speedKmh: Math.max(0, p.speed * 3.6) }),
      },
    });
    // Server-side rejections (rate limited, implausible jump) are final —
    // re-queueing them would replay stale positions on reconnect.
    return res.accepted || res.reason !== "ingest_error";
  } catch {
    return false;
  }
}

function send(p: GpsPayload) {
  lastSentAt = Date.now();
  void deliver(p).then((ok) => {
    if (!ok) useOffline.getState().enqueue("duty", p);
  });
}

function handlePosition(truckId: string, lat: number, lng: number, heading?: number | null, speed?: number | null, timestamp?: number) {
  latest = {
    truckId,
    lat,
    lng,
    heading: heading ?? undefined,
    speed: speed ?? undefined,
    ts: timestamp ?? Date.now(),
  };
  if (Date.now() - lastSentAt >= MIN_INTERVAL_MS) send(latest);
}

/** Start streaming real device GPS for this truck. Idempotent. */
export async function startDriverLocation(truckId: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "unavailable" };
  if (watchId !== null) return { ok: true };

  const isNative = await isCapacitorNative();

  if (isNative) {
    // Use Capacitor Geolocation (persists through screen lock on Android)
    try {
      const { Geolocation } = await import("@capacitor/geolocation");

      // Request permissions first
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== "granted") {
        return { ok: false, error: "Location permission denied. Please enable GPS in settings." };
      }

      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15000 },
        (position, err) => {
          if (err || !position) return;
          handlePosition(
            truckId,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.heading,
            position.coords.speed,
            position.timestamp,
          );
        },
      );

      watchId = id;
      usingCapacitor = true;
      console.log("[gps] Started Capacitor geolocation (background-safe)");
    } catch (e) {
      console.warn("[gps] Capacitor geolocation failed, falling back to web API", e);
      return startWebGeolocation(truckId);
    }
  } else {
    return startWebGeolocation(truckId);
  }

  // Guarantees an update at least every MAX_INTERVAL_MS even when parked.
  keepalive = window.setInterval(() => {
    if (latest && Date.now() - lastSentAt >= MAX_INTERVAL_MS) send({ ...latest, ts: Date.now() });
  }, 1000);

  return { ok: true };
}

/** Web fallback — uses navigator.geolocation (suspends on screen lock). */
function startWebGeolocation(truckId: string): { ok: boolean; error?: string } {
  if (!("geolocation" in navigator)) return { ok: false, error: "Geolocation is not available on this device" };

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      handlePosition(truckId, pos.coords.latitude, pos.coords.longitude, pos.coords.heading, pos.coords.speed, pos.timestamp);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
  );

  // Guarantees an update at least every MAX_INTERVAL_MS even when parked.
  keepalive = window.setInterval(() => {
    if (latest && Date.now() - lastSentAt >= MAX_INTERVAL_MS) send({ ...latest, ts: Date.now() });
  }, 1000);

  usingCapacitor = false;
  console.log("[gps] Started web geolocation (may suspend on screen lock)");
  return { ok: true };
}

export async function stopDriverLocation() {
  if (watchId !== null) {
    if (usingCapacitor) {
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        await Geolocation.clearWatch({ id: watchId as string });
      } catch {
        // Capacitor cleanup failed — ignore
      }
    } else if (typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId as number);
    }
  }
  if (keepalive) window.clearInterval(keepalive);
  watchId = null;
  keepalive = null;
  latest = null;
  usingCapacitor = false;
}

/** Replay queued writes once the socket is back. Returns items synced. */
export function syncPendingGps() {
  return useOffline.getState().flush((a: PendingAction) => {
    if (a.kind !== "duty") return false;
    if (SOCKET_ENABLED) return emitDriverGps(a.payload as GpsPayload);
    void deliver(a.payload as GpsPayload);
    return true;
  });
}