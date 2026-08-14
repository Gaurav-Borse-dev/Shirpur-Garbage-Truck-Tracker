import { useEffect } from "react";
import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/store/auth";
import { Logo } from "@/components/Logo";
import { ToastHost } from "@/components/Toast";
import { MapIcon, UserIcon, BellIcon, TruckIcon, LogoutIcon, ClockIcon, CalendarIcon } from "@/components/icons";
import { useBookings } from "@/store/bookings";
import { useRealtime } from "@/hooks/useRealtime";
import { RequireRole } from "@/components/RequireRole";
import { serverSignOut } from "@/lib/auth.functions";
import { installNativeTokenBridge, registerThisDevice } from "@/lib/push-client";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <RequireRole role="admin" redirectTo="/login/admin">
      <AdminLayout />
    </RequireRole>
  );
}

function AdminLayout() {
  const tr = useT();
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const loc = useLocation();
  const pendingBookings = useBookings((s) => s.bookings.filter((b) => b.status === "pending").length);
  // Admin receives updates for every truck.
  useRealtime({ role: "admin" });
  // Admin devices register through the native wrapper token bridge too.
  useEffect(() => {
    installNativeTokenBridge();
    void registerThisDevice({ requirePermission: false });
  }, []);

  const nav = [
    { to: "/admin", label: tr("Dashboard"), Icon: MapIcon, exact: true },
    { to: "/admin/map", label: tr("Live Map"), Icon: TruckIcon },
    { to: "/admin/assignments", label: tr("Route Assignments"), Icon: MapIcon },
    { to: "/admin/drivers", label: tr("Driver Management"), Icon: UserIcon },
    { to: "/admin/bookings", label: tr("Dustbin Bookings"), Icon: CalendarIcon, badge: pendingBookings },
    { to: "/admin/alerts", label: tr("Alerts & Logs"), Icon: BellIcon },
  ];

  return (
    <div className="min-h-screen w-full bg-white text-ink flex">
      <aside className="w-[240px] shrink-0 border-r border-neutral-200 flex flex-col">
        <div className="px-5 py-5 flex items-center justify-between">
          <Logo size={36} />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">{tr("ADMIN")}</span>
        </div>
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {nav.map(({ to, label, Icon, exact, badge }) => {
            const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 h-10 rounded-lg text-sm transition-colors ${
                  active ? "bg-ink text-white font-semibold" : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1">{label}</span>
                {badge ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white text-ink" : "bg-amber-100 text-amber-700"}`}>{badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-neutral-200">
          <div className="px-2 py-1 text-xs">
            <div className="font-semibold text-ink">{session?.role === "admin" ? session.username : tr("Admin")}</div>
            <div className="text-neutral-400">{tr("Municipal Admin")}</div>
          </div>
          <button
            onClick={async () => { await serverSignOut(); logout(); navigate({ to: "/role" }); }}
            className="mt-2 w-full h-9 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-600 flex items-center justify-center gap-2 hover:bg-neutral-50"
          >
            <LogoutIcon className="w-3.5 h-3.5" /> {tr("Logout")}
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 relative">
        <Outlet />
        <ToastHost />
      </main>
    </div>
  );
}