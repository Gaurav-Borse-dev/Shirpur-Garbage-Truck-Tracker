import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { TruckMap } from "@/components/TruckMap";
import { useTrucks } from "@/store/trucks";
import { TruckIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/map")({
  component: LiveMapPage,
});

type Filter = "all" | "online" | "offline";

function LiveMapPage() {
  const tr = useT();
  useTrucks((s) => s.tick);
  const trucks = useTrucks((s) => s.trucks);
  const [filter, setFilter] = useState<Filter>("all");
  const [highlight, setHighlight] = useState<string | undefined>();
  const all = Object.values(trucks);
  const list = all.filter((t) =>
    filter === "all" ? true : filter === "online" ? t.status !== "offline" : t.status === "offline",
  );
  const totals = {
    total: all.length,
    active: all.filter((t) => t.status !== "offline").length,
    completed: all.reduce((s, t) => s + t.completedStops, 0),
    pending: all.reduce((s, t) => s + (t.truck.totalStops - t.completedStops), 0),
  };

  return (
    <div className="relative h-screen w-full bg-neutral-100">
      {/* Full-bleed map */}
      <div className="absolute inset-0">
        <ClientOnly fallback={<div className="w-full h-full bg-neutral-50" />}>
          <TruckMap mode="admin" highlightId={highlight} showRoutes onTruckClick={setHighlight} />
        </ClientOnly>
      </div>

      {/* Floating right-side dashboard */}
      <aside className="absolute top-4 right-4 bottom-4 w-[360px] z-[600] flex flex-col gap-4 pointer-events-none">
        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full bg-neutral-100 grid place-items-center text-ink" aria-label="Menu">
              <div className="space-y-[3px]">
                <span className="block w-4 h-[2px] bg-ink rounded" />
                <span className="block w-4 h-[2px] bg-ink rounded" />
                <span className="block w-4 h-[2px] bg-ink rounded" />
              </div>
            </button>
            <h2 className="font-bold text-ink text-[17px]">{tr("Admin Live Dashboard")}</h2>
          </div>

          {/* Stat cards */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label={tr("Total Trucks")} value={totals.total} accent="ink" icon="truck" />
            <StatCard label={tr("Active Trucks")} value={totals.active} accent="green" icon="dot" />
            <StatCard label={tr("Completed Stops")} value={totals.completed} accent="green" icon="check" />
            <StatCard label={tr("Pending Stops")} value={totals.pending} accent="orange" icon="circle" />
          </div>
        </div>

        {/* Truck list card */}
        <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] pointer-events-auto flex flex-col overflow-hidden">
          <div className="flex border-b border-neutral-100">
            {(["all", "online", "offline"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-3 text-[13px] font-semibold capitalize border-b-2 -mb-px transition-colors ${
                  filter === f ? "text-brand border-brand" : "text-neutral-400 border-transparent hover:text-ink"
                }`}
              >
                {f === "all" ? tr("All Trucks") : tr(f)}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.map((t) => {
              const stop = Math.min(t.completedStops + 1, t.truck.totalStops);
              const statusLabel =
                t.status === "offline" ? "Offline" : t.completedStops >= t.truck.totalStops ? "Complete" : "On Route";
              const statusTone =
                t.status === "offline"
                  ? "text-neutral-400"
                  : statusLabel === "Complete"
                  ? "text-brand"
                  : "text-brand";
              const eta = `${(3 + ((t.truck.totalStops - t.completedStops) % 8))} min away`;
              return (
                <button
                  key={t.id}
                  onClick={() => setHighlight(t.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-neutral-50 transition-colors ${
                    highlight === t.id ? "bg-brand-soft/50" : "hover:bg-neutral-50"
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${
                    t.status === "offline" ? "bg-neutral-100 text-neutral-400" : "bg-brand-soft text-brand"
                  }`}>
                    <TruckIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink truncate">
                      {t.truck.id.replace("GBR-", "Truck ")}
                    </div>
                    <div className={`text-xs font-semibold ${statusTone}`}>
                      {tr(statusLabel)} · {tr("Stop")} {stop}/{t.truck.totalStops}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 shrink-0">{t.status === "offline" ? "—" : eta}</div>
                </button>
              );
            })}
          </div>
          <div className="border-t border-neutral-100 px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-neutral-500">{list.length} {tr("of")} {all.length} {tr("shown")}</span>
            <span className="text-ink font-semibold">{tr("View All")} ›</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: "ink" | "green" | "orange";
  icon: "truck" | "dot" | "check" | "circle";
}) {
  const tone =
    accent === "green" ? "text-brand" : accent === "orange" ? "text-orange-500" : "text-ink";
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
          {label}
        </span>
        <span className={`w-4 h-4 grid place-items-center ${tone}`}>
          {icon === "truck" && <TruckIcon className="w-4 h-4" />}
          {icon === "dot" && <span className="w-2 h-2 rounded-full bg-brand" />}
          {icon === "check" && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {icon === "circle" && <span className="w-3 h-3 rounded-full border-2 border-orange-500" />}
        </span>
      </div>
      <div className="text-2xl font-bold text-ink mt-1 leading-none">{value}</div>
    </div>
  );
}