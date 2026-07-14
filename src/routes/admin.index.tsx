import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { TruckMap } from "@/components/TruckMap";
import { useTrucks } from "@/store/trucks";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const tr = useT();
  useTrucks((s) => s.tick);
  const trucks = useTrucks((s) => s.trucks);
  const list = Object.values(trucks);
  const online = list.filter((t) => t.status !== "offline").length;
  const totalStopsToday = list.reduce((a, t) => a + t.completedStops, 0);
  const residentsAlerted = totalStopsToday * 7 + 14;
  const [highlight, setHighlight] = useState<string | undefined>();

  return (
    <div className="p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tr("Fleet Dashboard")}</h1>
          <p className="text-sm text-neutral-500 mt-1">{tr("Shirpur Municipal Corporation · Live")}</p>
        </div>
        <div className="ct-pill bg-brand-soft text-brand">
          <span className="w-2 h-2 rounded-full bg-brand" /> {tr("All systems live")}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3">
        <Stat label={tr("Total Trucks")} value={list.length} />
        <Stat label={tr("Online Now")} value={online} accent />
        <Stat label={tr("Stops Today")} value={totalStopsToday} />
        <Stat label={tr("Residents Alerted")} value={residentsAlerted} />
      </div>

      <div className="mt-6 grid grid-cols-[3fr_2fr] gap-4">
        <div className="rounded-2xl border border-neutral-200 overflow-hidden h-[560px]">
          <ClientOnly fallback={<div className="w-full h-full bg-neutral-50" />}>
            <TruckMap mode="admin" highlightId={highlight} onTruckClick={setHighlight} />
          </ClientOnly>
        </div>
        <div className="rounded-2xl border border-neutral-200 flex flex-col h-[560px]">
          <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-sm">{tr("Active trucks")}</div>
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setHighlight(t.id)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 ${highlight === t.id ? "bg-neutral-50" : ""}`}
              >
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold text-white ${t.status === "offline" ? "bg-neutral-400" : "bg-brand"}`}>{t.id}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{t.truck.driverName}</div>
                  <div className="text-xs text-neutral-500 truncate">{t.truck.wardName}</div>
                </div>
                <div className="text-xs text-neutral-500 font-mono">{t.completedStops}/{t.truck.totalStops}</div>
                <div className={`ct-pill text-[10px] py-0.5 ${t.status === "offline" ? "bg-neutral-100 text-neutral-500" : "bg-brand-soft text-brand"}`}>
                  {t.status === "offline" ? tr("Offline") : tr("Online")}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-brand bg-brand-soft/30" : "border-neutral-200 bg-white"}`}>
      <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">{label}</div>
      <div className="text-3xl font-bold text-ink mt-2">{value}</div>
    </div>
  );
}