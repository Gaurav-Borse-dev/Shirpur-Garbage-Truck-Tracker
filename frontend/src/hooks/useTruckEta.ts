import { useEffect, useState } from "react";
import { getTruckEta } from "@/lib/tracking.functions";

export type BackendEta = { durationS: number; distanceM: number } | null;

/**
 * Backend-calculated (OSRM road network) ETA from a truck to a point.
 * Refreshes on a slow interval; results are cached server-side.
 */
export function useTruckEta(truckCode: string | undefined, to: { lat: number; lng: number }) {
  const [eta, setEta] = useState<BackendEta>(null);
  const key = truckCode ? `${truckCode}:${to.lat.toFixed(4)}:${to.lng.toFixed(4)}` : null;

  useEffect(() => {
    if (!key) {
      setEta(null);
      return;
    }
    const [code, lat, lng] = key.split(":");
    let cancelled = false;

    async function load() {
      try {
        const res = await getTruckEta({ data: { truckCode: code, lat: Number(lat), lng: Number(lng) } });
        if (cancelled) return;
        setEta(res.available ? { durationS: res.durationS, distanceM: res.distanceM } : null);
      } catch {
        if (!cancelled) setEta(null);
      }
    }

    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [key]);

  return eta;
}