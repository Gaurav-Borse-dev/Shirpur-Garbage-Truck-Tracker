import { create } from "zustand";
import { TRUCKS, makeRoute, SHIRPUR, type Truck } from "@/lib/trucks";
import { bearing, haversine, lerpAngle, lerpLatLng, type LatLng } from "@/lib/geo";
import { usePerf, drainRenderCount } from "@/store/perf";

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
  history: { at: number; pos: LatLng }[]; // ring buffer for replay
  lastUpdate: number;
};

type TrucksState = {
  trucks: Record<string, LiveTruck>;
  tick: number;
  connection: "live" | "reconnecting";
  lastDrop: number | null;
  setStatus: (id: string, status: LiveTruck["status"]) => void;
  setDriverOnline: (id: string, online: boolean) => void;
  completeStop: (id: string) => void;
  assignTruck: (
    id: string,
    patch: { wardName?: string; city?: "Shirpur" },
  ) => string | null;
  setConnection: (c: "live" | "reconnecting") => void;
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
    history: [],
    lastUpdate: Date.now(),
  };
}

const initial: Record<string, LiveTruck> = Object.fromEntries(TRUCKS.map((t) => [t.id, initLive(t)]));

// ~20 km/h => 5.55 m/s
const SPEED_MPS = 5.5;
const HISTORY_CAP = 600; // ~5 min @ 2Hz capture
const HISTORY_INTERVAL_MS = 500;

export const useTrucks = create<TrucksState>((set, get) => ({
  trucks: initial,
  tick: 0,
  connection: "live",
  lastDrop: null,
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
  assignTruck: (id, patch) => {
    const state = get();
    const lt = state.trucks[id];
    if (!lt) return "Truck not found";
    const nextWard = (patch.wardName ?? lt.truck.wardName).trim();
    const nextCity = patch.city ?? lt.truck.city;
    if (!nextWard || nextWard.length < 3) return "Ward name is required";
    if (nextWard.length > 80) return "Ward name too long";
    // Conflict: same ward + city assigned to a DIFFERENT online truck
    const conflict = Object.values(state.trucks).some(
      (o) =>
        o.id !== id &&
        o.status !== "offline" &&
        o.truck.city === nextCity &&
        o.truck.wardName.trim().toLowerCase() === nextWard.toLowerCase(),
    );
    if (conflict) return "Another active truck already covers this ward";
    const center = SHIRPUR;
    const seed = hashCode(id + nextWard + nextCity);
    const newRoute =
      patch.city || patch.wardName
        ? makeRoute(
            { lat: center.lat + ((seed % 17) - 8) * 0.0012, lng: center.lng + ((seed % 13) - 6) * 0.0012 },
            seed,
            0.8,
            12,
          )
        : lt.truck.route;
    const newTruck: Truck = {
      ...lt.truck,
      wardName: nextWard,
      city: nextCity,
      route: newRoute,
    };
    const a = newTruck.route[0];
    const b = newTruck.route[1] ?? newTruck.route[0];
    set({
      trucks: {
        ...state.trucks,
        [id]: {
          ...lt,
          truck: newTruck,
          position: a,
          bearing: bearing(a, b),
          segmentIndex: 0,
          segmentT: 0,
          completedStops: 0,
          trail: [],
          history: [],
          lastUpdate: Date.now(),
        },
      },
      tick: state.tick + 1,
    });
    return null;
  },
  setConnection: (connection) =>
    set((s) => ({ connection, lastDrop: connection === "reconnecting" ? Date.now() : s.lastDrop })),
  _step: (dtMs) => {
    const state = get();
    // Hard-pause stepping while reconnecting so positions don't jump on resume
    if (state.connection === "reconnecting") return;
    const next: Record<string, LiveTruck> = {};
    let changed = false;
    const now = Date.now();
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
      let history = lt.history;
      if (now - lt.lastUpdate >= HISTORY_INTERVAL_MS) {
        history = lt.history.length >= HISTORY_CAP ? lt.history.slice(-HISTORY_CAP + 1) : lt.history.slice();
        history.push({ at: now, pos });
      }
      next[id] = {
        ...lt,
        position: pos,
        bearing: bear,
        segmentIndex: segIdx,
        segmentT: t,
        trail,
        history,
        lastUpdate: history === lt.history ? lt.lastUpdate : now,
      };
      changed = true;
    }
    if (changed) set({ trucks: next, tick: state.tick + 1 });
  },
}));

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Global RAF loop (runs once in client)
let started = false;
export function startSimulation() {
  if (started || typeof window === "undefined") return;
  started = true;
  let last = performance.now();
  const loop = (now: number) => {
    // Clamp dt so a tab-resume or reconnect never jumps trucks forward
    const dt = Math.min(80, now - last);
    last = now;
    useTrucks.getState()._step(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // --- "WebSocket" simulation: detect online / offline / hidden tab ---
  const set = (c: "live" | "reconnecting") => {
    if (useTrucks.getState().connection !== c) useTrucks.getState().setConnection(c);
    // Reset RAF clock on resume to avoid a giant dt the next frame
    last = performance.now();
  };
  const goOffline = () => set("reconnecting");
  const goOnline = () => {
    // Simulate a short reconnect handshake before resuming smoothly
    set("reconnecting");
    setTimeout(() => set("live"), 700);
  };
  window.addEventListener("offline", goOffline);
  window.addEventListener("online", goOnline);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) goOffline();
    else goOnline();
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) goOffline();
}