import { eventHandler, setResponseStatus } from "h3";

type DriverRow = {
  id: string;
  user_id: string;
  license_no: string;
  on_duty: boolean;
  duty_state: string;
  assigned_truck_id: string | null;
  duty_started_at: string | null;
  last_heartbeat: string | null;
  trip_distance_m: number;
  assigned_truck: { truck_code: string; ward: string | null } | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string;
  phone: string | null;
};

/**
 * GET /api/drivers — returns the driver roster from the database.
 * Falls back to a minimal static list if Supabase is unavailable.
 */
export default eventHandler(async (event) => {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!url || !key) {
      return {
        success: true,
        count: 0,
        source: "unconfigured",
        data: [],
        timestamp: new Date().toISOString(),
      };
    }

    const { supabaseAdmin } = await import("../../../src/integrations/supabase/client.server");

    // Fetch drivers with their assigned truck info
    const { data: drivers, error } = await supabaseAdmin
      .from("drivers")
      .select(`
        id, user_id, license_no, on_duty, duty_state,
        assigned_truck_id, duty_started_at, last_heartbeat, trip_distance_m,
        assigned_truck:trucks!drivers_assigned_truck_id_fkey ( truck_code, ward )
      `)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[api/drivers] DB query failed:", error.message);
      setResponseStatus(event, 502);
      return { success: false, error: "Database query failed", timestamp: new Date().toISOString() };
    }

    const typedDrivers = (drivers ?? []) as unknown as DriverRow[];

    // Fetch profiles to get names and phones
    const userIds = typedDrivers.map((d) => d.user_id);
    const { data: profiles } = userIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", userIds)
      : { data: [] as ProfileRow[] };

    const profileMap = new Map(
      ((profiles ?? []) as unknown as ProfileRow[]).map((p) => [p.user_id, { name: p.full_name, phone: p.phone }]),
    );

    return {
      success: true,
      count: typedDrivers.length,
      source: "database",
      data: typedDrivers.map((d) => {
        const profile = profileMap.get(d.user_id);
        const truck = d.assigned_truck;
        return {
          dbId: d.id,
          name: profile?.name ?? "Unknown",
          phone: profile?.phone ?? "",
          licenseNo: d.license_no,
          onDuty: d.on_duty,
          dutyState: d.duty_state,
          assignedTruckCode: truck?.truck_code ?? null,
          assignedTruckWard: truck?.ward ?? null,
          dutyStartedAt: d.duty_started_at,
          lastHeartbeat: d.last_heartbeat,
          tripDistanceM: d.trip_distance_m,
        };
      }),
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[api/drivers] Unexpected error:", err);
    setResponseStatus(event, 500);
    return { success: false, error: "Internal server error", timestamp: new Date().toISOString() };
  }
});
