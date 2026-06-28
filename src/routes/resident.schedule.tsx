import { createFileRoute } from "@tanstack/react-router";
import { getSchedule } from "@/lib/schedule";
import { CheckIcon, ClockIcon } from "@/components/icons";

export const Route = createFileRoute("/resident/schedule")({
  component: () => {
    const days = getSchedule();
    return (
      <div className="absolute inset-0 overflow-y-auto bg-white">
        <div className="px-6 pt-8 pb-4">
          <div className="text-xs text-neutral-400 font-semibold">THIS WEEK</div>
          <h1 className="text-2xl font-bold text-ink mt-1">Pickup Schedule</h1>
        </div>
        <div className="px-4 pb-8 space-y-2">
          {days.map((d) => (
            <div
              key={d.day + d.date}
              className={`rounded-2xl border p-4 flex items-center gap-4 ${
                d.status === "today" ? "border-brand bg-brand-soft/40" : "border-neutral-200 bg-white"
              }`}
            >
              <div className="w-14 text-center">
                <div className="text-xs font-semibold text-neutral-500">{d.day}</div>
                <div className="text-lg font-bold text-ink">{d.date.split(" ")[0]}</div>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-ink text-sm">{d.window}</div>
                <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                  <ClockIcon className="w-3 h-3" /> Estimated window
                </div>
              </div>
              {d.status === "completed" && (
                <span className="ct-pill bg-neutral-100 text-neutral-500">
                  <CheckIcon className="w-3 h-3" /> Done
                </span>
              )}
              {d.status === "today" && <span className="ct-pill bg-brand text-white">Today</span>}
              {d.status === "upcoming" && <span className="ct-pill bg-neutral-100 text-neutral-500">Upcoming</span>}
            </div>
          ))}
        </div>
      </div>
    );
  },
});