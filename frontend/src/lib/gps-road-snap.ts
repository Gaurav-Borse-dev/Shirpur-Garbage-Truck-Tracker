/**
 * OSRM Road Snapping — snaps raw GPS coordinates to the nearest road.
 *
 * Uses the public OSRM demo server (router.project-osrm.org) for free
 * road matching. Includes a local coordinate cache and async throttle so
 * we never spam OSRM with every GPS fix.
 *
 * OSRM `/nearest` endpoint: finds the nearest road point to a coordinate.
 * OSRM `/match` endpoint:  map-matches a trace of GPS points to roads.
 *
 * In production you can point OSRM_BASE_URL at a self-hosted instance.
 */

export type SnappedPoint = {
  lat: number;
  lng: number;
  bearing?: number;
  distanceM: number; // distance from raw GPS to snapped point
  snapped: boolean;
};

/**
 * OSRM public demo server. Replace with self-hosted for production.
 * Free public endpoint: acceptable for low-volume municipal truck tracking.
 */
const OSRM_BASE_URL = "https://router.project-osrm.org";

/** Max distance to snap (meters) — beyond this we keep raw GPS */
const MAX_SNAP_DISTANCE_M = 50;

/** Throttle: minimum ms between OSRM requests per truck */
const SNAP_THROTTLE_MS = 3000;

/** Simple in-memory LRU cache for snapped points */
const snapCache = new Map<string, { result: SnappedPoint; ts: number }>();
const lastSnapAt = new Map<string, number>();
const CACHE_TTL_MS = 10_000;

function cacheKey(lat: number, lng: number): string {
  // Round to ~5m precision so nearby fixes hit cache
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Snap a single GPS fix to the nearest road via OSRM /nearest.
 * Returns the raw fix if OSRM is unavailable or the snap is too far.
 */
export async function snapToRoad(
  lat: number,
  lng: number,
  truckId: string,
): Promise<SnappedPoint> {
  const raw: SnappedPoint = { lat, lng, distanceM: 0, snapped: false };

  // Throttle per truck
  const now = Date.now();
  const lastSnap = lastSnapAt.get(truckId) ?? 0;
  if (now - lastSnap < SNAP_THROTTLE_MS) {
    return raw; // Return raw — interpolation will handle it
  }

  // Check cache
  const key = cacheKey(lat, lng);
  const cached = snapCache.get(key);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    lastSnapAt.set(truckId, now);

    const url = `${OSRM_BASE_URL}/nearest/v1/driving/${lng},${lat}?number=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000), // 3s timeout
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return raw;

    const data = (await res.json()) as {
      code: string;
      waypoints?: Array<{
        location: [number, number];
        distance: number;
        name?: string;
      }>;
    };

    if (data.code !== "Ok" || !data.waypoints?.length) return raw;

    const wp = data.waypoints[0];
    const snappedLng = wp.location[0];
    const snappedLat = wp.location[1];
    const distanceM = wp.distance;

    // Don't snap if too far from road — trust raw GPS instead
    if (distanceM > MAX_SNAP_DISTANCE_M) return raw;

    const result: SnappedPoint = {
      lat: snappedLat,
      lng: snappedLng,
      distanceM,
      snapped: true,
    };

    // Cache the result
    snapCache.set(key, { result, ts: now });
    if (snapCache.size > 200) {
      const oldestKey = snapCache.keys().next().value;
      if (oldestKey) snapCache.delete(oldestKey);
    }

    return result;
  } catch {
    // OSRM unavailable — fall back gracefully to raw GPS
    return raw;
  }
}

/**
 * Snap a batch of GPS trace points to roads via OSRM /match.
 * More accurate than nearest for moving vehicles (considers direction of travel).
 * Returns raw points if OSRM fails.
 */
export async function matchTraceToRoad(
  points: Array<{ lat: number; lng: number; ts: number }>,
  truckId: string,
): Promise<Array<{ lat: number; lng: number; snapped: boolean }>> {
  if (points.length < 2) return points.map((p) => ({ ...p, snapped: false }));

  const now = Date.now();
  const lastSnap = lastSnapAt.get(`match-${truckId}`) ?? 0;
  if (now - lastSnap < SNAP_THROTTLE_MS * 2) {
    return points.map((p) => ({ ...p, snapped: false }));
  }

  try {
    lastSnapAt.set(`match-${truckId}`, now);

    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const timestamps = points.map((p) => Math.round(p.ts / 1000)).join(";");
    const url = `${OSRM_BASE_URL}/match/v1/driving/${coords}?timestamps=${timestamps}&overview=full&geometries=geojson`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return points.map((p) => ({ ...p, snapped: false }));

    const data = (await res.json()) as {
      code: string;
      matchings?: Array<{
        geometry: { coordinates: Array<[number, number]> };
      }>;
    };

    if (data.code !== "Ok" || !data.matchings?.length) {
      return points.map((p) => ({ ...p, snapped: false }));
    }

    // Extract matched geometry coordinates
    const matched = data.matchings[0].geometry.coordinates;
    return matched.map(([lng, lat]) => ({ lat, lng, snapped: true }));
  } catch {
    return points.map((p) => ({ ...p, snapped: false }));
  }
}
