import { create } from "zustand";

type PerfState = {
  enabled: boolean;
  fps: number;
  frames: number;
  commits: number; // store commits (throttled GPS batches) per second
  renders: number; // component renders per second
  latencyMs: number; // time from batch arrival to committed store update
  trucks: number;
  toggle: () => void;
  setEnabled: (v: boolean) => void;
  reportRender: () => void;
  _report: (p: Partial<Pick<PerfState, "fps" | "frames" | "commits" | "latencyMs" | "trucks">>) => void;
};

let renderCount = 0;

export const usePerf = create<PerfState>((set) => ({
  enabled: false,
  fps: 0,
  frames: 0,
  commits: 0,
  renders: 0,
  latencyMs: 0,
  trucks: 0,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setEnabled: (enabled) => set({ enabled }),
  reportRender: () => {
    renderCount++;
  },
  _report: (p) => set({ ...p, renders: renderCount, ...(renderCount ? {} : {}) }),
}));

export function drainRenderCount() {
  const n = renderCount;
  renderCount = 0;
  return n;
}

export function bumpRender() {
  renderCount++;
}
