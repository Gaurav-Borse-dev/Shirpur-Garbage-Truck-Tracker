import { create } from "zustand";

type Metrics = {
  fps: number;
  commits: number; // throttled GPS batches committed per second
  renders: number; // truck-marker renders per second
  latencyMs: number; // batch arrival -> committed store update
  trucks: number;
  activeTrucks: number;
  droppedFrames: number;
  memoryMb: number;
  socketState: "live" | "reconnecting";
};

type PerfState = Metrics & {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (v: boolean) => void;
  _report: (m: Metrics) => void;
};

let renderCount = 0;
/** Called by memoized marker components each time they actually re-render. */
export function bumpRender() {
  renderCount++;
}
export function drainRenderCount() {
  const n = renderCount;
  renderCount = 0;
  return n;
}

export const usePerf = create<PerfState>((set) => ({
  enabled: false,
  fps: 0,
  commits: 0,
  renders: 0,
  latencyMs: 0,
  trucks: 0,
  activeTrucks: 0,
  droppedFrames: 0,
  memoryMb: 0,
  socketState: "live",
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setEnabled: (enabled) => set({ enabled }),
  _report: (m) => set(m),
}));
