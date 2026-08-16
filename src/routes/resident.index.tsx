import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientOnly } from "@/components/ClientOnly";
import { TruckMap } from "@/components/TruckMap";
import { BottomSheet } from "@/components/BottomSheet";
import { BellIcon, ClockIcon, TruckIcon, ChevronLeft } from "@/components/icons";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { useTruckEta } from "@/hooks/useTruckEta";
import { useToast } from "@/components/Toast";
import { useTrucks } from "@/store/trucks";
import { SHIRPUR } from "@/lib/trucks";
import { haversine, type LatLng } from "@/lib/geo";
import { useFormat } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/resident/")({
  head: () => ({
    meta: [
      { title: "Resident Live Tracking — CleanTrack" },
      {
        name: "description",
        content:
          "See where your garbage truck is right now, how far away it is, and when it will reach your street in Shirpur.",
      },
      { property: "og:title", content: "Resident Live Tracking — CleanTrack" },
      {
        property: "og:description",
        content: "Live truck position, distance and ETA for your street in Shirpur.",
      },
    ],
  }),
  component: ResidentHome,
});

type ZoneState = "EnRoute" | "Nearby" | "Arriving" | "Leaving";

/** Use real device geolocation, falling back to city center. */
function useResidentLocation(): { location: LatLng; gpsAvailable: boolean } {
  const [location, setLocation] = useState<LatLng>(SHIRPUR);
  const [gpsAvailable, setGpsAvailable] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsAvailable(true);
      },
      () => setGpsAvailable(false),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return { location, gpsAvailable };
}

/* ── zone config ── */
const ZONE_STYLE: Record<ZoneState, {
  bg: string; text: string; icon: string; pillBg: string; pillText: string; pulse: boolean;
}> = {
  Arriving: {
    bg: "bg-emerald-600", text: "text-white", icon: "🚛",
    pillBg: "bg-[#DCFCE7]", pillText: "text-[#15803D]", pulse: true,
  },
  Nearby: {
    bg: "bg-amber-500", text: "text-slate-900", icon: "🚚",
    pillBg: "bg-[#FEF9C3]", pillText: "text-[#854D0E]", pulse: true,
  },
  Leaving: {
    bg: "bg-red-500", text: "text-white", icon: "📍",
    pillBg: "bg-[#FEE2E2]", pillText: "text-[#991B1B]", pulse: false,
  },
  EnRoute: {
    bg: "bg-slate-800", text: "text-white", icon: "🗺️",
    pillBg: "bg-neutral-100", pillText: "text-neutral-600", pulse: false,
  },
};

function ResidentHome() {
  const navigate = useNavigate();
  const tr = useT();
  const fmt = useFormat();
  const session = useAuth((s) => s.session)!;
  const city = session.role === "resident" ? session.city : "Shirpur";
  const { location: resident, gpsAvailable } = useResidentLocation();
  const radius = useSettings((s) => s.alertRadius);
  const notifEnabled = useSettings((s) => s.notificationsEnabled);
  const setNotif = useSettings((s) => s.setNotifications);
  const push = useToast((s) => s.push);
  const connection = useTrucks((s) => s.connection);

  // Pick nearest online truck (re-evaluated every tick)
  useTrucks((s) => s.tick);
  const trucks = useTrucks((s) => s.trucks);
  const nearest = useMemo(() => {
    const cands = Object.values(trucks).filter((t) => t.truck.city === city && t.status !== "offline");
    if (cands.length === 0) return Object.values(trucks).filter((t) => t.truck.city === city)[0];
    return cands.reduce((best, cur) =>
      haversine(cur.position, resident) < haversine(best.position, resident) ? cur : best,
    );
  }, [trucks, city, resident]);

  const distance = nearest ? haversine(nearest.position, resident) : 0;
  // Backend (OSRM) road-network ETA; falls back to the straight-line estimate.
  const backendEta = useTruckEta(nearest?.truck.id, resident);
  const etaLabel = backendEta ? fmt.duration(backendEta.durationS) : fmt.eta(distance);
  const distanceLabel = backendEta ? fmt.distance(backendEta.distanceM) : fmt.distance(distance);
  const insideArriving = distance < radius * 0.3;
  const insideNearby = distance < radius;

  // Speed in km/h from the nearest truck
  const speedKmh = nearest ? Math.round((nearest.speedMps ?? 0) * 3.6) : 0;
  // Stop progress
  const stopProgress = nearest ? (nearest.completedStops / nearest.truck.totalStops) * 100 : 0;

  // Zone & notification machine
  const prevZone = useRef<ZoneState>("EnRoute");
  const lastNotifAt = useRef<Record<string, number>>({});
  const [currentZone, setCurrentZone] = useState<ZoneState>("EnRoute");

  useEffect(() => {
    if (!nearest) return;
    let zone: ZoneState = "EnRoute";
    if (insideArriving) zone = "Arriving";
    else if (insideNearby) zone = "Nearby";
    else if (prevZone.current === "Nearby" || prevZone.current === "Arriving") zone = "Leaving";

    if (zone !== prevZone.current) {
      const now = Date.now();
      const can = (key: string) => {
        if ((now - (lastNotifAt.current[key] ?? 0)) < 60_000) return false;
        lastNotifAt.current[key] = now;
        return true;
      };
      if (zone === "Nearby" && can("nearby")) {
        push({ title: `${tr("Truck is")} ${fmt.distance(distance)} ${tr("away")}`, subtitle: tr("Head outside soon") });
        fireBrowserNotif(notifEnabled, tr("Truck nearby"), `${nearest.truck.id} · ${fmt.distance(distance)}`);
      }
      if (zone === "Arriving" && can("arriving")) {
        push({ title: tr("Truck is almost here!"), subtitle: tr("Go outside now") });
        fireBrowserNotif(notifEnabled, tr("Truck arriving"), `${nearest.truck.id}`);
      }
      if (zone === "Leaving" && can("leaving")) {
        push({ title: tr("Truck has passed"), subtitle: tr("Check schedule for next pickup") });
      }
      prevZone.current = zone;
      setCurrentZone(zone);
    }
  }, [distance, insideArriving, insideNearby, nearest, push, notifEnabled]);

  const zs = ZONE_STYLE[currentZone];

  return (
    <div className="absolute inset-0">
      <h1 className="sr-only">Live garbage truck tracking for your street</h1>
      {/* Map */}
      <div className="absolute inset-0">
        <ClientOnly fallback={<MapSkeleton />}>
          <TruckMap mode="resident" resident={resident} radius={radius} activeTruckId={nearest?.id} />
        </ClientOnly>
      </div>

      {/* ── Top Navigation Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-[500] pointer-events-none">
        <div className="flex flex-col gap-2 p-3">
          {/* Row 1: Back + Connection + GPS */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => navigate({ to: "/role" })}
              className="pointer-events-auto w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-lg grid place-items-center shrink-0"
              aria-label={tr("Back")}
            >
              <ChevronLeft />
            </button>
            <div className="pointer-events-auto flex items-center gap-2">
              {!gpsAvailable && (
                <div className="ct-pill bg-red-50 text-red-700 border border-red-200 shadow-md text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  {tr("GPS Off")}
                </div>
              )}
              <ConnectionPill connection={connection} />
            </div>
          </div>

          {/* Row 2: Zone Status Banner */}
          {nearest && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentZone}
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`pointer-events-auto ${zs.bg} rounded-2xl shadow-2xl p-3.5 flex items-center justify-between`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-white/20 grid place-items-center text-xl shrink-0">
                    {zs.pulse ? (
                      <span className="animate-pulse">{zs.icon}</span>
                    ) : (
                      <span>{zs.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[10px] uppercase tracking-wider font-bold ${zs.text} opacity-80 flex items-center gap-1.5`}>
                      {zs.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                      {currentZone === "EnRoute" && tr("Truck En Route")}
                      {currentZone === "Nearby" && tr("Truck Nearby")}
                      {currentZone === "Arriving" && tr("Truck Arriving!")}
                      {currentZone === "Leaving" && tr("Truck Passed")}
                    </div>
                    <div className={`text-sm font-bold ${zs.text} truncate mt-0.5`}>
                      {currentZone === "Arriving" ? tr("Go outside now!") : `${distanceLabel} ${tr("away")} · ${etaLabel}`}
                    </div>
                  </div>
                </div>
                {/* Speed badge on banner */}
                {speedKmh > 0 && nearest.status !== "offline" && (
                  <div className="shrink-0 ml-2 bg-white/20 rounded-xl px-2.5 py-1.5 text-center">
                    <div className={`text-base font-bold ${zs.text} leading-none`}>{speedKmh}</div>
                    <div className={`text-[9px] ${zs.text} opacity-70 font-semibold`}>km/h</div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Floating Navigation ETA Card (bottom-right, above bottom sheet) ── */}
      {nearest && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
          className="absolute bottom-32 right-3 z-[500] pointer-events-none"
        >
          <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl p-3 w-[140px]">
            <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {tr("ETA")}
            </div>
            <div className="text-xl font-bold text-white leading-tight mt-0.5">
              {etaLabel}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{distanceLabel}</div>
            {/* Mini progress bar */}
            <div className="mt-2 h-1 rounded-full bg-slate-700 overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                animate={{ width: `${Math.min(stopProgress, 100)}%` }}
                transition={{ type: "spring", stiffness: 120 }}
              />
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              {nearest.completedStops}/{nearest.truck.totalStops} {tr("stops")}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Bottom Sheet ── */}
      {nearest && (
        <BottomSheet springKey={currentZone} peekHeight={120}>
          <div className="px-5 pb-5 pt-1">
            {/* Row 1: truck + name/route + zone pill */}
            <div className="flex items-center gap-3">
              <div className="relative w-[60px] h-[48px] rounded-2xl bg-brand-soft text-brand grid place-items-center shrink-0">
                <TruckIcon className="w-6 h-6" />
                {nearest.status !== "offline" && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink text-[17px] truncate">
                  {nearest.truck.name}
                </div>
                <div className="text-xs text-neutral-500 truncate mt-0.5">
                  {tr("Route")} {nearest.truck.id} · {nearest.truck.wardName.split("—")[0].trim()}
                </div>
              </div>
              <div className={`ct-pill ${zs.pillBg} ${zs.pillText} shrink-0`}>
                {zs.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1" />}
                {tr(currentZone === "EnRoute" ? "En Route" : currentZone)}
              </div>
            </div>

            {/* Row 2: Distance / ETA / Speed cards */}
            <div className="mt-4 rounded-2xl bg-neutral-50 grid grid-cols-3 overflow-hidden">
              <div className="p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{tr("Distance")}</div>
                <div className="text-lg font-bold text-ink mt-0.5">{distanceLabel}</div>
              </div>
              <div className="p-3 border-l border-neutral-200/70">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{tr("ETA")}</div>
                <div className="text-lg font-bold text-ink mt-0.5">{etaLabel}</div>
              </div>
              <div className="p-3 border-l border-neutral-200/70">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{tr("Speed")}</div>
                <div className="text-lg font-bold text-ink mt-0.5">
                  {speedKmh > 0 ? `${speedKmh}` : "—"}<span className="text-xs text-neutral-400 ml-0.5">km/h</span>
                </div>
              </div>
            </div>

            {/* Route progress bar */}
            <div className="mt-3 p-3 rounded-xl bg-neutral-50">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500 font-medium">{tr("Route Progress")}</span>
                <span className="text-ink font-bold">{nearest.completedStops}/{nearest.truck.totalStops} {tr("stops")}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-neutral-200 overflow-hidden">
                <motion.div
                  className="h-full bg-brand rounded-full"
                  animate={{ width: `${Math.min(stopProgress, 100)}%` }}
                  transition={{ type: "spring", stiffness: 120 }}
                />
              </div>
            </div>

            {/* Ward / service info */}
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-500">
              <ClockIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tr("Municipal waste collection service")} · {nearest.truck.wardName.split("—")[0].trim()}</span>
            </div>

            {/* Notification toggle row */}
            <div className="mt-4 flex items-center gap-3 py-3 border-t border-neutral-100">
              <BellIcon className="w-5 h-5 text-ink shrink-0" />
              <div className="flex-1 text-sm text-ink">{tr("Alert me when truck is near")}</div>
              <Toggle
                on={notifEnabled}
                onChange={(v) => {
                  setNotif(v);
                  if (v && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                    Notification.requestPermission().catch(() => {});
                  }
                }}
              />
            </div>

            {/* CTA */}
            <button
              disabled={!insideNearby}
              className={`w-full h-14 rounded-2xl font-semibold text-[15px] transition-all duration-300 ${
                insideArriving
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 animate-pulse"
                  : insideNearby
                  ? "bg-ink text-white shadow-lg shadow-black/20"
                  : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {insideArriving
                ? `🚛 ${tr("Truck is here! Go outside")}`
                : insideNearby
                ? tr("I'm Coming")
                : `${tr("Truck is")} ${fmt.distance(distance)} ${tr("away")}`}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function ConnectionPill({ connection }: { connection: "live" | "reconnecting" }) {
  const tr = useT();
  const live = connection === "live";
  return (
    <div
      className={`pointer-events-auto ct-pill shadow-md ${
        live ? "bg-white/95 backdrop-blur-sm text-ink" : "bg-[#FEF3C7] text-[#92400E]"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${live ? "bg-brand" : "bg-[#F59E0B] animate-pulse"}`}
      />
      {live ? tr("Live") : tr("Reconnecting")}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full relative transition-colors ${on ? "bg-brand" : "bg-neutral-300"}`}
      aria-label="toggle"
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-0.5 ${on ? "right-0.5" : "left-0.5"} w-5 h-5 rounded-full bg-white shadow`}
      />
    </button>
  );
}

function fireBrowserNotif(enabled: boolean, title: string, body: string) {
  if (!enabled || typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch {}
  }
}

function MapSkeleton() {
  return <div className="absolute inset-0 bg-neutral-100 animate-pulse" />;
}