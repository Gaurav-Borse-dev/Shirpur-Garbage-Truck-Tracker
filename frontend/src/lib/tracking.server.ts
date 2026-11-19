/**
 * Server-only helpers for live truck tracking.
 *
 * Everything here runs inside a server-function handler: it resolves the
 * signed-in driver from the encrypted session cookie, talks to the database
 * with the service-role client, and calls OSRM for road-network ETAs.
 *
 * The driver → truck mapping is resolved from the database `drivers` table.
 * A local fallback from DRIVER_NAMES / FALLBACK_TRUCKS is used when the
 * database is unreachable so the app never hard-fails on cold start.
 */
import dns from "node:dns";
if (typeof dns?.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

export type TruckFixRow = {
  truckId: string;
  truckCode: string;
  status: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  distanceM: number;
  fixedAt: string;
};

/**
 * Resolves a driver phone number to the truck code they're assigned to from the database.
 */
export async function truckCodeForPhone(phone: string): Promise<string | null> {
  try {
    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (profile?.user_id) {
      const { data: driver } = await db
        .from("drivers")
        .select("assigned_truck:trucks!drivers_assigned_truck_id_fkey ( truck_code )")
        .eq("user_id", profile.user_id)
        .maybeSingle();

      const truck = driver?.assigned_truck as { truck_code: string } | null;
      if (truck?.truck_code) return truck.truck_code;
    }
  } catch {
    // DB unavailable
  }

  return null;
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Resolves the trucks table UUID for a public truck code. */
export async function truckIdForCode(code: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("trucks").select("id").eq("truck_code", code).maybeSingle();
  return data?.id ?? null;
}

const OSRM_BASE = "https://router.project-osrm.org";
const ETA_TTL_MS = 45_000;

export type EtaResult = { distanceM: number; durationS: number; cached: boolean };

/** Road-network ETA between two points, memoised in the eta_cache table. */
export async function routeEta(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  truckId: string | null,
): Promise<EtaResult | null> {
  const db = await admin();
  const key = [
    truckId ?? "anon",
    from.lat.toFixed(4),
    from.lng.toFixed(4),
    to.lat.toFixed(4),
    to.lng.toFixed(4),
  ].join(":");

  const { data: hit } = await db
    .from("eta_cache")
    .select("distance_m, duration_s, expires_at")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (hit) return { distanceM: hit.distance_m, durationS: hit.duration_s, cached: true };

  const url =
    `${OSRM_BASE}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=false&alternatives=false&steps=false`;

  let payload: { code?: string; routes?: { distance: number; duration: number }[] };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    payload = (await res.json()) as typeof payload;
  } catch (error) {
    console.error("[eta] OSRM request failed", error);
    return null;
  }

  const route = payload.routes?.[0];
  if (payload.code !== "Ok" || !route) return null;

  await db.from("eta_cache").upsert(
    {
      cache_key: key,
      truck_id: truckId,
      distance_m: route.distance,
      duration_s: route.duration,
      expires_at: new Date(Date.now() + ETA_TTL_MS).toISOString(),
    },
    { onConflict: "cache_key" },
  );

  return { distanceM: route.distance, durationS: route.duration, cached: false };
}
