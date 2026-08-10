import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyDevices, removeMyDevice } from "@/lib/push.functions";
import { registerThisDevice } from "@/lib/push-client";
import { BellIcon, ChevronLeft, CheckIcon } from "@/components/icons";
import { useToast, ToastHost } from "@/components/Toast";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: "Registered Devices · CleanTrack" },
      {
        name: "description",
        content:
          "View every phone or browser registered for CleanTrack push alerts and remove the ones you no longer use.",
      },
      { property: "og:title", content: "Registered Devices · CleanTrack" },
      {
        property: "og:description",
        content: "Manage the devices that receive CleanTrack garbage truck notifications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevicesPage,
});

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DevicesPage() {
  const tr = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const push = useToast((s) => s.push);

  const { data, isLoading } = useQuery({
    queryKey: ["my-devices"],
    queryFn: () => listMyDevices(),
    staleTime: 10_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeMyDevice({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-devices"] });
      push({ title: tr("Device removed"), tone: "default" });
    },
    onError: () => push({ title: tr("Could not remove device"), tone: "warning" }),
  });

  const addThis = useMutation({
    mutationFn: () => registerThisDevice(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["my-devices"] });
      push({
        title: res.ok ? tr("This device registered") : tr("Could not register this device"),
        subtitle: res.ok
          ? undefined
          : res.reason === "denied"
            ? tr("Allow notifications for this site first.")
            : tr("No push token is available on this device."),
        tone: res.ok ? "success" : "warning",
      });
    },
  });

  const devices = data?.devices ?? [];

  return (
    <div className="min-h-screen bg-white text-ink">
      <ToastHost />
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-16">
        <div className="flex items-center gap-3">
          <button
            aria-label={tr("Back")}
            onClick={() => navigate({ to: "/resident/notifications" })}
            className="w-9 h-9 rounded-full bg-neutral-100 grid place-items-center text-neutral-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs text-neutral-400 font-semibold">{tr("SETTINGS")}</div>
            <h1 className="text-2xl font-bold leading-tight">{tr("Registered devices")}</h1>
          </div>
        </div>

        <p className="text-sm text-neutral-500 mt-4">
          {tr("These devices can receive CleanTrack push alerts. Remove any you no longer use.")}
        </p>

        <button
          onClick={() => addThis.mutate()}
          disabled={addThis.isPending}
          className="mt-4 h-10 px-4 rounded-xl bg-ink text-white text-sm font-semibold disabled:opacity-50"
        >
          {addThis.isPending ? tr("Registering…") : tr("Register this device")}
        </button>

        <div className="mt-6 rounded-2xl border border-neutral-200 overflow-hidden">
          {isLoading && <div className="px-5 py-6 text-sm text-neutral-500">{tr("Loading…")}</div>}
          {!isLoading && data?.ok === false && (
            <div className="px-5 py-6 text-sm text-neutral-500">
              {tr("Sign in to manage your devices.")}
            </div>
          )}
          {!isLoading && data?.ok && devices.length === 0 && (
            <div className="px-5 py-6 text-sm text-neutral-500">
              {tr("No devices registered yet.")}
            </div>
          )}
          {devices.map((d, i) => (
            <div
              key={d.id}
              className={`flex items-center gap-4 px-5 py-4 ${i ? "border-t border-neutral-100" : ""}`}
            >
              <div className="w-9 h-9 rounded-lg grid place-items-center bg-brand-soft text-brand">
                <BellIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold capitalize">
                  {d.platform} · {d.tokenPreview}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {tr("Last active")} {formatWhen(d.lastSeenAt)}
                  {d.userAgent ? ` · ${d.userAgent.slice(0, 60)}` : ""}
                </div>
              </div>
              <button
                onClick={() => remove.mutate(d.id)}
                disabled={remove.isPending}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-600 disabled:opacity-50"
              >
                {tr("Remove")}
              </button>
            </div>
          ))}
        </div>

        {devices.length > 0 && (
          <div className="mt-4 text-xs text-neutral-500 inline-flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5" />
            {devices.length} {tr("device(s) can receive alerts")}
          </div>
        )}
      </div>
    </div>
  );
}
