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
import { useToast, ToastHost } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/hooks/useRealtime";
import { LIVE_BACKEND } from "@/lib/backend";
import { startDriverLocation, stopDriverLocation } from "@/lib/driver-location";
import { emitDriverDuty } from "@/lib/realtime";
import { RequireRole } from "@/components/RequireRole";
import { serverSignOut } from "@/lib/auth.functions";

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
  const onDuty = useTrucks((s) => s.trucks[truckId]?.status) !== "offline";
  useEffect(() => {
    if (!LIVE_BACKEND) return;
    if (onDuty) {
      emitDriverDuty(truckId, "start");
      startDriverLocation(truckId);
    } else {
      emitDriverDuty(truckId, "stop");
      stopDriverLocation();
    }
    return () => stopDriverLocation();
  }, [onDuty, truckId]);

  if (!live) return null;

  const online = live.status !== "offline";
  const stopNum = Math.min(live.completedStops + 1, live.truck.totalStops);
  const progress = (live.completedStops / live.truck.totalStops) * 100;

  function advance() {
    complete(truckId);
    push({ title: tr("Stop") + " " + tr("Completed"), subtitle: `${tr("Stop")} ${stopNum + 1}` });
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

        {/* Top bar */}
        <div className="absolute top-3 left-3 right-3 z-[500] flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-2xl shadow-md px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">{tr("Driver")}</div>
            <div className="text-sm font-bold text-ink">{session.driverName} · {truckId}</div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {connection === "reconnecting" && (
              <div className="ct-pill bg-[#FEF3C7] text-[#92400E] shadow-md">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                {tr("Reconnecting")}
              </div>
            )}
            <div className={`ct-pill ${online ? "bg-brand text-white" : "bg-neutral-300 text-white"} shadow-md`}>
              <span className={`w-2 h-2 rounded-full ${online ? "bg-white" : "bg-white/60"}`} /> {online ? tr("Online") : tr("Offline")}
            </div>
          </div>
        </div>

        <ToastHost />

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
                Assigned by Municipal Admin · live sync
              </div>
              <div className="text-xs text-neutral-500">Collection point #{stopNum}</div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {(["enroute", "arrived", "completed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      if (s === "completed") advance();
                      else setStopStatus(s);
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
                            Stop {i + 1} · {live.truck.wardName.split("—")[0].trim()}
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
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Today</div>
                <div className="text-2xl font-bold text-ink">{live.completedStops}<span className="text-base text-neutral-400">/{live.truck.totalStops}</span></div>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Progress</div>
                <div className="text-2xl font-bold text-ink">{progress.toFixed(0)}%</div>
              </div>
            </div>

            {/* Route info */}
            <div className="mt-3 p-4 rounded-2xl bg-neutral-50">
              <div className="text-xs font-semibold text-neutral-500">{live.truck.wardName}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{live.completedStops} of {live.truck.totalStops} stops completed</div>
              <div className="mt-2 h-2 rounded-full bg-neutral-200 overflow-hidden">
                <motion.div className="h-full bg-brand" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120 }} />
              </div>
            </div>

            <button
              onClick={async () => { setOnline(truckId, false); await serverSignOut(); logout(); navigate({ to: "/role" }); }}
              className="mt-4 w-full h-12 rounded-xl border border-neutral-200 text-neutral-600 font-semibold flex items-center justify-center gap-2"
            >
              <LogoutIcon className="w-4 h-4" /> Go offline & logout
            </button>
          </div>
        </BottomSheet>
      </div>
    </MobileFrame>
  );
}