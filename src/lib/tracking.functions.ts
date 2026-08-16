import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { etaInput, gpsInput, nearbyInput } from "./tracking-schemas";

const completeStopInput = z.object({
  stopId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Driver GPS ingest. Strictly verifies the authenticated driver from the server
 * session and database `drivers` table, binding submissions to auth.uid()/user_id.
 */
export const ingestDriverGps = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => gpsInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { admin } = await import("./tracking.server");

    const user = await getUser();
    if (!user || user.role !== "driver") {
      return { accepted: false as const, reason: "unauthorized" };
    }

    const db = await admin();

    let driverRow: { id: string; user_id: string; assigned_truck_id: string | null } | null = null;
    let assignedTruckCode: string | null = null;

    if (user.phone) {
      const { data: profile } = await db
        .from("profiles")
        .select("user_id")
        .eq("phone", user.phone)
        .maybeSingle();

      if (profile?.user_id) {
        const { data: driver } = await db
          .from("drivers")
          .select("id, user_id, assigned_truck_id, assigned_truck:trucks!drivers_assigned_truck_id_fkey(truck_code)")
          .eq("user_id", profile.user_id)
          .maybeSingle();

        if (driver) {
          driverRow = {
            id: driver.id,
            user_id: driver.user_id,
            assigned_truck_id: driver.assigned_truck_id,
          };
          const truckObj = driver.assigned_truck as { truck_code: string } | null;
          assignedTruckCode = truckObj?.truck_code ?? null;
        }
      }
    }

    if (!driverRow) {
      return { accepted: false as const, reason: "not_a_driver" };
    }

    if (!driverRow.assigned_truck_id) {
      return { accepted: false as const, reason: "no_assigned_truck" };
    }

    // Verify driver is reporting for their assigned truck, preventing cross-truck submissions
    if (data.truckCode && assignedTruckCode && data.truckCode !== assignedTruckCode) {
      return { accepted: false as const, reason: "truck_mismatch" };
    }

    const { data: result, error } = await (db.rpc as Function)("ingest_truck_location_for", {
      _truck_id: driverRow.assigned_truck_id,
      _driver_id: driverRow.id,
      _lat: data.lat,
      _lng: data.lng,
      _heading: data.heading ?? 0,
      _speed_kmh: data.speedKmh ?? 0,
      ...(data.accuracyM === undefined ? {} : { _accuracy_m: data.accuracyM }),
      _fixed_at: new Date().toISOString(),
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
      const { data: profile } = await db.from("profiles").select("user_id").eq("phone", user.phone).maybeSingle();
      if (profile?.user_id) {
        const { data: driver } = await db.from("drivers").select("id").eq("user_id", profile.user_id).maybeSingle();
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
    if (error) {
      console.error("[nearby] query failed", error.message);
      return { trucks: [] as never[], error: "unavailable" as const };
    }
    return {
      trucks: (rows ?? []).map((r: any) => ({
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
    const { data: fix } = await (db.rpc as Function)("nearest_trucks", { _lat: data.lat, _lng: data.lng, _radius_m: 100000, _limit: 50 })
      .then((res: any) => ({
        data: (res.data ?? []).find((r: any) => r.truck_id === truckId) ?? null,
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

/** Fetches the full truck fleet from the database. Used to replace hardcoded TRUCKS array. */
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

/** Fetches the driver roster from the database. Used to replace hardcoded DRIVER_NAMES array. */
export const getFleetDrivers = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { admin } = await import("./tracking.server");
    const db = await admin();
    const { data: rows, error } = await db
      .from("drivers")
      .select(`
        id, user_id, license_no, on_duty, duty_state,
        assigned_truck_id, duty_started_at, last_heartbeat, trip_distance_m,
        assigned_truck:trucks!drivers_assigned_truck_id_fkey ( truck_code, ward )
      `)
      .order("created_at", { ascending: true });

    if (error || !rows?.length) {
      console.error("[fleet] drivers query failed", error?.message ?? "no rows");
      return { drivers: null, error: error?.message ?? "empty" };
    }

    // Also fetch profiles to get driver names and phones
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

    // Count residents alerted today (notifications sent)
    const { count: notifCount } = await db
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", `${today}T00:00:00Z`);

    // Count stops completed today
    const { count: stopsCount } = await db
      .from("collection_history")
      .select("*", { count: "exact", head: true })
      .gte("completed_at", `${today}T00:00:00Z`)
      .eq("status", "completed");

    // Count active drivers (on duty)
    const { count: activeDrivers } = await db
      .from("drivers")
      .select("*", { count: "exact", head: true })
      .eq("on_duty", true);

    // Count complaints opened today
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