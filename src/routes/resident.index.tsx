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
import { fmtDistance, fmtEta, haversine } from "@/lib/geo";

export const Route = createFileRoute("/resident/")({
  component: ResidentHome,
});

type ZoneState = "EnRoute" | "Nearby" | "Arriving" | "Leaving";

function ResidentHome() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session)!;
  const city = session.role === "resident" ? session.city : "Shirpur";
  const resident = RESIDENT_DEMO[city];
  const radius = useSettings((s) => s.alertRadius);
  const notifEnabled = useSettings((s) => s.notificationsEnabled);
  const setNotif = useSettings((s) => s.setNotifications);
  const push = useToast((s) => s.push);

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
        push({ title: `Garbage truck is ${fmtDistance(distance)} away`, subtitle: "Head outside soon" });
        fireBrowserNotif(notifEnabled, "Truck nearby", `${nearest.truck.id} is ${fmtDistance(distance)} away`);
      }
      if (zone === "Arriving" && can("arriving")) {
        push({ title: "Truck is almost here!", subtitle: "Go outside now" });
        fireBrowserNotif(notifEnabled, "Truck arriving", `${nearest.truck.id} is arriving`);
      }
      if (zone === "Leaving" && can("leaving")) {
        push({ title: "Truck has passed", subtitle: "Check schedule for next pickup" });
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
      <div className="absolute top-3 left-3 right-3 z-[500] flex items-center justify-between pointer-events-none">
        <button
          onClick={() => navigate({ to: "/role" })}
          className="pointer-events-auto w-10 h-10 rounded-full bg-white shadow-md grid place-items-center"
        >
          <ChevronLeft />
        </button>
        <div className="pointer-events-auto ct-pill bg-white shadow-md">
          <span className="w-2 h-2 rounded-full bg-brand" />
          Live
        </div>
      </div>

      {/* Home pill near resident */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60px] z-[400] pointer-events-none">
        <div className="ct-pill bg-ink text-white">Home ›</div>
      </div>

      {/* Bottom sheet */}
      {nearest && (
        <BottomSheet springKey={status.label}>
          <div className="px-5 pb-5 pt-2">
            {/* Row 1 */}
            <div className="flex items-center gap-3">
              <div className="w-[64px] h-[44px] rounded-xl bg-brand-soft text-brand grid place-items-center">
                <TruckIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink truncate">{nearest.truck.name} · {nearest.truck.id}</div>
                <div className="text-xs text-neutral-500 truncate">{nearest.truck.wardName}</div>
              </div>
              <div className={`ct-pill ${status.tone}`}>{status.label}</div>
            </div>

            {/* Row 2 metrics */}
            <div className="mt-4 rounded-2xl border border-neutral-200 grid grid-cols-2">
              <div className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Distance</div>
                <div className="text-2xl font-bold text-ink mt-1">{fmtDistance(distance)}</div>
              </div>
              <div className="p-4 border-l border-neutral-200">
                <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">ETA</div>
                <div className="text-2xl font-bold text-ink mt-1">{fmtEta(distance)}</div>
              </div>
            </div>

            {/* Row 3 */}
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
              <ClockIcon className="w-4 h-4" />
              Next pickup: 8:15 AM · {nearest.truck.wardName.split("—")[0].trim()}
            </div>

            <div className="h-px bg-neutral-100 my-4" />

            {/* Row 4 toggle */}
            <div className="flex items-center gap-3">
              <BellIcon className="w-5 h-5 text-ink" />
              <div className="flex-1 text-sm text-ink">Alert me when truck is near</div>
              <Toggle on={notifEnabled} onChange={(v) => {
                setNotif(v);
                if (v && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                  Notification.requestPermission().catch(() => {});
                }
              }} />
            </div>

            <div className="h-px bg-neutral-100 my-4" />

            {/* CTA */}
            <div className="flex items-center gap-2">
              <button
                disabled={!insideNearby}
                className={`flex-1 h-14 rounded-xl font-semibold transition-colors ${
                  insideNearby ? "bg-ink text-white" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {insideNearby ? "I'm Coming" : `Truck is ${fmtDistance(distance)} away`}
              </button>
              <button className="w-14 h-14 rounded-xl border border-neutral-200 grid place-items-center text-ink">
                <BellIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
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