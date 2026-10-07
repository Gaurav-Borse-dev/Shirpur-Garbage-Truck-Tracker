import { useEffect, useState } from "react";
import { getTruckEta } from "@/lib/tracking.functions";
import type { LatLng } from "@/lib/geo";

export type BackendEta = { durationS: number; distanceM: number } | null;

/**
 * Backend-calculated (OSRM road network) ETA from a truck's live position to a resident point.
 * Refreshes on position changes and periodic interval; cached server-side.
 */
export function useTruckEta(
  truckCode: string | undefined,
  to: LatLng,
  truckPos?: LatLng,
) {
  const [eta, setEta] = useState<BackendEta>(null);

  const fromPart = truckPos
    ? `${truckPos.lat.toFixed(4)},${truckPos.lng.toFixed(4)}`
    : "live";
  const toPart = `${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const key = truckCode ? `${truckCode}@${fromPart}->${toPart}` : null;

  useEffect(() => {
    if (!key || !truckCode) {
      setEta(null);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const res = await getTruckEta({
          data: {
            truckCode,
            lat: to.lat,
            lng: to.lng,
            ...(truckPos ? { truckLat: truckPos.lat, truckLng: truckPos.lng } : {}),
          },
        });
        if (cancelled) return;
        setEta(res.available ? { durationS: res.durationS, distanceM: res.distanceM } : null);
      } catch {
        if (!cancelled) setEta(null);
      }
    }

    void load();
    const timer = window.setInterval(load, 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [key, truckCode, to.lat, to.lng, truckPos?.lat, truckPos?.lng]);

  return eta;
}