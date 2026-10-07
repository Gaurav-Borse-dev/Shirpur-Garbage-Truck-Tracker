import { eventHandler, getQuery } from "h3";

function parseWkbPoint(hex: string): { lat: number; lng: number } | null {
  if (!hex || hex.length < 50) return null;
  try {
    const buf = Buffer.from(hex, "hex");
    const isLE = buf[0] === 1;
    const lng = isLE ? buf.readDoubleLE(9) : buf.readDoubleBE(9);
    const lat = isLE ? buf.readDoubleLE(17) : buf.readDoubleBE(17);
    return { lat, lng };
  } catch {
    return null;
  }
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

/**
 * GET /api/trucks/locations — returns truck live locations with coordinates,
 * heading, speed, and status.
 */
export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const lat = Number(query.lat) || 21.3483;
    const lng = Number(query.lng) || 74.8827;
    const radiusM = Number(query.radiusM) || 50000;
    const includeOffline = query.includeOffline !== "false";

    const { supabaseAdmin } = await import("../../../src/integrations/supabase/client.server");

    // 1. First attempt: PostGIS nearest_trucks RPC (finds active/collecting trucks)
    const { data: rows, error } = await supabaseAdmin.rpc("nearest_trucks", {
      _lat: lat,
      _lng: lng,
      _radius_m: radiusM,
      _limit: 50,
    });

    if (error) {
      console.warn("[api/trucks/locations] RPC error:", error.message);
    }

    if (rows && rows.length > 0) {
      return {
        success: true,
        count: rows.length,
        source: "postgis_rpc",
        data: rows.map((r: any) => ({
          truckId: r.truck_code,
          status: r.status,
          lat: r.lat,
          lng: r.lng,
          heading: r.heading,
          speedKmh: r.speed_kmh,
          distanceM: r.distance_m,
          fixedAt: r.fixed_at,
        })),
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Fallback: If no trucks currently collecting or includeOffline is true,
    // query truck_live_location directly so frontend/monitoring still gets accurate fleet fixes
    if (includeOffline) {
      const { data: locRows, error: locErr } = await supabaseAdmin
        .from("truck_live_location")
        .select("*, trucks(truck_code, status)")
        .order("fixed_at", { ascending: false });

      if (!locErr && locRows && locRows.length > 0) {
        const mapped = locRows
          .map((r: any) => {
            const coords = parseWkbPoint(r.location);
            if (!coords) return null;
            const dist = haversineM(lat, lng, coords.lat, coords.lng);
            if (dist > radiusM) return null;
            return {
              truckId: r.trucks?.truck_code ?? "UNKNOWN",
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

        return {
          success: true,
          count: mapped.length,
          source: "live_location_store",
          data: mapped,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      success: true,
      count: 0,
      data: [],
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[api/trucks/locations] Exception:", err);
    return { success: false, error: err?.message || "Internal server error", data: [] };
  }
});
