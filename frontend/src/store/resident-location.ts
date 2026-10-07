import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect } from "react";
import { SHIRPUR } from "@/lib/trucks";
import type { LatLng } from "@/lib/geo";

type ResidentLocationState = {
  location: LatLng;
  accuracyM: number | null;
  isGpsReady: boolean;
  setLocation: (loc: LatLng, accuracyM?: number | null) => void;
};

export const useResidentLocationStore = create<ResidentLocationState>()(
  persist(
    (set) => ({
      location: SHIRPUR,
      accuracyM: null,
      isGpsReady: false,
      setLocation: (loc, accuracyM = null) =>
        set({
          location: {
            lat: Number(loc.lat.toFixed(6)),
            lng: Number(loc.lng.toFixed(6)),
          },
          accuracyM,
          isGpsReady: true,
        }),
    }),
    {
      name: "ct-resident-location",
      partialize: (state) => ({ location: state.location }),
    },
  ),
);

let activeWatchId: number | null = null;
let watcherRefCount = 0;

function startResidentWatcher() {
  if (typeof window === "undefined" || !("geolocation" in navigator)) return;
  watcherRefCount++;
  if (activeWatchId !== null) return;

  const onPos = (pos: GeolocationPosition) => {
    useResidentLocationStore.getState().setLocation(
      { lat: pos.coords.latitude, lng: pos.coords.longitude },
      pos.coords.accuracy,
    );
  };

  // 1. Instant fix via getCurrentPosition
  navigator.geolocation.getCurrentPosition(
    onPos,
    () => {
      // Fallback with low accuracy
      navigator.geolocation.getCurrentPosition(onPos, () => {}, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      });
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
  );

  // 2. High-accuracy continuous tracking
  activeWatchId = navigator.geolocation.watchPosition(
    onPos,
    (err) => console.warn("[resident-gps] Geolocation watch warning:", err.message),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 },
  );
}

function stopResidentWatcher() {
  watcherRefCount = Math.max(0, watcherRefCount - 1);
  if (watcherRefCount === 0 && activeWatchId !== null) {
    navigator.geolocation.clearWatch(activeWatchId);
    activeWatchId = null;
  }
}

/** Hook for consuming the shared high-accuracy resident position */
export function useResidentLocation() {
  const location = useResidentLocationStore((s) => s.location);
  const accuracyM = useResidentLocationStore((s) => s.accuracyM);
  const isGpsReady = useResidentLocationStore((s) => s.isGpsReady);

  useEffect(() => {
    startResidentWatcher();
    return () => stopResidentWatcher();
  }, []);

  return { location, accuracyM, isGpsReady };
}
