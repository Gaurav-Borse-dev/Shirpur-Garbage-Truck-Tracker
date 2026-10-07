import { createFileRoute, Outlet, Link, useLocation, Navigate } from "@tanstack/react-router";
import { RequireRole } from "@/components/RequireRole";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/auth";
import { MobileFrame } from "@/components/MobileFrame";
import { ToastHost, useToast } from "@/components/Toast";
import { useBookings } from "@/store/bookings";
import { MapIcon, CalendarIcon, BellIcon, UserIcon } from "@/components/icons";
import { useRealtime } from "@/hooks/useRealtime";
import { useSettings } from "@/store/settings";
import { SHIRPUR } from "@/lib/trucks";
import type { LatLng } from "@/lib/geo";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/resident")({
  component: ResidentRoute,
});

function ResidentRoute() {
  return (
    <RequireRole role="resident" redirectTo="/role">
      <ResidentLayout />
    </RequireRole>
  );
}

function ResidentLayout() {
  const session = useAuth((s) => s.session);
  const isResident = session?.role === "resident";
  // Use real device geolocation for the realtime subscription radius
  const radiusM = useSettings((s) => s.alertRadius);
  const [location, setLocation] = useState<LatLng>(SHIRPUR);
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setLocation({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        }),
      () => {}, // Keep SHIRPUR fallback
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  const subLat = Number(location.lat.toFixed(4));
  const subLng = Number(location.lng.toFixed(4));
  useRealtime(
    isResident
      ? { role: "resident", lat: subLat, lng: subLng, radiusM: Math.max(radiusM, 2000) }
      : null,
  );
  useBookingNotifications(isResident ? session.phone : "");

  if (!isResident) return <Navigate to="/role" />;

  return (
    <MobileFrame>
      <div className="flex-1 relative overflow-hidden">
        <Outlet />
        <ToastHost />
      </div>
      <BottomNav />
    </MobileFrame>
  );
}

function useBookingNotifications(phone: string) {
  const bookings = useBookings((s) => s.bookings);
  const push = useToast((s) => s.push);
  const tr = useT();
  const seen = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const mine = bookings.filter((b) => b.residentPhone === phone);
    if (!seen.current) {
      seen.current = new Map(mine.map((b) => [b.id, b.status]));
      return;
    }
    for (const b of mine) {
      const prev = seen.current.get(b.id);
      if (prev && prev !== b.status && b.status !== "pending") {
        push({
          title: b.status === "approved" ? tr("Booking approved") : tr("Booking rejected"),
          subtitle: `${b.id} · ${b.reason.slice(0, 40)}`,
          tone: b.status === "approved" ? "success" : "warning",
        });
      }
      seen.current.set(b.id, b.status);
    }
  }, [bookings, phone, push]);
}

function BottomNav() {
  const loc = useLocation();
  const tr = useT();
  const items: { to: string; label: string; Icon: typeof MapIcon; exact?: boolean }[] = [
    { to: "/resident", label: tr("Map"), Icon: MapIcon, exact: true },
    { to: "/resident/schedule", label: tr("Schedule"), Icon: CalendarIcon },
    { to: "/resident/alerts", label: tr("Alerts"), Icon: BellIcon },
    { to: "/resident/profile", label: tr("Profile"), Icon: UserIcon },
  ];
  return (
    <nav className="border-t border-neutral-200 bg-white relative z-[700]">
      <div className="grid grid-cols-4">
        {items.map(({ to, label, Icon, exact }) => {
          const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
          return (
            <Link key={to} to={to} className="flex flex-col items-center gap-1 py-2.5">
              <Icon className={`w-5 h-5 ${active ? "text-ink" : "text-neutral-400"}`} />
              <span
                className={`text-[11px] ${active ? "text-ink font-semibold" : "text-neutral-400"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
