import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClientOnly } from "@/components/ClientOnly";
import { TruckMap } from "@/components/TruckMap";
import { BottomSheet } from "@/components/BottomSheet";
import { BellIcon, ClockIcon, TruckIcon, ChevronLeft } from "@/components/icons";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { useToast } from "@/components/Toast";
import { useTrucks } from "@/store/trucks";
import { RESIDENT_DEMO } from "@/lib/trucks";
import { haversine } from "@/lib/geo";
import { useFormat } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/resident/")({
  component: ResidentHome,
});

type ZoneState = "EnRoute" | "Nearby" | "Arriving" | "Leaving";

function ResidentHome() {
  const navigate = useNavigate();
  const tr = useT();
  const session = useAuth((s) => s.session)!;
  const city = session.role === "resident" ? session.city : "Shirpur";
  const resident = RESIDENT_DEMO[city];
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
  const insideArriving = distance < radius * 0.3;
  const insideNearby = distance < radius;

  // Zone & notification machine
  const prevZone = useRef<ZoneState>("EnRoute");
  const lastNotifAt = useRef<Record<string, number>>({});

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
    }
  }, [distance, insideArriving, insideNearby, nearest, push, notifEnabled]);

  const status = useMemo(() => statusFromDistance(distance, radius, prevZone.current), [distance, radius]);

  return (
    <div className="absolute inset-0">
      {/* Map */}
      <div className="absolute inset-0">
        <ClientOnly fallback={<MapSkeleton />}>
          <TruckMap mode="resident" resident={resident} radius={radius} activeTruckId={nearest?.id} />
        </ClientOnly>
      </div>

      {/* Top controls */}
      <div className="absolute top-3 left-3 right-3 z-[500] flex items-start justify-between gap-3 pointer-events-none">
        <button
          onClick={() => navigate({ to: "/role" })}
          className="pointer-events-auto w-11 h-11 rounded-full bg-white shadow-md grid place-items-center shrink-0"
          aria-label={tr("Back")}
        >
          <ChevronLeft />
        </button>
        <ConnectionPill connection={connection} />
      </div>

      {/* Floating "Arriving in" card (top-left, below back button) */}
      {nearest && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="absolute top-16 left-3 z-[500] pointer-events-none"
        >
          <div className="bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.10)] p-3 pr-4 flex items-center gap-3 min-w-[190px]">
            <div className="w-12 h-12 rounded-xl bg-brand-soft grid place-items-center text-brand shrink-0">
              <TruckIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                {tr("Arriving in")}
              </div>
              <div className="text-lg font-bold text-ink leading-tight">
                {fmt.eta(distance)}
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {fmt.distance(distance)} {tr("away")}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bottom sheet */}
      {nearest && (
        <BottomSheet springKey={status.label} peekHeight={112}>
          <div className="px-5 pb-5 pt-1">
            {/* Row 1: truck image + name/route + status pill */}
            <div className="flex items-center gap-3">
              <div className="w-[68px] h-[52px] rounded-2xl bg-brand-soft text-brand grid place-items-center shrink-0">
                <TruckIcon className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink text-[17px] truncate">
                  {nearest.truck.name}
                </div>
                <div className="text-xs text-neutral-500 truncate mt-0.5">
                  {tr("Route")} {nearest.truck.id} · {nearest.truck.wardName.split("—")[0].trim()}
                </div>
              </div>
              <div className={`ct-pill ${status.tone} shrink-0`}>{tr(status.label)}</div>
            </div>

            {/* Row 2: distance / ETA */}
            <div className="mt-4 rounded-2xl bg-neutral-50 grid grid-cols-2 overflow-hidden">
              <div className="p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{tr("Distance")}</div>
                <div className="text-xl font-bold text-ink mt-0.5">{fmt.distance(distance)}</div>
              </div>
              <div className="p-3.5 border-l border-neutral-200/70">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{tr("ETA")}</div>
                <div className="text-xl font-bold text-ink mt-0.5">{fmt.eta(distance)}</div>
              </div>
            </div>

            {/* Subtitle */}
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-500">
              <ClockIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tr("Municipal waste collection service")}</span>
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
              className={`w-full h-14 rounded-2xl font-semibold text-[15px] transition-colors ${
                insideNearby ? "bg-ink text-white shadow-lg shadow-black/20" : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {insideNearby ? tr("I'm Coming") : `${tr("Truck is")} ${fmt.distance(distance)} ${tr("away")}`}
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
        live ? "bg-white text-ink" : "bg-[#FEF3C7] text-[#92400E]"
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

function statusFromDistance(distance: number, radius: number, last: ZoneState) {
  if (distance < radius * 0.3) return { label: "Arriving", tone: "bg-[#DCFCE7] text-[#15803D]" };
  if (distance < radius) return { label: "Nearby", tone: "bg-[#FEF9C3] text-[#854D0E]" };
  if (last === "Nearby" || last === "Arriving") return { label: "Leaving", tone: "bg-[#FEE2E2] text-[#991B1B]" };
  return { label: "En Route", tone: "bg-neutral-100 text-neutral-600" };
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