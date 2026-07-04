import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { TruckMap } from "@/components/TruckMap";
import { useTrucks } from "@/store/trucks";

export const Route = createFileRoute("/admin/map")({
  component: LiveMapPage,
});

type Filter = "all" | "online" | "offline";

function LiveMapPage() {
  useTrucks((s) => s.tick);
  const trucks = useTrucks((s) => s.trucks);
  const [filter, setFilter] = useState<Filter>("all");
  const [highlight, setHighlight] = useState<string | undefined>();
  const list = Object.values(trucks).filter((t) =>
    filter === "all" ? true : filter === "online" ? t.status !== "offline" : t.status === "offline",
  );

  return (
    <div className="h-screen flex">
      <aside className="w-[320px] shrink-0 border-r border-neutral-200 flex flex-col">
        <div className="p-4 border-b border-neutral-100">
          <h2 className="font-bold text-ink">Live Map</h2>
          <p className="text-xs text-neutral-500 mt-0.5">All 16 trucks · {list.length} shown</p>
          <div className="mt-3 inline-flex p-0.5 rounded-lg bg-neutral-100 text-xs">
            {(["all", "online", "offline"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md font-semibold capitalize ${filter === f ? "bg-white shadow-sm text-ink" : "text-neutral-500"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
          {list.map((t) => (
            <div key={t.id} className={`p-4 ${highlight === t.id ? "bg-brand-soft/30" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold text-white ${t.status === "offline" ? "bg-neutral-400" : "bg-brand"}`}>{t.id}</span>
                <span className={`w-2 h-2 rounded-full ${t.status === "offline" ? "bg-neutral-400" : "bg-brand"}`} />
                <span className="text-xs text-neutral-500">{t.truck.city}</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">{t.truck.driverName}</div>
              <div className="text-xs text-neutral-500">+91 {t.truck.driverPhone || "—"}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{t.truck.wardName}</div>
              <div className="text-xs text-neutral-500 mt-1">Stop {Math.min(t.completedStops + 1, t.truck.totalStops)} of {t.truck.totalStops}</div>
              <button
                onClick={() => setHighlight(t.id)}
                className="mt-2 h-8 px-3 rounded-md bg-ink text-white text-xs font-semibold"
              >
                Track
              </button>
            </div>
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <ClientOnly fallback={<div className="w-full h-full bg-neutral-50" />}>
          <TruckMap mode="admin" highlightId={highlight} showRoutes onTruckClick={setHighlight} />
        </ClientOnly>
      </div>
    </div>
  );
}