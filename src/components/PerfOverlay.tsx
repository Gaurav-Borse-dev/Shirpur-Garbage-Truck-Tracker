import { usePerf } from "@/store/perf";

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

  const tone = fps >= 55 ? "#22C55E" : fps >= 40 ? "#EAB308" : "#EF4444";

  return (
    <div className="fixed bottom-3 left-3 z-[1000] pointer-events-auto">
      {enabled ? (
        <div className="rounded-xl bg-neutral-900/92 backdrop-blur text-white text-[11px] font-mono shadow-lg px-3 py-2 w-[186px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold tracking-wide">PERF</span>
            <button onClick={toggle} className="text-neutral-400 hover:text-white" aria-label="Hide performance overlay">
              ✕
            </button>
          </div>
          <Row label="FPS" value={String(fps)} color={tone} />
          <Row label="Commits/s" value={String(commits)} />
          <Row label="Renders/s" value={String(renders)} />
          <Row label="Latency" value={`${latencyMs} ms`} />
          <Row label="Trucks" value={String(trucks)} />
          <div className="mt-1.5 text-[9px] text-neutral-400 leading-tight">
            Target 60 FPS · marker updates capped at 30/s
          </div>
        </div>
      ) : (
        <button
          onClick={toggle}
          className="rounded-full bg-neutral-900/85 text-white text-[10px] font-bold px-2.5 h-7 shadow-md hover:bg-neutral-900"
          aria-label="Show performance overlay"
        >
          FPS
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
