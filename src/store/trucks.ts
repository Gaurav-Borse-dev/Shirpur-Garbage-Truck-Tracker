import { create } from "zustand";
import { TRUCKS, type Truck } from "@/lib/trucks";
import { bearing, haversine, lerpAngle, lerpLatLng, type LatLng } from "@/lib/geo";

export type LiveTruck = {
  id: string;
  truck: Truck;
  position: LatLng;
  bearing: number;
  status: "offline" | "online" | "collecting";
  segmentIndex: number; // current waypoint index
  segmentT: number; // 0..1 progress within segment
  completedStops: number;
  trail: LatLng[];
};

type TrucksState = {
  trucks: Record<string, LiveTruck>;
  tick: number;
  setStatus: (id: string, status: LiveTruck["status"]) => void;
  setDriverOnline: (id: string, online: boolean) => void;
  completeStop: (id: string) => void;
  _step: (dtMs: number) => void;
};

function initLive(truck: Truck): LiveTruck {
  const a = truck.route[0];
  const b = truck.route[1] ?? truck.route[0];
  return {
    id: truck.id,
    truck,
    position: a,
    bearing: bearing(a, b),
    status: truck.startOnline ? "online" : "offline",
    segmentIndex: 0,
    segmentT: 0,
    completedStops: 0,
    trail: [],
  };
}

const initial: Record<string, LiveTruck> = Object.fromEntries(TRUCKS.map((t) => [t.id, initLive(t)]));

// ~20 km/h => 5.55 m/s
const SPEED_MPS = 5.5;

export const useTrucks = create<TrucksState>((set, get) => ({
  trucks: initial,
  tick: 0,
  setStatus: (id, status) =>
    set((s) => ({ trucks: { ...s.trucks, [id]: { ...s.trucks[id], status } } })),
  setDriverOnline: (id, online) =>
    set((s) => ({
      trucks: { ...s.trucks, [id]: { ...s.trucks[id], status: online ? "online" : "offline" } },
    })),
  completeStop: (id) =>
    set((s) => {
      const t = s.trucks[id];
      if (!t) return s;
      const next = Math.min(t.truck.totalStops, t.completedStops + 1);
      return { trucks: { ...s.trucks, [id]: { ...t, completedStops: next } } };
    }),
  _step: (dtMs) => {
    const state = get();
    const next: Record<string, LiveTruck> = {};
    let changed = false;
    for (const id in state.trucks) {
      const lt = state.trucks[id];
      if (lt.status === "offline") {
        next[id] = lt;
        continue;
      }
      const route = lt.truck.route;
      const a = route[lt.segmentIndex];
      const b = route[(lt.segmentIndex + 1) % route.length];
      const segLen = Math.max(1, haversine(a, b));
      const advanceM = (SPEED_MPS * dtMs) / 1000;
      let t = lt.segmentT + advanceM / segLen;
      let segIdx = lt.segmentIndex;
      let bear = lt.bearing;
      while (t >= 1) {
        t -= 1;
        segIdx = (segIdx + 1) % route.length;
      }
      const segA = route[segIdx];
      const segB = route[(segIdx + 1) % route.length];
      const pos = lerpLatLng(segA, segB, t);
      const targetBearing = bearing(segA, segB);
      bear = lerpAngle(bear, targetBearing, Math.min(1, dtMs / 250));
      const trail = lt.trail.length > 5 ? lt.trail.slice(-5) : lt.trail.slice();
      trail.push(pos);
      next[id] = { ...lt, position: pos, bearing: bear, segmentIndex: segIdx, segmentT: t, trail };
      changed = true;
    }
    if (changed) set({ trucks: next, tick: state.tick + 1 });
  },
}));

// Global RAF loop (runs once in client)
let started = false;
export function startSimulation() {
  if (started || typeof window === "undefined") return;
  started = true;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(80, now - last);
    last = now;
    useTrucks.getState()._step(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}