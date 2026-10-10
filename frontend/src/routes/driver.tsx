import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MobileFrame } from "@/components/MobileFrame";
import { ClientOnly } from "@/components/ClientOnly";
import { TruckMap } from "@/components/TruckMap";
import { BottomSheet } from "@/components/BottomSheet";
import { ChevronDown, CheckIcon, LogoutIcon, MapIcon, UserIcon } from "@/components/icons";
import { useAuth } from "@/store/auth";
import { useTrucks, type LiveTruck } from "@/store/trucks";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { useI18n } from "@/store/i18n";
import { LANGS } from "@/components/LanguageSwitcher";
import { useRealtime } from "@/hooks/useRealtime";
import { LIVE_BACKEND } from "@/lib/backend";
import { startDriverLocation, stopDriverLocation } from "@/lib/driver-location";
import { emitDriverDuty } from "@/lib/realtime";
import { RequireRole } from "@/components/RequireRole";
import { serverSignOut } from "@/lib/auth.functions";
import { installNativeTokenBridge, registerThisDevice } from "@/lib/push-client";
import { SHIRPUR } from "@/lib/trucks";
import { ingestDriverGps } from "@/lib/tracking.functions";
import { setDriverDuty } from "@/lib/fleet.functions";

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
        content:
          "Share live location and manage your collection stops on the CleanTrack driver app.",
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const isDriver = session?.role === "driver";
  const truckId = isDriver ? session.truckId : "";
  const live = useTrucks((s) => s.trucks[truckId]);
  const setOnline = useTrucks((s) => s.setDriverOnline);
  const complete = useTrucks((s) => s.completeStop);
  const connection = useTrucks((s) => s.connection);
  const push = useToast((s) => s.push);

  const [stopStatus, setStopStatus] = useState<StopStatus>("enroute");
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"nav" | "profile">("nav");

  async function handleLogout() {
    setOnline(truckId, false);
    await serverSignOut();
    logout();
    queryClient.setQueryData(["server-session"], null);
    queryClient.removeQueries({ queryKey: ["server-session"] });
    navigate({ to: "/role" });
  }

  useRealtime(isDriver ? { role: "driver", truckId } : null);
  // Mobile wrapper path: the native shell supplies the FCM token, so no VAPID
  // key or Firebase web config is needed here.
  useEffect(() => {
    installNativeTokenBridge();
    void registerThisDevice({ requirePermission: false });
    if (truckId && !useTrucks.getState().trucks[truckId]) {
      useTrucks.getState().ingestFixes([
        {
          truckId,
          lat: SHIRPUR.lat,
          lng: SHIRPUR.lng,
          status: "offline",
          ts: Date.now(),
        },
      ]);
    }
  }, [truckId]);
  const onDuty = useTrucks((s) => s.trucks[truckId]?.status) !== "offline";
  useEffect(() => {
    if (!LIVE_BACKEND) return;
    if (onDuty) {
      emitDriverDuty(truckId, "start");
      // Update DB duty state immediately so admin sees the driver as active
      void setDriverDuty({ data: { truckCode: truckId, online: true } });
      void startDriverLocation(truckId);
    } else {
      emitDriverDuty(truckId, "stop");
      // Mark driver offline in DB immediately
      void setDriverDuty({ data: { truckCode: truckId, online: false } });
      void stopDriverLocation();
    }
    return () => {
      void stopDriverLocation();
    };
  }, [onDuty, truckId]);

  if (!isDriver) return <Navigate to="/role" />;

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
        {activeTab === "nav" ? (
          <>
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
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  {tr("Driver Navigation")}
                </div>
                <div className="text-xs font-bold text-white truncate max-w-[140px]">
                  {session.driverName} · {truckId}
                </div>
              </div>
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              {connection === "reconnecting" && (
                <div className="ct-pill bg-amber-100 text-amber-900 border border-amber-300 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  {tr("Reconnecting")}
                </div>
              )}
              <div
                className={`ct-pill ${online ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"} shadow-md`}
              >
                <span className={`w-2 h-2 rounded-full ${online ? "bg-white" : "bg-slate-400"}`} />{" "}
                {online ? tr("Online") : tr("Offline")}
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
              <div className="text-sm font-bold text-white truncate mt-0.5">
                {live.truck.wardName}
              </div>
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
        </div>

        <BottomSheet>
          <div className="px-5 pb-5 pt-2 max-h-[68vh] overflow-y-auto">
            {/* Online toggle */}
            <div className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200">
              <div className="flex-1">
                <div className={`font-bold text-sm ${online ? "text-brand" : "text-neutral-500"}`}>
                  {tr("You are")}{" "}
                  {online ? tr("Online").toUpperCase() : tr("Offline").toUpperCase()}
                </div>
                <div className="text-xs text-neutral-500">
                  {online
                    ? tr("Residents can see your location.")
                    : tr("Go online to start broadcasting.")}
                </div>
              </div>
              <button
                onClick={() => setOnline(truckId, !online)}
                className={`w-12 h-7 rounded-full relative transition-colors ${online ? "bg-brand" : "bg-neutral-300"}`}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={`absolute top-0.5 ${online ? "right-0.5" : "left-0.5"} w-6 h-6 rounded-full bg-white shadow`}
                />
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
              <div className="text-xs text-neutral-500">
                {tr("Collection point")} #{stopNum}
              </div>
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
                    {s === "enroute"
                      ? tr("En Route")
                      : s === "arrived"
                        ? tr("Arrived")
                        : tr("Completed")}
                  </button>
                ))}
              </div>
              {stopStatus === "arrived" && (
                <div className="mt-3 text-xs text-brand font-semibold">
                  {tr("3 residents notified nearby")}
                </div>
              )}
            </div>

            {/* Expandable stops */}
            <button
              onClick={() => setExpanded((x) => !x)}
              className="mt-3 flex items-center gap-1 text-sm font-semibold text-ink"
            >
              {expanded ? tr("Hide stops") : tr("View all stops")}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
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
                        <div
                          key={i}
                          className="flex items-center gap-3 py-2 border-b border-neutral-100"
                        >
                          <div
                            className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold ${
                              done
                                ? "bg-brand text-white"
                                : current
                                  ? "bg-ink text-white"
                                  : "bg-neutral-100 text-neutral-400"
                            }`}
                          >
                            {done ? <CheckIcon className="w-3 h-3" /> : i + 1}
                          </div>
                          <div
                            className={`flex-1 text-sm ${done ? "text-neutral-400 line-through" : current ? "font-semibold text-ink" : "text-neutral-600"}`}
                          >
                            {tr("Stop")} {i + 1} · {live.truck.wardName.split("—")[0].trim()}
                          </div>
                          <div className="text-xs text-neutral-400">
                            ~{(8 + i * 0.25).toFixed(2).replace(".", ":")} AM
                          </div>
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
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                  {tr("Today")}
                </div>
                <div className="text-2xl font-bold text-ink">
                  {live.completedStops}
                  <span className="text-base text-neutral-400">/{live.truck.totalStops}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                  {tr("Progress")}
                </div>
                <div className="text-2xl font-bold text-ink">{progress.toFixed(0)}%</div>
              </div>
            </div>

            {/* Route info */}
            <div className="mt-3 p-4 rounded-2xl bg-neutral-50">
              <div className="text-xs font-semibold text-neutral-500">{live.truck.wardName}</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {live.completedStops} {tr("of")} {live.truck.totalStops} {tr("stops completed")}
              </div>
              <div className="mt-2 h-2 rounded-full bg-neutral-200 overflow-hidden">
                <motion.div
                  className="h-full bg-brand"
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 120 }}
                />
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="mt-4 w-full h-12 rounded-xl border border-neutral-200 text-neutral-600 font-semibold flex items-center justify-center gap-2"
            >
              <LogoutIcon className="w-4 h-4" /> {tr("Go offline & logout")}
            </button>
          </div>
        </BottomSheet>
          </>
        ) : (
          <DriverProfileView
            session={session}
            truckId={truckId}
            live={live}
            online={online}
            setOnline={setOnline}
            onLogout={handleLogout}
          />
        )}
      </div>
      <DriverBottomNav activeTab={activeTab} onSelect={setActiveTab} />
    </MobileFrame>
  );
}

function DriverProfileView({
  session,
  truckId,
  live,
  online,
  setOnline,
  onLogout,
}: {
  session: { role: "driver"; phone: string; driverName: string; truckId: string };
  truckId: string;
  live: LiveTruck;
  online: boolean;
  setOnline: (id: string, online: boolean) => void;
  onLogout: () => void;
}) {
  const tr = useT();
  const lang = useI18n((s) => s.driverLang);
  const setLang = useI18n((s) => s.setLang);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const approvedDriver = useAuth((s) => s.findDriverByPhone(session.phone));
  const driverId = approvedDriver?.dbId
    ? `DRV-${approvedDriver.dbId.slice(0, 6).toUpperCase()}`
    : `DRV-${truckId}`;

  const initials =
    (session.driverName || "Driver")
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "D";

  useEffect(() => {
    if (!langOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!langRef.current?.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-white">
      {/* Header */}
      <div className="px-6 pt-8 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-ink text-white grid place-items-center font-bold text-xl">
          {initials}
        </div>
        <div>
          <div className="font-bold text-ink text-lg">{session.driverName}</div>
          <div className="text-xs text-neutral-500">
            {tr("Driver")} · {truckId}
          </div>
        </div>
      </div>

      {/* Online / Offline Duty Status Card */}
      <div className="px-6 mt-6">
        <div className="p-4 rounded-2xl border border-neutral-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
              {tr("Duty Status")}
            </div>
            <div className="text-sm font-bold text-ink mt-0.5 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`}
              />
              <span>{online ? tr("Online") : tr("Offline")}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOnline(truckId, !online)}
            className={`w-12 h-7 rounded-full relative transition-colors ${online ? "bg-brand" : "bg-neutral-300"}`}
            aria-label={online ? tr("Online") : tr("Offline")}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`absolute top-0.5 ${online ? "right-0.5" : "left-0.5"} w-6 h-6 rounded-full bg-white shadow`}
            />
          </button>
        </div>
      </div>

      {/* Driver & Vehicle Info */}
      <div className="px-6 mt-6 space-y-1">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider pb-1">
          {tr("Driver & Vehicle Info")}
        </div>
        <DriverRow label={tr("Driver Name")} value={session.driverName} />
        <DriverRow label={tr("Driver ID")} value={driverId} />
        <DriverRow
          label={tr("Status")}
          value={online ? tr("Online") : tr("Offline")}
        />
        <DriverRow label={tr("Mobile Number")} value={`+91 ${session.phone}`} />
        <DriverRow label={tr("Vehicle Number")} value={live.truck.id} />
        <DriverRow label={tr("Assigned Ward")} value={live.truck.wardName} />
        <DriverRow label={tr("Vehicle Type")} value={live.truck.name} />
      </div>

      {/* Settings & Preferences */}
      <div className="px-6 mt-6 space-y-1">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider pb-1">
          {tr("SETTINGS")}
        </div>
        <DriverRow label={tr("Notifications")} value={tr("Enabled")} />

        {/* Language Row with Dropdown */}
        <div ref={langRef} className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            className="w-full flex items-center justify-between py-3 border-b border-neutral-100 text-left hover:bg-neutral-50 transition-colors"
            aria-expanded={langOpen}
            aria-label={tr("Language")}
          >
            <div className="text-sm text-ink">{tr("Language")}</div>
            <div className="text-sm text-neutral-500 flex items-center gap-1.5 font-medium">
              <span>{LANGS.find((l) => l.code === lang)?.native ?? "English"}</span>
              <svg
                viewBox="0 0 20 20"
                className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${langOpen ? "rotate-180" : ""}`}
                fill="currentColor"
              >
                <path
                  d="M5.5 7.5l4.5 4.5 4.5-4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in">
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                {tr("Language")}
              </div>
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLang(l.code, "driver");
                    setLangOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                    lang === l.code ? "text-brand font-semibold" : "text-ink"
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-neutral-100 grid place-items-center text-[10px] font-bold">
                    {l.flag}
                  </span>
                  <span className="flex-1 text-left">{l.native}</span>
                  {lang === l.code && (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 text-brand"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <DriverRow label={tr("Help & Support")} value="›" />
        <DriverRow label={tr("About CleanTrack")} value="v1.0" />
      </div>

      {/* Logout */}
      <div className="px-6 mt-8 pb-10">
        <button
          type="button"
          onClick={onLogout}
          className="w-full h-12 rounded-xl border border-red-200 text-red-600 font-semibold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
        >
          <LogoutIcon className="w-4 h-4" /> {tr("Logout")}
        </button>
      </div>
    </div>
  );
}

function DriverRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100">
      <div className="text-sm text-ink">{label}</div>
      <div className="text-sm text-neutral-500 font-medium">{value}</div>
    </div>
  );
}

function DriverBottomNav({
  activeTab,
  onSelect,
}: {
  activeTab: "nav" | "profile";
  onSelect: (tab: "nav" | "profile") => void;
}) {
  const tr = useT();
  const items = [
    { id: "nav" as const, label: tr("Navigation"), Icon: MapIcon },
    { id: "profile" as const, label: tr("Profile"), Icon: UserIcon },
  ];

  return (
    <nav className="border-t border-neutral-200 bg-white relative z-[700] select-none">
      <div className="grid grid-cols-2">
        {items.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="flex flex-col items-center gap-1 py-2.5 transition-colors"
            >
              <Icon className={`w-5 h-5 ${active ? "text-ink" : "text-neutral-400"}`} />
              <span
                className={`text-[11px] ${active ? "text-ink font-semibold" : "text-neutral-400"}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
