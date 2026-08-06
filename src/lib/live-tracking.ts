/**
 * Lovable Cloud live-tracking transport.
 *
 * Positions come from PostGIS (`nearest_trucks`) — nothing is simulated. A
 * realtime subscription on `truck_live_location` nudges an immediate refetch
 * so residents see movement the moment a driver's GPS lands, with a slow poll
 * as the safety net when the socket is down.
 */
import { supabase } from "@/integrations/supabase/client";
import { getNearbyTrucks } from "@/lib/tracking.functions";
import { useTrucks, type TruckFix } from "@/store/trucks";

export type LiveScope = { all: true } | { lat: number; lng: number; radiusM: number };

const POLL_MS = 4000;
const MIN_GAP_MS = 1200;

function toFix(t: {
  truckCode: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  fixedAt: string;
  status: string;
}): TruckFix {
  return {
    truckId: t.truckCode,
    lat: t.lat,
    lng: t.lng,
    heading: t.heading,
    speed: (t.speedKmh ?? 0) / 3.6,
    ts: t.fixedAt,
    status: t.status === "offline" ? "offline" : t.status === "collecting" ? "collecting" : "online",
  };
}

/** Starts streaming live fixes for a scope. Returns a teardown function. */
export function startLiveTracking(scope: LiveScope): () => void {
  if (typeof window === "undefined") return () => {};

  const query =
    "all" in scope
      ? { lat: 21.3483, lng: 74.8827, radiusM: 100000, limit: 50 }
      : { lat: scope.lat, lng: scope.lng, radiusM: Math.round(scope.radiusM), limit: 50 };

  let stopped = false;
  let inFlight = false;
  let lastAt = 0;

  async function refresh() {
    if (stopped || inFlight || Date.now() - lastAt < MIN_GAP_MS) return;
    inFlight = true;
    try {
      const res = await getNearbyTrucks({ data: query });
      if (stopped) return;
      lastAt = Date.now();
      useTrucks.getState().setConnection(res.error ? "reconnecting" : "live");
      if (res.trucks.length) useTrucks.getState().ingestFixes(res.trucks.map(toFix));
    } catch {
      if (!stopped) useTrucks.getState().setConnection("reconnecting");
    } finally {
      inFlight = false;
    }
  }

  void refresh();
  const timer = window.setInterval(refresh, POLL_MS);

  const channel = supabase
    .channel(`truck-live-${"all" in scope ? "all" : `${query.lat},${query.lng}`}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "truck_live_location" }, () => {
      void refresh();
    })
    .subscribe();

  return () => {
    stopped = true;
    window.clearInterval(timer);
    void supabase.removeChannel(channel);
  };
}