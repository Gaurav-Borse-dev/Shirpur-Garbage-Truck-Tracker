import { createFileRoute, Outlet, Link, useLocation, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/store/auth";
import { MobileFrame } from "@/components/MobileFrame";
import { ToastHost } from "@/components/Toast";
import { MapIcon, CalendarIcon, BellIcon, UserIcon } from "@/components/icons";

export const Route = createFileRoute("/resident")({
  component: ResidentLayout,
});

function ResidentLayout() {
  const session = useAuth((s) => s.session);
  if (!session || session.role !== "resident") return <Navigate to="/role" />;
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

function BottomNav() {
  const loc = useLocation();
  const items = [
    { to: "/resident", label: "Map", Icon: MapIcon, exact: true },
    { to: "/resident/schedule", label: "Schedule", Icon: CalendarIcon },
    { to: "/resident/alerts", label: "Alerts", Icon: BellIcon },
    { to: "/resident/profile", label: "Profile", Icon: UserIcon },
  ] as const;
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