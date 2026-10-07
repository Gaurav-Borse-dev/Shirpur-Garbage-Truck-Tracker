/**
 * Driver background location & high-accuracy GPS broadcasting.
 *
 * Uses the device's real GPS. When running inside a Capacitor native app,
 * uses @capacitor/geolocation which persists through screen-lock via the
 * Android foreground service. Falls back to navigator.geolocation for web.
 *
 * Fixes update the local driver view with zero latency and are emitted to the
 * backend every 2-3s so residents see accurate, on-time truck movement.
 */
import { SOCKET_ENABLED } from "@/lib/backend";
import { emitDriverGps } from "@/lib/realtime";
import { ingestDriverGps } from "@/lib/tracking.functions";
import { useOffline, type PendingAction } from "@/store/offline";
import { useTrucks } from "@/store/trucks";
import { bearing, haversine, type LatLng } from "@/lib/geo";

export type GpsPayload = {
  truckId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracyM?: number;
  ts: number;
};

const MIN_INTERVAL_MS = 2000;
const MAX_INTERVAL_MS = 4000;

let watchId: string | number | null = null;
let keepalive: number | null = null;
let lastSentAt = 0;
let latest: GpsPayload | null = null;
let usingCapacitor = false;

// GPS track memory for smoothing and dead reckoning
let prevPos: LatLng | null = null;
let prevBearing = 180;
let prevTimestamp = 0;

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
        ...(p.heading === undefined || p.heading === null ? {} : { heading: Math.round(p.heading) }),
        ...(p.speed === undefined || p.speed === null ? {} : { speedKmh: Number((p.speed * 3.6).toFixed(1)) }),
        ...(p.accuracyM === undefined || p.accuracyM === null ? {} : { accuracyM: Math.round(p.accuracyM) }),
      },
    });
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

/**
 * Ingest position from device sensor with noise filtering, heading deduction,
 * immediate local state update, and throttled server delivery.
 */
function handlePosition(
  truckId: string,
  lat: number,
  lng: number,
  heading?: number | null,
  speed?: number | null,
  timestamp?: number,
  accuracy?: number | null,
) {
  const now = timestamp ?? Date.now();
  const currentPos: LatLng = {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };

  // Noise filter: reject wildly inaccurate GPS fixes (> 60m radius) if we already have a previous lock
  if (typeof accuracy === "number" && accuracy > 60 && prevPos !== null) {
    console.debug("[gps] Rejected noisy fix with accuracy", accuracy);
    return;
  }

  const distM = prevPos ? haversine(prevPos, currentPos) : 0;
  const timeDeltaS = prevTimestamp > 0 ? Math.max(0.2, (now - prevTimestamp) / 1000) : 1;

  // Determine realistic bearing
  let computedHeading = prevBearing;
  if (typeof heading === "number" && !isNaN(heading) && heading > 0) {
    computedHeading = heading;
    prevBearing = heading;
  } else if (distM > 1.2 && prevPos) {
    computedHeading = bearing(prevPos, currentPos);
    prevBearing = computedHeading;
  }

  // Determine realistic speed
  let computedSpeed = 0;
  if (typeof speed === "number" && !isNaN(speed) && speed >= 0) {
    computedSpeed = speed;
  } else if (distM > 0.4) {
    computedSpeed = Math.min(25, distM / timeDeltaS);
  }

  prevPos = currentPos;
  prevTimestamp = now;

  // 1. Zero-latency local update on driver's screen:
  useTrucks.getState().ingestFixes([
    {
      truckId,
      lat: currentPos.lat,
      lng: currentPos.lng,
      heading: computedHeading,
      speed: computedSpeed,
      status: "collecting",
      ts: now,
    },
  ]);

  // 2. Queue for server delivery:
  latest = {
    truckId,
    lat: currentPos.lat,
    lng: currentPos.lng,
    heading: computedHeading,
    speed: computedSpeed,
    accuracyM: typeof accuracy === "number" ? accuracy : undefined,
    ts: now,
  };

  if (Date.now() - lastSentAt >= MIN_INTERVAL_MS) {
    send(latest);
  }
}

/** Start streaming real device GPS for this truck. Idempotent. */
export async function startDriverLocation(truckId: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "unavailable" };
  if (watchId !== null) return { ok: true };

  const isNative = await isCapacitorNative();

  if (isNative) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== "granted") {
        return { ok: false, error: "Location permission denied. Please enable GPS in settings." };
      }

      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
        (position, err) => {
          if (err || !position?.coords) return;
          handlePosition(
            truckId,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.heading,
            position.coords.speed,
            position.timestamp,
            position.coords.accuracy,
          );
        },
      );

      watchId = id;
      usingCapacitor = true;
      console.info("[gps] Started Capacitor native geolocation with high accuracy");
    } catch (e) {
      console.warn("[gps] Capacitor geolocation failed, falling back to web API", e);
      return startWebGeolocation(truckId);
    }
  } else {
    return startWebGeolocation(truckId);
  }

  // Periodic heartbeat guarantees an update at least every MAX_INTERVAL_MS even when stopped
  keepalive = window.setInterval(() => {
    if (latest && Date.now() - lastSentAt >= MAX_INTERVAL_MS) {
      send({ ...latest, ts: Date.now() });
    }
  }, 1000);

  return { ok: true };
}

/** Web fallback using navigator.geolocation with high accuracy. */
function startWebGeolocation(truckId: string): { ok: boolean; error?: string } {
  if (!("geolocation" in navigator)) {
    return { ok: false, error: "Geolocation is not available on this device" };
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      handlePosition(
        truckId,
        pos.coords.latitude,
        pos.coords.longitude,
        pos.coords.heading,
        pos.coords.speed,
        pos.timestamp,
        pos.coords.accuracy,
      );
    },
    (err) => {
      console.warn("[gps] Web geolocation position error:", err.message);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
  );

  keepalive = window.setInterval(() => {
    if (latest && Date.now() - lastSentAt >= MAX_INTERVAL_MS) {
      send({ ...latest, ts: Date.now() });
    }
  }, 1000);

  usingCapacitor = false;
  console.info("[gps] Started web geolocation with high accuracy");
  return { ok: true };
}

export async function stopDriverLocation() {
  if (watchId !== null) {
    if (usingCapacitor) {
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        await Geolocation.clearWatch({ id: watchId as string });
      } catch {
        // ignore
      }
    } else if (typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId as number);
    }
  }
  if (keepalive) window.clearInterval(keepalive);
  watchId = null;
  keepalive = null;
  latest = null;
  prevPos = null;
  prevTimestamp = 0;
  usingCapacitor = false;
}

/** Replay queued writes once the socket or connection is back. */
export function syncPendingGps() {
  return useOffline.getState().flush((a: PendingAction) => {
    if (a.kind !== "duty") return false;
    if (SOCKET_ENABLED) return emitDriverGps(a.payload as GpsPayload);
    void deliver(a.payload as GpsPayload);
    return true;
  });
}