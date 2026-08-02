import { useEffect } from "react";
import { LIVE_BACKEND } from "@/lib/backend";
import { subscribe, type Subscription } from "@/lib/realtime";
import { syncPendingGps } from "@/lib/driver-location";
import { useTrucks } from "@/store/trucks";

/**
 * Opens (or reuses) the single Socket.IO connection and subscribes this view
 * to the truck stream it needs. Also drains the offline write queue whenever
 * the connection returns.
 */
export function useRealtime(sub: Subscription | null) {
  const key = sub ? JSON.stringify(sub) : null;
  useEffect(() => {
    if (!LIVE_BACKEND || !key) return;
    subscribe(JSON.parse(key) as Subscription);
  }, [key]);

  const connection = useTrucks((s) => s.connection);
  useEffect(() => {
    if (!LIVE_BACKEND || connection !== "live") return;
    void syncPendingGps();
  }, [connection]);
}