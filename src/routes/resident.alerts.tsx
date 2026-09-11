import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, BellIcon, ClockIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { getResidentAlerts } from "@/lib/alerts.functions";

export const Route = createFileRoute("/resident/alerts")({
  component: () => {
    const tr = useT();

    // Fetch real alert history from the database
    const { data: result } = useQuery({
      queryKey: ["resident-alerts"],
      queryFn: () => getResidentAlerts(),
      staleTime: 30_000,
      refetchInterval: 60_000,
    });

    const items = result?.alerts ?? [];

    return (
      <div className="absolute inset-0 overflow-y-auto bg-white">
        <div className="px-6 pt-8 pb-4">
          <div className="text-xs text-neutral-400 font-semibold">{tr("HISTORY")}</div>
          <h1 className="text-2xl font-bold text-ink mt-1">{tr("Alerts")}</h1>
        </div>
        <div className="px-4 pb-8 space-y-2">
          {items.length === 0 && (
            <div className="text-center py-12 text-sm text-neutral-400">
              {tr("No alerts yet. You'll see notifications here when a garbage truck is near your area.")}
            </div>
          )}
          {items.map((it) => {
            const tone =
              it.tone === "success" ? "bg-brand-soft text-brand" :
              it.tone === "warn" ? "bg-red-50 text-red-600" :
              "bg-amber-50 text-amber-700";
            const Icon = it.tone === "success" ? CheckIcon : it.tone === "warn" ? ClockIcon : BellIcon;
            return (
              <div key={it.id} className="rounded-2xl border border-neutral-200 p-4 flex items-center gap-3 bg-white">
                <div className={`w-10 h-10 rounded-xl grid place-items-center ${tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink text-sm truncate">{it.title}</div>
                  <div className="text-xs text-neutral-500 truncate">{it.subtitle}</div>
                </div>
                <div className="text-[11px] text-neutral-400 whitespace-nowrap">{it.ago}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
});