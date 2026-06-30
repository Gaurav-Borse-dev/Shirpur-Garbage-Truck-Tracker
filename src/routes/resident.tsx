import { createFileRoute, Outlet, Link, useLocation, Navigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";
import { MobileFrame } from "@/components/MobileFrame";
import { ToastHost, useToast } from "@/components/Toast";
import { useBookings } from "@/store/bookings";
import { MapIcon, CalendarIcon, BellIcon, UserIcon } from "@/components/icons";

export const Route = createFileRoute("/resident")({
  component: ResidentLayout,
});

function ResidentLayout() {
  const session = useAuth((s) => s.session);
  if (!session || session.role !== "resident") return <Navigate to="/role" />;
  useBookingNotifications(session.phone);
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
          title: b.status === "approved" ? "Booking approved" : "Booking rejected",
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
  const items: { to: string; label: string; Icon: typeof MapIcon; exact?: boolean }[] = [
    { to: "/resident", label: "Map", Icon: MapIcon, exact: true },
    { to: "/resident/schedule", label: "Schedule", Icon: CalendarIcon },
    { to: "/resident/alerts", label: "Alerts", Icon: BellIcon },
    { to: "/resident/profile", label: "Profile", Icon: UserIcon },
  ];
  return (
    <nav className="border-t border-neutral-200 bg-white relative z-[700]">
      <div className="grid grid-cols-4">
        {items.map(({ to, label, Icon, exact }) => {
          const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
          return (
            <Link key={to} to={to} className="flex flex-col items-center gap-1 py-2.5">
              <Icon className={`w-5 h-5 ${active ? "text-ink" : "text-neutral-400"}`} />
              <span className={`text-[11px] ${active ? "text-ink font-semibold" : "text-neutral-400"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}