import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { TRUCKS } from "@/lib/trucks";
import { TruckIcon, BellIcon, UserIcon, CheckIcon } from "@/components/icons";
import { sendTestPush } from "@/lib/push.functions";

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
        {null}
        {(["all", "geofence", "stop", "login"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md font-semibold capitalize ${filter === f ? "bg-white shadow-sm text-ink" : "text-neutral-500"}`}>
            {f === "all" ? "All" : f === "geofence" ? "Geofence" : f === "stop" ? "Stops" : "Logins"}
          </button>
        ))}
      </div>

      <TestPushPanel />

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

function TestPushPanel() {
  const [mode, setMode] = useState<"resident" | "truck">("resident");
  const [phone, setPhone] = useState("");
  const [truckCode, setTruckCode] = useState(TRUCKS[0]?.id ?? "GBR-01");
  const [title, setTitle] = useState("CleanTrack test alert");
  const [body, setBody] = useState("This is a test notification from the municipal dashboard.");
  const [status, setStatus] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      sendTestPush({
        data: {
          target: mode === "resident" ? { kind: "resident", phone } : { kind: "truck", truckCode },
          title,
          ...(body ? { body } : {}),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        setStatus(res.reason === "unauthorized" ? "Not authorised to send." : "Unknown truck.");
        return;
      }
      if (res.skipped === "not_configured") setStatus("Push credentials are not configured yet.");
      else if (res.skipped === "no_devices") setStatus("No registered devices for this target.");
      else setStatus(`Sent to ${res.sent} device(s)${res.failed ? `, ${res.failed} failed` : ""}.`);
    },
    onError: () => setStatus("Send failed. Check the server logs."),
  });

  const invalid = mode === "resident" ? !/^\d{10}$/.test(phone) : !truckCode;

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 p-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg grid place-items-center bg-brand-soft text-brand">
          <BellIcon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-ink">Send test notification</div>
          <div className="text-xs text-neutral-500">Delivers a real push to registered devices</div>
        </div>
      </div>

      <div className="mt-4 inline-flex p-0.5 rounded-lg bg-neutral-100 text-xs">
        {(["resident", "truck"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setStatus(null); }}
            className={`px-3 py-1.5 rounded-md font-semibold ${mode === m ? "bg-white shadow-sm text-ink" : "text-neutral-500"}`}
          >
            {m === "resident" ? "Resident" : "Truck route"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 max-w-3xl">
        {mode === "resident" ? (
          <label className="text-xs font-semibold text-neutral-500">
            Resident phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit number"
              className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm text-ink font-normal"
            />
          </label>
        ) : (
          <label className="text-xs font-semibold text-neutral-500">
            Truck route
            <select
              value={truckCode}
              onChange={(e) => setTruckCode(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm text-ink font-normal"
            >
              {TRUCKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.wardName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-semibold text-neutral-500">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm text-ink font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-neutral-500 md:col-span-2">
          Message
          <input
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 200))}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm text-ink font-normal"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={invalid || !title || send.isPending}
          onClick={() => { setStatus(null); send.mutate(); }}
          className="h-10 px-4 rounded-lg bg-ink text-white text-sm font-semibold disabled:bg-neutral-200 disabled:text-neutral-400 inline-flex items-center gap-2"
        >
          <TruckIcon className="w-4 h-4" />
          {send.isPending ? "Sending…" : "Send test push"}
        </button>
        {status && <span className="text-xs text-neutral-600">{status}</span>}
      </div>
    </div>
  );
}