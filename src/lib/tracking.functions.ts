import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const gpsInput = z.object({
  truckCode: z.string().regex(/^GBR-\d{2}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKmh: z.number().min(0).max(200).optional(),
  accuracyM: z.number().min(0).max(10000).optional(),
});

const nearbyInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(100).max(100000),
  limit: z.number().int().min(1).max(50).optional(),
});

const etaInput = z.object({
  truckCode: z.string().regex(/^GBR-\d{2}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Driver GPS ingest. The truck is resolved from the encrypted session cookie's
 * driver roster entry, so a driver can only report for their own truck.
 */
export const ingestDriverGps = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => gpsInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { truckCodeForPhone, truckIdForCode, admin } = await import("./tracking.server");

    const user = await getUser();
    if (!user || user.role !== "driver" || !user.phone) {
      return { accepted: false as const, reason: "unauthorized" };
    }
    const ownCode = truckCodeForPhone(user.phone);
    if (!ownCode || ownCode !== data.truckCode) {
      return { accepted: false as const, reason: "no_assigned_truck" };
    }
    const truckId = await truckIdForCode(ownCode);
    if (!truckId) return { accepted: false as const, reason: "unknown_truck" };

    const db = await admin();
    const { data: result, error } = await db.rpc("ingest_truck_location_for", {
      _truck_id: truckId,
      _driver_id: null,
      _lat: data.lat,
      _lng: data.lng,
      _heading: data.heading ?? 0,
      _speed_kmh: data.speedKmh ?? 0,
      _accuracy_m: data.accuracyM ?? null,
    });
    if (error) {
      console.error("[gps] ingest failed", error.message);
      return { accepted: false as const, reason: "ingest_error" };
    }
    return (result ?? { accepted: false, reason: "unknown" }) as {
      accepted: boolean;
      reason?: string;
      notified?: number;
    };
  });

/** Nearby live trucks via PostGIS `nearest_trucks`. Used by resident + admin maps. */
export const getNearbyTrucks = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => nearbyInput.parse(data))
  .handler(async ({ data }) => {
    const { admin } = await import("./tracking.server");
    const db = await admin();
    const { data: rows, error } = await db.rpc("nearest_trucks", {
      _lat: data.lat,
      _lng: data.lng,
      _radius_m: data.radiusM,
      _limit: data.limit ?? 50,
    });
    if (error) {
      console.error("[nearby] query failed", error.message);
      return { trucks: [] as never[], error: "unavailable" as const };
    }
    return {
      trucks: (rows ?? []).map((r) => ({
        truckId: r.truck_id,
        truckCode: r.truck_code,
        status: r.status,
        lat: r.lat,
        lng: r.lng,
        heading: r.heading,
        speedKmh: r.speed_kmh,
        distanceM: r.distance_m,
        fixedAt: r.fixed_at,
      })),
      error: null,
    };
  });

/** OSRM road-network ETA from a truck's latest fix to the given point. */
export const getTruckEta = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => etaInput.parse(data))
  .handler(async ({ data }) => {
    const { admin, truckIdForCode, routeEta } = await import("./tracking.server");
    const truckId = await truckIdForCode(data.truckCode);
    if (!truckId) return { available: false as const };

    const db = await admin();
    const { data: fix } = await db
      .rpc("nearest_trucks", { _lat: data.lat, _lng: data.lng, _radius_m: 100000, _limit: 50 })
      .then((res) => ({
        data: (res.data ?? []).find((r) => r.truck_id === truckId) ?? null,
      }));
    if (!fix) return { available: false as const };

    const eta = await routeEta({ lat: fix.lat, lng: fix.lng }, { lat: data.lat, lng: data.lng }, truckId);
    if (!eta) return { available: false as const };
    return {
      available: true as const,
      distanceM: eta.distanceM,
      durationS: eta.durationS,
      cached: eta.cached,
    };
  });