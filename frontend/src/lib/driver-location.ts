/**
 * Driver background location & high-accuracy GPS broadcasting.
 *
 * Uses the device's real GPS. When running inside a Capacitor native app,
 * uses @capacitor/geolocation which persists through screen-lock via the
 * Android foreground service. Falls back to navigator.geolocation for web.
 *
 * GPS pipeline:
 *  1. Raw fix arrives from device sensor
 *  2. Adaptive noise filter (15m moving / 40m stopped)
 *  3. Kalman filter smooths lat/lng using accuracy as measurement variance
 *  4. OSRM road snapping aligns position to nearest road asynchronously
 *  5. Local truck store gets zero-latency smoothed fix
 *  6. Server ingest receives Kalman+snapped position every 2-3s
 */
import { SOCKET_ENABLED } from "@/lib/backend";
import { emitDriverGps } from "@/lib/realtime";
import { ingestDriverGps } from "@/lib/tracking.functions";
import { useOffline, type PendingAction } from "@/store/offline";
import { useTrucks } from "@/store/trucks";
import { bearing, haversine, type LatLng } from "@/lib/geo";
import { kalmanUpdate, type KalmanState } from "@/lib/gps-kalman";
import { snapToRoad } from "@/lib/gps-road-snap";

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

// Kalman filter state per truck
const kalmanStates = new Map<string, KalmanState>();

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
        ...(p.heading === undefined || p.heading === null
          ? {}
          : { heading: Math.round(p.heading) }),
        ...(p.speed === undefined || p.speed === null
          ? {}
          : { speedKmh: Number((p.speed * 3.6).toFixed(1)) }),
        ...(p.accuracyM === undefined || p.accuracyM === null
          ? {}
          : { accuracyM: Math.round(p.accuracyM) }),
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

/** Shortest-arc angle difference, handling 0/360 wrapping. */
function angleDiff(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180;
  return d;
}

/**
 * Ingest position from device sensor:
 * 1. Adaptive noise filter (strict when moving, relaxed when stationary)
 * 2. Kalman filter for smooth lat/lng
 * 3. Async OSRM road snapping (non-blocking — fires after local update)
 * 4. Zero-latency local state update with Kalman-smoothed position
 * 5. Throttled server delivery (2-4s) with snapped position when available
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
  const acc = typeof accuracy === "number" && accuracy > 0 ? accuracy : 30;

  // ── Adaptive noise filter ──
  // Moving: reject fixes worse than 50m accuracy (was 35m — too strict for many phones)
  // Stopped / first fix / testing: allow up to 150m (Kalman filter weights by variance)
  const isMoving = prevPos !== null && (typeof speed === "number" ? speed > 0.5 : false);
  const noiseThreshold = isMoving ? 50 : 150;
  if (acc > noiseThreshold && prevPos !== null) {
    console.debug(`[gps] Rejected noisy fix accuracy=${acc}m threshold=${noiseThreshold}m`);
    return;
  }

  // ── Kalman filter ──
  const prevKalman = kalmanStates.get(truckId) ?? null;
  const kalman = kalmanUpdate(prevKalman, lat, lng, acc, now);
  kalmanStates.set(truckId, kalman);

  const smoothLat = kalman.lat;
  const smoothLng = kalman.lng;
  const currentPos: LatLng = {
    lat: Number(smoothLat.toFixed(6)),
    lng: Number(smoothLng.toFixed(6)),
  };

  const distM = prevPos ? haversine(prevPos, currentPos) : 0;
  const timeDeltaS = prevTimestamp > 0 ? Math.max(0.2, (now - prevTimestamp) / 1000) : 1;

  // ── Heading (EWMA smoothed with proper angle wrapping) ──
  let computedHeading = prevBearing;
  if (typeof heading === "number" && !isNaN(heading) && heading >= 0) {
    // EWMA with shortest-arc wrapping (handles 350° → 10° correctly)
    computedHeading = (prevBearing + 0.4 * angleDiff(prevBearing, heading) + 360) % 360;
    prevBearing = computedHeading;
  } else if (distM > 1.2 && prevPos) {
    const rawBearing = bearing(prevPos, currentPos);
    computedHeading = (prevBearing + 0.4 * angleDiff(prevBearing, rawBearing) + 360) % 360;
    prevBearing = computedHeading;
  }

  // ── Speed ──
  let computedSpeed = 0;
  if (typeof speed === "number" && !isNaN(speed) && speed >= 0) {
    computedSpeed = speed;
  } else if (distM > 0.4) {
    computedSpeed = Math.min(25, distM / timeDeltaS);
  }

  prevPos = currentPos;
  prevTimestamp = now;

  // 1. Zero-latency local update with Kalman-smoothed position
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

  // 2. Build payload for server (will be updated with snapped position async)
  latest = {
    truckId,
    lat: currentPos.lat,
    lng: currentPos.lng,
    heading: computedHeading,
    speed: computedSpeed,
    accuracyM: acc,
    ts: now,
  };

  // 3. Async OSRM road snapping (non-blocking — runs in background)
  //    Updates latest payload with road-snapped coordinates before next send
  void snapToRoad(currentPos.lat, currentPos.lng, truckId).then((snapped) => {
    if (snapped.snapped && latest && latest.ts === now) {
      // Update local store with snapped position for instant visual accuracy
      useTrucks.getState().ingestFixes([
        {
          truckId,
          lat: snapped.lat,
          lng: snapped.lng,
          heading: computedHeading,
          speed: computedSpeed,
          status: "collecting",
          ts: now,
        },
      ]);
      // Upgrade latest payload with snapped position for server delivery
      latest = {
        ...latest,
        lat: snapped.lat,
        lng: snapped.lng,
        accuracyM: Math.min(acc, snapped.distanceM + 5), // snapping improves accuracy
      };
    }
  });

  // Send to server — more aggressive: every fix if enough time elapsed
  if (Date.now() - lastSentAt >= MIN_INTERVAL_MS) {
    send(latest);
  }
}


/** Start streaming real device GPS for this truck. Idempotent. */
export async function startDriverLocation(
  truckId: string,
): Promise<{ ok: boolean; error?: string }> {
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
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 500 },
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

  // 1. Immediately request current position without waiting for watchPosition interval
  navigator.geolocation.getCurrentPosition(
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
      console.warn("[gps] Immediate geolocation error, trying low accuracy:", err.message);
      // Fallback with low accuracy
      navigator.geolocation.getCurrentPosition(
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
        () => {},
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 10000 },
      );
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 },
  );

  // 2. Continuous watch with high accuracy
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
  prevBearing = 180;
  kalmanStates.clear();
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
