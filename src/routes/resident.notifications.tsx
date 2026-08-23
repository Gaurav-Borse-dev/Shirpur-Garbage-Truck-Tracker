import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotificationPrefs, saveNotificationPrefs, sendSelfTestPush } from "@/lib/push.functions";
import { ensureNotificationPermission } from "@/lib/notifications";
import {
  permissionState as readPermission,
  registerThisDevice,
  unregisterThisDevice,
} from "@/lib/push-client";
import { useSettings } from "@/store/settings";
import { BellIcon, ChevronLeft } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";

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
type Permission = "default" | "granted" | "denied" | "unsupported";

function NotificationSettingsPage() {
  const tr = useT();
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
  const [permission, setPermission] = useState<Permission>("default");
  const [asking, setAsking] = useState(false);

  useEffect(() => setPermission(readPermission()), []);

  useEffect(() => {
    if (!data?.prefs) return;
    setEnabled(data.prefs.nearbyAlertsEnabled);
    setFrequency(data.prefs.alertFrequency as Frequency);
  }, [data?.prefs]);

  const save = useMutation({
    mutationFn: async (next: { nearbyAlertsEnabled: boolean; alertFrequency: Frequency }) => {
      let state: Permission = readPermission();
      if (next.nearbyAlertsEnabled) {
        if (state === "default") state = (await ensureNotificationPermission()) ? "granted" : readPermission();
        // Registers this device (native FCM token when the app runs inside the
        // mobile wrapper) so nearby-truck pushes can actually be delivered.
        if (state === "granted") await registerThisDevice({ requirePermission: false });
      } else {
        await unregisterThisDevice();
      }
      setPermission(state);
      return saveNotificationPrefs({ data: { ...next, permissionState: state } });
    },
    onSuccess: (_res, next) => {
      setNotifications(next.nearbyAlertsEnabled);
      void qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      push({
        title: next.nearbyAlertsEnabled ? tr("Alerts updated") : tr("Alerts turned off"),
        subtitle: next.nearbyAlertsEnabled
          ? tr("You'll be notified when a truck is nearby.")
          : tr("Your devices were unregistered from push alerts."),
        tone: next.nearbyAlertsEnabled ? "success" : "default",
      });
    },
    onError: () => push({ title: tr("Could not save settings"), tone: "warning" }),
  });

  const dirty =
    !!data?.prefs &&
    (enabled !== data.prefs.nearbyAlertsEnabled || frequency !== data.prefs.alertFrequency);

  const selfTest = useMutation({
    mutationFn: () => sendSelfTestPush({ data: {} }),
    onSuccess: (res) => {
      if (!res.ok) return push({ title: tr("Sign in to send a test alert"), tone: "warning" });
      const label =
        res.skipped === "not_configured"
          ? tr("Push delivery is not configured yet.")
          : res.skipped === "no_devices"
            ? tr("No registered devices — allow notifications first.")
            : `${tr("Delivered to")} ${res.sent} ${tr("device(s)")}${res.failed ? `, ${res.failed} ${tr("failed")}` : ""}.`;
      push({
        title: tr("Nearby-truck test alert"),
        subtitle: label,
        tone: res.sent ? "success" : "warning",
      });
    },
    onError: () => push({ title: tr("Test alert failed"), tone: "warning" }),
  });

  async function askPermission() {
    setAsking(true);
    try {
      const granted = await ensureNotificationPermission();
      const state = readPermission();
      setPermission(state);
      if (granted) await registerThisDevice({ requirePermission: false });
      await saveNotificationPrefs({
        data: { nearbyAlertsEnabled: enabled, alertFrequency: frequency, permissionState: state },
      });
      void qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      push({
        title: granted ? tr("Notifications allowed") : tr("Permission not granted"),
        subtitle: granted
          ? tr("This device is registered for nearby-truck alerts.")
          : tr("Enable notifications for this site in your browser settings."),
        tone: granted ? "success" : "warning",
      });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-white">
      <div className="px-6 pt-8 pb-2 flex items-center gap-3">
        <button
          aria-label={tr("Back to profile")}
          onClick={() => navigate({ to: "/resident/profile" })}
          className="w-9 h-9 rounded-full bg-neutral-100 grid place-items-center text-neutral-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="text-xs text-neutral-400 font-semibold">{tr("SETTINGS")}</div>
          <h1 className="text-2xl font-bold text-ink leading-tight">{tr("Notifications")}</h1>
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="rounded-2xl border border-neutral-200 p-4 mb-4">
          <div className="text-sm font-bold text-ink">{tr("Step 1 · Device permission")}</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {permission === "granted"
              ? tr("This device is allowed to show CleanTrack notifications.")
              : permission === "denied"
                ? tr("Notifications are blocked. Allow them for this site in your browser settings, then retry.")
                : permission === "unsupported"
                  ? tr("This device can't show system notifications — in-app alerts still work.")
                  : tr("Allow notifications so alerts reach you even when CleanTrack is closed.")}
          </div>
          {permission !== "granted" && permission !== "unsupported" && (
            <button
              onClick={() => void askPermission()}
              disabled={asking}
              className="mt-3 h-10 px-4 rounded-xl bg-ink text-white text-sm font-semibold disabled:opacity-50"
            >
              {asking ? tr("Requesting…") : tr("Allow notifications")}
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand grid place-items-center">
            <BellIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink">{tr("Nearby truck alerts")}</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {tr("Within")} {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} {tr("of your address")}
            </div>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            aria-label={tr("Enable nearby truck alerts")}
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
        <h2 className="text-sm font-bold text-ink">{tr("Alert frequency")}</h2>
        <div className="mt-3 space-y-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              onClick={() => setFrequency(f.value)}
              className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                frequency === f.value ? "border-ink bg-neutral-50" : "border-neutral-200"
              }`}
            >
              <div className="text-sm font-semibold text-ink">{tr(f.label)}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{tr(f.hint)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6 text-xs text-neutral-500">
        {isLoading
          ? tr("Loading your settings…")
          : data?.pushReady
            ? `${data.devices} ${data.devices === 1 ? tr("device") : tr("devices")} ${tr("registered for push alerts.")}`
            : tr("Push delivery is not configured yet — you'll still see in-app alerts.")}
      </div>

      <div className="px-6 mt-6 space-y-3">
        <button
          onClick={() => {
            push({
              title: "🔔 CleanTrack Garbage Truck Alert",
              subtitle: "Truck GBR-04 is 350m away from your street · Go outside soon!",
              tone: "truck_arrived",
              sender: "CleanTrack · Shirpur Municipal Tracker",
            });
          }}
          className="w-full h-12 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors shadow-sm"
        >
          <span>🎵</span> {tr("Preview Garbage Tracker Sound & Alert")}
        </button>
        <button
          onClick={() => selfTest.mutate()}
          disabled={selfTest.isPending}
          className="w-full h-12 rounded-xl border border-neutral-200 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {selfTest.isPending ? tr("Sending test alert…") : tr("Send me a test nearby-truck alert")}
        </button>
        <button
          onClick={() => navigate({ to: "/devices" })}
          className="w-full h-12 rounded-xl border border-neutral-200 text-sm font-semibold text-ink"
        >
          {tr("Manage registered devices")}
        </button>
      </div>

      <div className="px-6 mt-6 pb-12">
        <button
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ nearbyAlertsEnabled: enabled, alertFrequency: frequency })}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {save.isPending ? tr("Saving…") : tr("Save settings")}
        </button>
      </div>
    </div>
  );
}