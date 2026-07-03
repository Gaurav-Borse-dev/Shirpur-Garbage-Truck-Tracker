import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { TruckMap } from "@/components/TruckMap";
import { useTrucks } from "@/store/trucks";
import { TruckIcon } from "@/components/icons";
import { fmtDistance, fmtEta, haversine } from "@/lib/geo";
import { RESIDENT_DEMO } from "@/lib/trucks";

export const Route = createFileRoute("/admin/map")({
  component: LiveMapPage,
});

type Filter = "all" | "online" | "offline";

function LiveMapPage() {
  useTrucks((s) => s.tick);
  const trucks = useTrucks((s) => s.trucks);
  const [filter, setFilter] = useState<Filter>("all");
  const [highlight, setHighlight] = useState<string | undefined>();
  const all = Object.values(trucks);
  const list = all.filter((t) =>
    filter === "all" ? true : filter === "online" ? t.status !== "offline" : t.status === "offline",
  );
  const stats = useMemo(() => {
    const active = all.filter((t) => t.status !== "offline").length;
    const completed = all.reduce((s, t) => s + t.completedStops, 0);
    const pending = all.reduce((s, t) => s + Math.max(0, t.truck.totalStops - t.completedStops), 0);
    return { total: all.length, active, completed, pending };
  }, [all]);
  const center = RESIDENT_DEMO.Shirpur;

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Full-bleed live map */}
      <div className="absolute inset-0">
        <ClientOnly fallback={<div className="w-full h-full bg-neutral-50" />}>
          <TruckMap mode="admin" highlightId={highlight} showRoutes onTruckClick={setHighlight} />
        </ClientOnly>
      </div>

      {/* Floating right dashboard */}
      <aside className="absolute top-4 right-4 bottom-4 w-[340px] z-[500] flex flex-col gap-3 pointer-events-none">
        {/* Header */}
        <div className="pointer-events-auto bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.10)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-ink text-base leading-tight">Live Fleet</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Shirpur Municipal · Real-time</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              LIVE
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Active" value={stats.active} accent />
            <StatCard label="Stops done" value={stats.completed} />
            <StatCard label="Pending" value={stats.pending} />
          </div>
        </div>

        {/* Filter + list */}
        <div className="pointer-events-auto bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.10)] flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-neutral-100">
            <div className="inline-flex p-0.5 rounded-lg bg-neutral-100 text-xs w-full">
              {(["all", "online", "offline"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 px-3 py-1.5 rounded-md font-semibold capitalize transition-colors ${
                    filter === f ? "bg-white shadow-sm text-ink" : "text-neutral-500"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.map((t) => {
              const dist = haversine(t.position, center);
              const isSel = highlight === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setHighlight(t.id)}
                  className={`w-full text-left px-3 py-3 border-b border-neutral-100 last:border-b-0 flex items-center gap-3 transition-colors ${
                    isSel ? "bg-brand-soft/40" : "hover:bg-neutral-50"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                    t.status === "offline" ? "bg-neutral-100 text-neutral-400" : "bg-brand-soft text-brand"
                  }`}>
                    <TruckIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-ink truncate">{t.id}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        t.status === "offline" ? "bg-neutral-400" : "bg-brand"
                      }`} />
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                        {t.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">
                      {t.truck.wardName}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Stop {Math.min(t.completedStops + 1, t.truck.totalStops)}/{t.truck.totalStops}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-ink">{fmtEta(dist)}</div>
                    <div className="text-[10px] text-neutral-400">{fmtDistance(dist)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${accent ? "bg-brand-soft" : "bg-neutral-50"}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
        {label}
      </div>
      <div className={`text-xl font-bold mt-0.5 ${accent ? "text-brand" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}