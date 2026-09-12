import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MobileFrame } from "@/components/MobileFrame";
import { ClientOnly } from "@/components/ClientOnly";
import { TruckMap } from "@/components/TruckMap";
import { BottomSheet } from "@/components/BottomSheet";
import { ChevronDown, CheckIcon, LogoutIcon } from "@/components/icons";
import { useAuth } from "@/store/auth";
import { useTrucks } from "@/store/trucks";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/hooks/useRealtime";
import { LIVE_BACKEND } from "@/lib/backend";
import { startDriverLocation, stopDriverLocation } from "@/lib/driver-location";
import { emitDriverDuty } from "@/lib/realtime";
import { RequireRole } from "@/components/RequireRole";
import { serverSignOut } from "@/lib/auth.functions";
import { installNativeTokenBridge, registerThisDevice } from "@/lib/push-client";
import { SHIRPUR } from "@/lib/trucks";
import { ingestDriverGps } from "@/lib/tracking.functions";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [
      { title: "Driver Route & Stops — CleanTrack" },
      {
        name: "description",
        content:
          "Driver app for Shirpur collection crews: go online, share live GPS, and mark each collection stop as en route, arrived or completed.",
      },
      { property: "og:title", content: "Driver Route & Stops — CleanTrack" },
      {
        property: "og:description",
        content: "Share live location and manage your collection stops on the CleanTrack driver app.",
      },
    ],
  }),
  component: DriverRoute,
});

function DriverRoute() {
  return (
    <RequireRole role="driver" redirectTo="/role">
      <DriverHome />
    </RequireRole>
  );
}

type StopStatus = "enroute" | "arrived" | "completed";

function DriverHome() {
  const tr = useT();
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  if (!session || session.role !== "driver") return <Navigate to="/role" />;

  const truckId = session.truckId;
  const live = useTrucks((s) => s.trucks[truckId]);
  const setOnline = useTrucks((s) => s.setDriverOnline);
  const complete = useTrucks((s) => s.completeStop);
  const connection = useTrucks((s) => s.connection);
  const push = useToast((s) => s.push);

  const [stopStatus, setStopStatus] = useState<StopStatus>("enroute");
  const [expanded, setExpanded] = useState(false);

  useRealtime({ role: "driver", truckId });
  // Mobile wrapper path: the native shell supplies the FCM token, so no VAPID
  // key or Firebase web config is needed here.
  useEffect(() => {
    installNativeTokenBridge();
    void registerThisDevice({ requirePermission: false });
  }, []);
  const onDuty = useTrucks((s) => s.trucks[truckId]?.status) !== "offline";
  useEffect(() => {
    if (!LIVE_BACKEND) return;
    if (onDuty) {
      emitDriverDuty(truckId, "start");
      void startDriverLocation(truckId);
    } else {
      emitDriverDuty(truckId, "stop");
      void stopDriverLocation();
    }
    return () => { void stopDriverLocation(); };
  }, [onDuty, truckId]);

  useEffect(() => {
    if (!live && truckId) {
      useTrucks.getState().ingestFixes([{
        truckId,
        lat: SHIRPUR.lat + 0.009,
        lng: SHIRPUR.lng,
        heading: 180,
        speed: 0,
        status: "online",
        ts: Date.now(),
      }]);
    }
  }, [live, truckId]);

  const [simActive, setSimActive] = useState(false);
  const [simStep, setSimStep] = useState(0);

  // Realistic route coordinates starting north of Shirpur, approaching city center & resident
  const SIM_WAYPOINTS = [
    { lat: 21.3585, lng: 74.8827, label: "Ward Entrance (1.1 km away)", tone: "enroute" },
    { lat: 21.3540, lng: 74.8827, label: "Main Road (600m away)", tone: "enroute" },
    { lat: 21.3508, lng: 74.8827, label: "Street Corner (280m - Nearby Radius!)", tone: "nearby" },
    { lat: 21.3490, lng: 74.8827, label: "House Turn (80m - Arriving!)", tone: "arriving" },
    { lat: 21.3483, lng: 74.8827, label: "Collection Point (At Resident)", tone: "arrived" },
  ];

  const triggerGpsFix = (lat: number, lng: number, speedMps = 6.9, heading = 180) => {
    useTrucks.getState().ingestFixes([{
      truckId,
      lat,
      lng,
      heading,
      speed: speedMps,
      status: "online",
      ts: Date.now(),
    }]);
    void ingestDriverGps({
      data: {
        truckCode: truckId,
        lat,
        lng,
        heading,
        speedKmh: speedMps * 3.6,
      },
    }).catch(() => {});
  };

  useEffect(() => {
    if (!simActive) return;
    const interval = setInterval(() => {
      setSimStep((prev) => {
        const next = (prev + 1) % SIM_WAYPOINTS.length;
        const pt = SIM_WAYPOINTS[next];
        triggerGpsFix(pt.lat, pt.lng, 7.5, 180);
        push({
          title: `Simulated Drive: ${pt.label}`,
          subtitle: `GPS: ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`,
          tone: pt.tone === "arrived" || pt.tone === "arriving" ? "truck_arrived" : "truck_nearby",
          sender: `Truck ${truckId} · GPS Sim`,
        });
        return next;
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [simActive, truckId]);

  if (!live) {
    return (
      <MobileFrame>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
          <div className="font-bold text-slate-800 text-base">Connecting Truck {truckId}…</div>
          <div className="text-xs text-slate-500 mt-1">Initializing Shirpur collection route</div>
        </div>
      </MobileFrame>
    );
  }

  const online = live.status !== "offline";
  const stopNum = Math.min(live.completedStops + 1, live.truck.totalStops);
  const progress = (live.completedStops / live.truck.totalStops) * 100;

  function advance() {
    complete(truckId);
    push({
      title: `${tr("Stop")} ${stopNum} ${tr("Completed")}`,
      subtitle: `${tr("Next Stop")}: ${live?.truck.wardName ?? tr("Shirpur")}`,
      tone: "route_completed",
      sender: `Truck ${truckId} · Crew`,
    });
    setStopStatus("enroute");
  }

  return (
    <MobileFrame>
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0">
          <ClientOnly fallback={<div className="absolute inset-0 bg-neutral-100" />}>
            <TruckMap mode="driver" truckId={truckId} />
          </ClientOnly>
        </div>

        {/* Navigation Top Panel */}
        <div className="absolute top-3 left-3 right-3 z-[500] pointer-events-none flex flex-col gap-2">
          {/* Status & Driver Header Bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-xl px-4 py-2 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 grid place-items-center font-bold text-xs">
                {stopNum}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{tr("Driver Navigation")}</div>
                <div className="text-xs font-bold text-white truncate max-w-[140px]">{session.driverName} · {truckId}</div>
              </div>
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              {connection === "reconnecting" && (
                <div className="ct-pill bg-amber-100 text-amber-900 border border-amber-300 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  {tr("Reconnecting")}
                </div>
              )}
              <div className={`ct-pill ${online ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"} shadow-md`}>
                <span className={`w-2 h-2 rounded-full ${online ? "bg-white" : "bg-slate-400"}`} /> {online ? tr("Online") : tr("Offline")}
              </div>
            </div>
          </div>

          {/* Next Stop Navigation Banner */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="pointer-events-auto bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl border border-slate-800 flex items-center justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {tr("Next Collection Stop")}
              </div>
              <div className="text-sm font-bold text-white truncate mt-0.5">{live.truck.wardName}</div>
              <div className="text-xs text-slate-400 truncate mt-0.5">
                {tr("Collection Point")} #{stopNum} · {tr("Shirpur Ward")}
              </div>
            </div>
            <button
              onClick={advance}
              className="ml-3 shrink-0 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-1"
            >
              <span>{tr("Complete")}</span>
              <CheckIcon className="w-3.5 h-3.5" />
            </button>
          </motion.div>

          {/* GPS Simulation Test Drive Bar */}
          <div className="pointer-events-auto bg-slate-950/95 text-white rounded-2xl p-3 border border-emerald-500/40 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${simActive ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
                <span className="text-xs font-bold text-emerald-400">GPS Drive Simulator</span>
              </div>
              <button
                id="btn-toggle-sim"
                onClick={() => {
                  if (!online) setOnline(truckId, true);
                  setSimActive(!simActive);
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors shadow ${
                  simActive ? "bg-amber-500 hover:bg-amber-600 text-slate-950" : "bg-emerald-500 hover:bg-emerald-600 text-slate-950"
                }`}
              >
                {simActive ? "⏹ Pause Drive" : "▶ Start Drive Simulation"}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-300 flex items-center justify-between">
              <span>Position: <strong className="text-white">{SIM_WAYPOINTS[simStep].label}</strong></span>
              <span className="text-slate-400">Speed: <strong className="text-emerald-300">{simActive ? "27 km/h" : "0 km/h"}</strong></span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800">
              <button
                id="btn-sim-nearby"
                onClick={() => {
                  if (!online) setOnline(truckId, true);
                  setSimStep(2);
                  triggerGpsFix(SIM_WAYPOINTS[2].lat, SIM_WAYPOINTS[2].lng, 6.0, 180);
                  push({
                    title: "Moved into Nearby Radius (280m)",
                    subtitle: "Resident alert & sound chime triggered",
                    tone: "truck_nearby",
                  });
                }}
                className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold flex items-center justify-center gap-1 border border-amber-500/30"
              >
                🔔 Move Nearby (280m)
              </button>
              <button
                id="btn-sim-arriving"
                onClick={() => {
                  if (!online) setOnline(truckId, true);
                  setSimStep(3);
                  triggerGpsFix(SIM_WAYPOINTS[3].lat, SIM_WAYPOINTS[3].lng, 3.5, 180);
                  push({
                    title: "Arrived at Resident Street (80m)",
                    subtitle: "Resident fanfare sound & popup triggered",
                    tone: "truck_arrived",
                  });
                }}
                className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1 border border-emerald-500/30"
              >
                🚛 Move Arriving (80m)
              </button>
            </div>
          </div>
        </div>

        <BottomSheet>
          <div className="px-5 pb-5 pt-2 max-h-[68vh] overflow-y-auto">
            {/* Online toggle */}
            <div className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200">
              <div className="flex-1">
                <div className={`font-bold text-sm ${online ? "text-brand" : "text-neutral-500"}`}>
                  {tr("You are")} {online ? tr("Online").toUpperCase() : tr("Offline").toUpperCase()}
                </div>
                <div className="text-xs text-neutral-500">
                  {online ? tr("Residents can see your location.") : tr("Go online to start broadcasting.")}
                </div>
              </div>
              <button
                onClick={() => setOnline(truckId, !online)}
                className={`w-12 h-7 rounded-full relative transition-colors ${online ? "bg-brand" : "bg-neutral-300"}`}
              >
                <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={`absolute top-0.5 ${online ? "right-0.5" : "left-0.5"} w-6 h-6 rounded-full bg-white shadow`} />
              </button>
            </div>

            {/* Current stop */}
            <div className="mt-3 rounded-2xl border border-neutral-200 border-l-4 border-l-brand p-4">
              <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold">
                {tr("Stop")} {stopNum} {tr("of")} {live.truck.totalStops}
              </div>
              <div className="font-bold text-ink mt-1">{live.truck.wardName}</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {tr("Assigned by Municipal Admin · live sync")}
              </div>
              <div className="text-xs text-neutral-500">{tr("Collection point")} #{stopNum}</div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {(["enroute", "arrived", "completed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      if (s === "completed") {
                        advance();
                      } else {
                        setStopStatus(s);
                        if (s === "arrived") {
                          push({
                            title: `${tr("Arrived at Stop")} #${stopNum}`,
                            subtitle: `${live.truck.wardName} · ${tr("3 residents notified nearby")}`,
                            tone: "truck_arrived",
                            sender: `Truck ${truckId} · Crew`,
                          });
                        }
                      }
                    }}
                    className={`h-10 rounded-lg text-xs font-semibold transition-colors ${
                      stopStatus === s ? "bg-ink text-white" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {s === "enroute" ? tr("En Route") : s === "arrived" ? tr("Arrived") : tr("Completed")}
                  </button>
                ))}
              </div>
              {stopStatus === "arrived" && (
                <div className="mt-3 text-xs text-brand font-semibold">{tr("3 residents notified nearby")}</div>
              )}
            </div>

            {/* Expandable stops */}
            <button
              onClick={() => setExpanded((x) => !x)}
              className="mt-3 flex items-center gap-1 text-sm font-semibold text-ink"
            >
              {expanded ? tr("Hide stops") : tr("View all stops")}
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1.5">
                    {Array.from({ length: live.truck.totalStops }).map((_, i) => {
                      const done = i < live.completedStops;
                      const current = i === live.completedStops;
                      return (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-neutral-100">
                          <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold ${
                            done ? "bg-brand text-white" :
                            current ? "bg-ink text-white" :
                            "bg-neutral-100 text-neutral-400"
                          }`}>
                            {done ? <CheckIcon className="w-3 h-3" /> : i + 1}
                          </div>
                          <div className={`flex-1 text-sm ${done ? "text-neutral-400 line-through" : current ? "font-semibold text-ink" : "text-neutral-600"}`}>
                            {tr("Stop")} {i + 1} · {live.truck.wardName.split("—")[0].trim()}
                          </div>
                          <div className="text-xs text-neutral-400">~{(8 + i * 0.25).toFixed(2).replace(".", ":")} AM</div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-neutral-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">{tr("Today")}</div>
                <div className="text-2xl font-bold text-ink">{live.completedStops}<span className="text-base text-neutral-400">/{live.truck.totalStops}</span></div>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">{tr("Progress")}</div>
                <div className="text-2xl font-bold text-ink">{progress.toFixed(0)}%</div>
              </div>
            </div>

            {/* Route info */}
            <div className="mt-3 p-4 rounded-2xl bg-neutral-50">
              <div className="text-xs font-semibold text-neutral-500">{live.truck.wardName}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{live.completedStops} {tr("of")} {live.truck.totalStops} {tr("stops completed")}</div>
              <div className="mt-2 h-2 rounded-full bg-neutral-200 overflow-hidden">
                <motion.div className="h-full bg-brand" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120 }} />
              </div>
            </div>

            <button
              onClick={async () => { setOnline(truckId, false); await serverSignOut(); logout(); navigate({ to: "/role" }); }}
              className="mt-4 w-full h-12 rounded-xl border border-neutral-200 text-neutral-600 font-semibold flex items-center justify-center gap-2"
            >
              <LogoutIcon className="w-4 h-4" /> {tr("Go offline & logout")}
            </button>
          </div>
        </BottomSheet>
      </div>
    </MobileFrame>
  );
}