import { usePerf } from "@/store/perf";
import { useT } from "@/lib/i18n";

/**
 * Small debug/performance overlay for 16-truck mode.
 * Toggle with the floating "FPS" chip (bottom-left) or ?perf=1.
 */
export function PerfOverlay() {
  const enabled = usePerf((s) => s.enabled);
  const toggle = usePerf((s) => s.toggle);
  const fps = usePerf((s) => s.fps);
  const commits = usePerf((s) => s.commits);
  const renders = usePerf((s) => s.renders);
  const latencyMs = usePerf((s) => s.latencyMs);
  const trucks = usePerf((s) => s.trucks);
  const activeTrucks = usePerf((s) => s.activeTrucks);
  const droppedFrames = usePerf((s) => s.droppedFrames);
  const memoryMb = usePerf((s) => s.memoryMb);
  const socketState = usePerf((s) => s.socketState);
  const tr = useT();

  const tone = fps >= 55 ? "#22C55E" : fps >= 40 ? "#EAB308" : "#EF4444";

  return (
    <div className="fixed bottom-3 left-3 z-[1000] pointer-events-auto"
      role="status"
      aria-live="polite">
      {enabled ? (
        <div className="rounded-xl bg-neutral-900/92 backdrop-blur text-white text-[11px] font-mono shadow-lg px-3 py-2 w-[186px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold tracking-wide">{tr("PERF")}</span>
            <button onClick={toggle} className="text-neutral-400 hover:text-white" aria-label={tr("Hide performance overlay")}>
              ✕
            </button>
          </div>
          <Row label={tr("FPS")} value={String(fps)} color={tone} />
          <Row label={tr("Commits/s")} value={String(commits)} />
          <Row label={tr("Renders/s")} value={String(renders)} />
          <Row label={tr("Dropped")} value={String(droppedFrames)} color={droppedFrames > 5 ? "#EF4444" : undefined} />
          <Row label={tr("GPS delay")} value={`${latencyMs} ms`} />
          <Row label={tr("Socket")} value={socketState === "live" ? tr("live") : tr("reconnect")} color={socketState === "live" ? "#22C55E" : "#EAB308"} />
          {memoryMb > 0 && <Row label={tr("JS heap")} value={`${memoryMb} MB`} />}
          <Row label={tr("Trucks")} value={`${activeTrucks}/${trucks}`} />
          <div className="mt-1.5 text-[9px] text-neutral-400 leading-tight">
            {tr("Target 60 FPS · marker updates capped at 30/s")}
          </div>
        </div>
      ) : (
        <button
          onClick={toggle}
          className="rounded-full bg-neutral-900/85 text-white text-[10px] font-bold px-3 min-h-11 min-w-11 shadow-md hover:bg-neutral-900"
          aria-label={tr("Show performance overlay")}
        >
          {tr("FPS")}
        </button>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between leading-5">
      <span className="text-neutral-400">{label}</span>
      <span style={color ? { color } : undefined} className="font-bold">
        {value}
      </span>
    </div>
  );
}
