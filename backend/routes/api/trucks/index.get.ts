import { eventHandler, setResponseStatus } from "h3";

/**
 * GET /api/trucks — returns the truck fleet from the database.
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
    const { data: rows, error } = await supabaseAdmin
      .from("trucks")
      .select("id, truck_code, registration_no, status, capacity_kg, ward, photo_url")
      .order("truck_code", { ascending: true });

    if (error) {
      console.error("[api/trucks] DB query failed:", error.message);
      setResponseStatus(event, 502);
      return { success: false, error: "Database query failed", timestamp: new Date().toISOString() };
    }

    return {
      success: true,
      count: rows.length,
      source: "database",
      data: rows.map((r) => ({
        id: r.truck_code,
        dbId: r.id,
        registrationNo: r.registration_no,
        status: r.status,
        capacityKg: r.capacity_kg,
        ward: r.ward,
        photoUrl: r.photo_url,
      })),
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[api/trucks] Unexpected error:", err);
    setResponseStatus(event, 500);
    return { success: false, error: "Internal server error", timestamp: new Date().toISOString() };
  }
});
