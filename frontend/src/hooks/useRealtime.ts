import { useEffect } from "react";
import { SOCKET_ENABLED } from "@/lib/backend";
import { subscribe, type Subscription } from "@/lib/realtime";
import { syncPendingGps } from "@/lib/driver-location";
import { useTrucks } from "@/store/trucks";
import { startLiveTracking, type LiveScope } from "@/lib/live-tracking";

/**
 * Opens (or reuses) the single Socket.IO connection and subscribes this view
 * to the truck stream it needs. Also drains the offline write queue whenever
 * the connection returns.
 */
export function useRealtime(sub: Subscription | null) {
  const key = sub ? JSON.stringify(sub) : null;
  useEffect(() => {
    if (!key) return;
    const parsed = JSON.parse(key) as Subscription;
    if (SOCKET_ENABLED) {
      subscribe(parsed);
      return;
    }
    // Shirpur Cloud transport: PostGIS nearest_trucks + realtime invalidation.
    const scope: LiveScope =
      parsed.role === "resident"
        ? { lat: parsed.lat, lng: parsed.lng, radiusM: parsed.radiusM }
        : { all: true };
    return startLiveTracking(scope);
  }, [key]);

  const connection = useTrucks((s) => s.connection);
  useEffect(() => {
    if (connection !== "live") return;
    void syncPendingGps();
  }, [connection]);
}
