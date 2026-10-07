import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { etaInput, gpsInput, nearbyInput } from "./tracking-schemas";

const completeStopInput = z.object({
  stopId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Driver GPS ingest. Verifies driver/admin session, resolves truck by code/UUID,
 * and records live coordinates with high precision in PostGIS.
 */
export const ingestDriverGps = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => gpsInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { admin, truckIdForCode } = await import("./tracking.server");

    const user = await getUser();
    if (!user || (user.role !== "driver" && user.role !== "admin")) {
      return { accepted: false as const, reason: "unauthorized" };
    }

    const db = await admin();
    const truckId = await truckIdForCode(data.truckCode);
    if (!truckId) {
      return { accepted: false as const, reason: "truck_not_found" };
    }

    let driverId: string | null = null;
    let driverUserId: string | null = null;
    if (user.phone) {
      const cleanPhone = user.phone.trim().replace(/\D/g, "").slice(-10);
      const { data: profile } = await db
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${cleanPhone},phone.eq.91${cleanPhone},phone.eq.+91${cleanPhone}`)
        .maybeSingle();

      if (profile?.user_id) {
        driverUserId = profile.user_id;
        const { data: driver } = await db
          .from("drivers")
          .select("id")
          .eq("user_id", profile.user_id)
          .maybeSingle();
        if (driver) driverId = driver.id;
      }
    }

    // Fallback: If not found by phone, find driver assigned to this truck
    if (!driverId) {
      const { data: driverByTruck } = await db
        .from("drivers")
        .select("id, user_id")
        .eq("assigned_truck_id", truckId)
        .maybeSingle();
      if (driverByTruck) {
        driverId = driverByTruck.id;
        driverUserId = driverByTruck.user_id;
      }
    }

    const { data: result, error } = await (db.rpc as Function)("ingest_truck_location_for", {
      _truck_id: truckId,
      _driver_id: driverId,
      _lat: data.lat,
      _lng: data.lng,
      _heading: data.heading ?? 0,
      _speed_kmh: data.speedKmh ?? 0,
      ...(data.accuracyM === undefined ? {} : { _accuracy_m: data.accuracyM }),
      _fixed_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[gps] ingest failed:", error.message);
      return { accepted: false as const, reason: "ingest_error" };
    }

    // Ensure truck status and driver duty state in DB are active
    const nowIso = new Date().toISOString();
    await db.from("trucks").update({ status: "collecting" }).eq("id", truckId);
    if (driverId) {
      await db
        .from("drivers")
        .update({
          on_duty: true,
          duty_state: "on_duty",
          last_heartbeat: nowIso,
        })
        .eq("id", driverId);
    }

    return (result ?? { accepted: true, reason: "ok" }) as {
      accepted: boolean;
      reason?: string;
      notified?: number;
    };
  });

/** Atomic Route Stop completion server function. */
export const completeRouteStop = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => completeStopInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { admin } = await import("./tracking.server");

    const user = await getUser();
    if (!user || user.role !== "driver") {
      return { success: false as const, reason: "unauthorized" };
    }

    const db = await admin();
    let driverId: string | null = null;
    if (user.phone) {
      const cleanPhone = user.phone.trim().replace(/\D/g, "");
      const { data: profile } = await db
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${cleanPhone},phone.eq.91${cleanPhone}`)
        .maybeSingle();
      if (profile?.user_id) {
        const { data: driver } = await db
          .from("drivers")
          .select("id")
          .eq("user_id", profile.user_id)
          .maybeSingle();
        if (driver) driverId = driver.id;
      }
    }

    const { data: result, error } = await (db.rpc as Function)("complete_route_stop_atomic", {
      _stop_id: data.stopId,
      _driver_id: driverId,
      _notes: data.notes ?? null,
    });

    if (error) {
      console.error("[stop] atomic completion failed", error.message);
      return { success: false as const, reason: "database_error" };
    }

    return (result ?? { success: false, reason: "unknown" }) as {
      success: boolean;
      reason?: string;
      stop_id?: string;
      completed_at?: string;
    };
  });

function parseLocation(loc: any): { lat: number; lng: number } | null {
  if (!loc) return null;
  if (typeof loc === "object") {
    if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      return { lat: Number(loc.coordinates[1]), lng: Number(loc.coordinates[0]) };
    }
    if (typeof loc.lat === "number" && typeof loc.lng === "number") {
      return { lat: loc.lat, lng: loc.lng };
    }
  }
  if (typeof loc === "string") {
    if (loc.length >= 50) {
      try {
        const buf = Buffer.from(loc, "hex");
        const isLE = buf[0] === 1;
        const lng = isLE ? buf.readDoubleLE(9) : buf.readDoubleBE(9);
        const lat = isLE ? buf.readDoubleLE(17) : buf.readDoubleBE(17);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      } catch {
        // ignore
      }
    }
    // Also try JSON parse in case stringified GeoJSON
    try {
      const parsed = JSON.parse(loc);
      if (parsed?.coordinates?.length >= 2) {
        return { lat: Number(parsed.coordinates[1]), lng: Number(parsed.coordinates[0]) };
      }
    } catch {}
  }
  return null;
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Nearby live trucks via PostGIS `nearest_trucks`. Used by resident + admin maps. */
export const getNearbyTrucks = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => nearbyInput.parse(data))
  .handler(async ({ data }) => {
    const { admin } = await import("./tracking.server");
    const db = await admin();
    const { data: rows, error } = await (db.rpc as Function)("nearest_trucks", {
      _lat: data.lat,
      _lng: data.lng,
      _radius_m: data.radiusM,
      _limit: data.limit ?? 50,
    });
    if (!error && rows && rows.length > 0) {
      return {
        trucks: rows.map((r: any) => ({
          truckId: r.truck_code,
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
    }

    // Fallback: If no trucks returned by RPC, read directly from truck_live_location table
    const { data: locRows } = await db
      .from("truck_live_location")
      .select("*, trucks!inner(truck_code, status)")
      .order("fixed_at", { ascending: false });

    if (locRows && locRows.length > 0) {
      const isGlobalScope = data.radiusM >= 100000;
      const mapped = locRows
        .map((r: any) => {
          const coords = parseLocation(r.location);
          if (!coords) return null;
          const dist = haversineM(data.lat, data.lng, coords.lat, coords.lng);
          if (!isGlobalScope && dist > data.radiusM) return null;
          return {
            truckId: r.trucks?.truck_code ?? "UNKNOWN",
            truckCode: r.trucks?.truck_code ?? "UNKNOWN",
            status: r.trucks?.status ?? "offline",
            lat: Number(coords.lat.toFixed(6)),
            lng: Number(coords.lng.toFixed(6)),
            heading: r.heading ?? 0,
            speedKmh: r.speed_kmh ?? 0,
            distanceM: dist,
            fixedAt: r.fixed_at,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distanceM - b.distanceM);

      return { trucks: mapped as any[], error: null };
    }

    return { trucks: [] as never[], error: null };
  });

/** OSRM road-network ETA from a truck's latest fix to the given point. */
export const getTruckEta = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => etaInput.parse(data))
  .handler(async ({ data }) => {
    const { admin, truckIdForCode, routeEta } = await import("./tracking.server");
    const truckId = await truckIdForCode(data.truckCode);

    let fromLat = data.truckLat;
    let fromLng = data.truckLng;

    if (fromLat === undefined || fromLng === undefined) {
      const db = await admin();
      const { data: rows } = await (db.rpc as Function)("nearest_trucks", {
        _lat: data.lat,
        _lng: data.lng,
        _radius_m: 100000,
        _limit: 50,
      });
      const match = (rows ?? []).find(
        (r: any) => r.truck_id === truckId || r.truck_code === data.truckCode,
      );
      if (match) {
        fromLat = match.lat;
        fromLng = match.lng;
      }
    }

    if (fromLat === undefined || fromLng === undefined) {
      return { available: false as const };
    }

    const eta = await routeEta(
      { lat: fromLat, lng: fromLng },
      { lat: data.lat, lng: data.lng },
      truckId,
    );
    if (!eta) return { available: false as const };
    return {
      available: true as const,
      distanceM: eta.distanceM,
      durationS: eta.durationS,
      cached: eta.cached,
    };
  });

/** Fetches the full truck fleet from the database. */
export const getFleetTrucks = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { admin } = await import("./tracking.server");
    const db = await admin();
    const { data: rows, error } = await db
      .from("trucks")
      .select("id, truck_code, registration_no, status, capacity_kg, ward, photo_url")
      .order("truck_code", { ascending: true });

    if (error || !rows?.length) {
      console.error("[fleet] trucks query failed", error?.message ?? "no rows");
      return { trucks: null, error: error?.message ?? "empty" };
    }

    return {
      trucks: rows.map((r) => ({
        dbId: r.id,
        truckCode: r.truck_code,
        registrationNo: r.registration_no,
        status: r.status as string,
        capacityKg: r.capacity_kg,
        ward: r.ward,
        photoUrl: r.photo_url,
      })),
      error: null,
    };
  } catch (err) {
    console.error("[fleet] trucks fetch failed", err);
    return { trucks: null, error: "unavailable" };
  }
});

/** Fetches the driver roster from the database. */
export const getFleetDrivers = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { admin } = await import("./tracking.server");
    const db = await admin();
    const { data: rows, error } = await db
      .from("drivers")
      .select(
        `
        id, user_id, license_no, on_duty, duty_state,
        assigned_truck_id, duty_started_at, last_heartbeat, trip_distance_m,
        assigned_truck:trucks!drivers_assigned_truck_id_fkey ( truck_code, ward )
      `,
      )
      .order("created_at", { ascending: true });

    if (error || !rows?.length) {
      console.error("[fleet] drivers query failed", error?.message ?? "no rows");
      return { drivers: null, error: error?.message ?? "empty" };
    }

    const userIds = rows.map((r) => r.user_id);
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id, full_name, phone")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.user_id, { name: p.full_name, phone: p.phone }]),
    );

    return {
      drivers: rows.map((r) => {
        const profile = profileMap.get(r.user_id);
        const truck = r.assigned_truck as { truck_code: string; ward: string | null } | null;
        return {
          dbId: r.id,
          userId: r.user_id,
          name: profile?.name ?? "Unknown",
          phone: profile?.phone ?? "",
          licenseNo: r.license_no,
          onDuty: r.on_duty,
          dutyState: r.duty_state as string,
          assignedTruckCode: truck?.truck_code ?? null,
          assignedTruckWard: truck?.ward ?? null,
          assignedTruckId: r.assigned_truck_id,
          dutyStartedAt: r.duty_started_at,
          lastHeartbeat: r.last_heartbeat,
          tripDistanceM: r.trip_distance_m,
        };
      }),
      error: null,
    };
  } catch (err) {
    console.error("[fleet] drivers fetch failed", err);
    return { drivers: null, error: "unavailable" };
  }
});

/** Dashboard stats aggregated from the database. */
export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { admin } = await import("./tracking.server");
    const db = await admin();

    const today = new Date().toISOString().slice(0, 10);

    const { count: notifCount } = await db
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", `${today}T00:00:00Z`);

    const { count: stopsCount } = await db
      .from("collection_history")
      .select("*", { count: "exact", head: true })
      .gte("completed_at", `${today}T00:00:00Z`)
      .eq("status", "completed");

    const { count: activeDrivers } = await db
      .from("drivers")
      .select("*", { count: "exact", head: true })
      .eq("on_duty", true);

    const { count: complaintsToday } = await db
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`);

    return {
      residentsAlerted: notifCount ?? 0,
      stopsCompleted: stopsCount ?? 0,
      activeDrivers: activeDrivers ?? 0,
      complaintsToday: complaintsToday ?? 0,
    };
  } catch (err) {
    console.error("[dashboard] stats fetch failed", err);
    return {
      residentsAlerted: 0,
      stopsCompleted: 0,
      activeDrivers: 0,
      complaintsToday: 0,
    };
  }
});
