import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  revokeDeviceToken,
} from "@/lib/push.functions";
import { ensureNotificationPermission } from "@/lib/notifications";
import { useSettings } from "@/store/settings";
import { BellIcon, ChevronLeft } from "@/components/icons";
import { useToast } from "@/components/Toast";

export const Route = createFileRoute("/resident/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings · CleanTrack Shirpur" },
      {
        name: "description",
        content:
          "Turn nearby garbage truck alerts on or off and choose how often CleanTrack notifies you about collection in your Shirpur ward.",
      },
      { property: "og:title", content: "Notification Settings · CleanTrack Shirpur" },
      {
        property: "og:description",
        content: "Control nearby-truck push alerts and alert frequency for your Shirpur address.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationSettingsPage,
});

const FREQUENCIES = [
  { value: "immediate", label: "Every alert", hint: "Notify me each time a truck comes close" },
  { value: "every_15m", label: "At most every 15 min", hint: "Group alerts into 15 minute windows" },
  { value: "hourly", label: "Hourly", hint: "One alert per hour at most" },
  { value: "daily", label: "Daily summary", hint: "One alert a day" },
] as const;

type Frequency = (typeof FREQUENCIES)[number]["value"];

function NotificationSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  const radius = useSettings((s) => s.alertRadius);
  const setNotifications = useSettings((s) => s.setNotifications);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => getNotificationPrefs(),
    staleTime: 15_000,
  });

  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<Frequency>("immediate");

  useEffect(() => {
    if (!data?.prefs) return;
    setEnabled(data.prefs.nearbyAlertsEnabled);
    setFrequency(data.prefs.alertFrequency as Frequency);
  }, [data?.prefs]);

  const save = useMutation({
    mutationFn: async (next: { nearbyAlertsEnabled: boolean; alertFrequency: Frequency }) => {
      if (next.nearbyAlertsEnabled) await ensureNotificationPermission();
      else await revokeDeviceToken({ data: {} });
      return saveNotificationPrefs({ data: next });
    },
    onSuccess: (_res, next) => {
      setNotifications(next.nearbyAlertsEnabled);
      void qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      push({
        title: next.nearbyAlertsEnabled ? "Alerts updated" : "Alerts turned off",
        subtitle: next.nearbyAlertsEnabled
          ? "You'll be notified when a truck is nearby."
          : "Your devices were unregistered from push alerts.",
        tone: next.nearbyAlertsEnabled ? "success" : "default",
      });
    },
    onError: () => push({ title: "Could not save settings", tone: "warning" }),
  });

  const dirty =
    !!data?.prefs &&
    (enabled !== data.prefs.nearbyAlertsEnabled || frequency !== data.prefs.alertFrequency);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-white">
      <div className="px-6 pt-8 pb-2 flex items-center gap-3">
        <button
          aria-label="Back to profile"
          onClick={() => navigate({ to: "/resident/profile" })}
          className="w-9 h-9 rounded-full bg-neutral-100 grid place-items-center text-neutral-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="text-xs text-neutral-400 font-semibold">SETTINGS</div>
          <h1 className="text-2xl font-bold text-ink leading-tight">Notifications</h1>
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="rounded-2xl border border-neutral-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand grid place-items-center">
            <BellIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink">Nearby truck alerts</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Within {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} of your address
            </div>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            aria-label="Enable nearby truck alerts"
            onClick={() => setEnabled((v) => !v)}
            className={`w-12 h-7 rounded-full transition-colors relative ${enabled ? "bg-brand" : "bg-neutral-200"}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </div>
      </div>

      <div className={`px-6 mt-6 transition-opacity ${enabled ? "" : "opacity-40 pointer-events-none"}`}>
        <h2 className="text-sm font-bold text-ink">Alert frequency</h2>
        <div className="mt-3 space-y-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              onClick={() => setFrequency(f.value)}
              className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                frequency === f.value ? "border-ink bg-neutral-50" : "border-neutral-200"
              }`}
            >
              <div className="text-sm font-semibold text-ink">{f.label}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{f.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6 text-xs text-neutral-500">
        {isLoading
          ? "Loading your settings…"
          : data?.pushReady
            ? `${data.devices} device${data.devices === 1 ? "" : "s"} registered for push alerts.`
            : "Push delivery is not configured yet — you'll still see in-app alerts."}
      </div>

      <div className="px-6 mt-6 pb-12">
        <button
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ nearbyAlertsEnabled: enabled, alertFrequency: frequency })}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}