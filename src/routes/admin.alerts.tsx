import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TRUCKS } from "@/lib/trucks";
import { TruckIcon, BellIcon, UserIcon, CheckIcon } from "@/components/icons";

export const Route = createFileRoute("/admin/alerts")({
  component: AlertsPage,
});

type EventType = "geofence" | "stop" | "login";
type Event = { id: string; type: EventType; truckId: string; ts: string; description: string };

function seedEvents(): Event[] {
  const events: Event[] = [];
  const now = Date.now();
  for (let i = 0; i < 80; i++) {
    const truck = TRUCKS[i % TRUCKS.length];
    const t = (["geofence", "stop", "login"] as const)[i % 3];
    const minutesAgo = i * 9 + Math.floor(Math.random() * 5);
    const date = new Date(now - minutesAgo * 60_000);
    const ts = date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const desc =
      t === "geofence" ? `${truck.id} entered ${truck.wardName.split("—")[0].trim()} geofence` :
      t === "stop" ? `${truck.id} completed stop ${(i % 12) + 1} of ${truck.totalStops}` :
      `${truck.driverName} signed in on ${truck.id}`;
    events.push({ id: String(i), type: t, truckId: truck.id, ts, description: desc });
  }
  return events;
}

function AlertsPage() {
  const events = useMemo(seedEvents, []);
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const filtered = events.filter((e) => filter === "all" || e.type === filter);

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Alerts & Logs</h1>
        <p className="text-sm text-neutral-500 mt-1">System events across the last 7 days</p>
      </div>

      <div className="mt-5 inline-flex p-0.5 rounded-lg bg-neutral-100 text-xs">
        {(["all", "geofence", "stop", "login"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md font-semibold capitalize ${filter === f ? "bg-white shadow-sm text-ink" : "text-neutral-500"}`}>
            {f === "all" ? "All" : f === "geofence" ? "Geofence" : f === "stop" ? "Stops" : "Logins"}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 overflow-hidden">
        {filtered.map((e, i) => {
          const Icon = e.type === "geofence" ? BellIcon : e.type === "stop" ? CheckIcon : UserIcon;
          const tone = e.type === "geofence" ? "bg-amber-50 text-amber-700" : e.type === "stop" ? "bg-brand-soft text-brand" : "bg-neutral-100 text-neutral-600";
          return (
            <div key={e.id} className={`flex items-center gap-4 px-5 py-3 ${i ? "border-t border-neutral-100" : ""}`}>
              <div className={`w-9 h-9 rounded-lg grid place-items-center ${tone}`}><Icon className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink truncate">{e.description}</div>
                <div className="text-xs text-neutral-500">{e.ts}</div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-neutral-100 text-neutral-600">{e.truckId}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}