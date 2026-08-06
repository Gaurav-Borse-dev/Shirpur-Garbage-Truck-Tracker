import { create } from "zustand";
import { TRUCKS, makeRoute, SHIRPUR, type Truck } from "@/lib/trucks";
import { bearing, haversine, lerpAngle, lerpLatLng, smoothClosedPath, turnAngle, type LatLng } from "@/lib/geo";
import { usePerf, drainRenderCount } from "@/store/perf";
import { readCache, writeCache } from "@/lib/cache";
import { startOfflineWatcher } from "@/store/offline";
import { LIVE_BACKEND, SOCKET_ENABLED } from "@/lib/backend";

export type LiveTruck = {
  id: string;
  truck: Truck;
  /** Dense, spline-smoothed drive path derived from the sparse waypoints. */
  path: LatLng[];
  position: LatLng;
  bearing: number;
  /** Current ground speed in m/s (accelerates/decelerates through curves). */
  speedMps: number;
  status: "offline" | "online" | "collecting";
  segmentIndex: number; // current waypoint index
  segmentT: number; // 0..1 progress within segment
  completedStops: number;
  trail: LatLng[];
  history: { at: number; pos: LatLng }[]; // ring buffer for replay
  lastUpdate: number;
  /** Latest GPS fix received from the backend (live mode only). */
  fix?: { pos: LatLng; bearing: number; speedMps: number; at: number };
};

/** A GPS fix as delivered by the backend transport. */
export type TruckFix = {
  truckId: string;
  lat: number;
  lng: number;
  /** Backend-reported heading in degrees; omitted values are derived from the fix delta. */
  heading?: number;
  /** Backend-reported ground speed in m/s. */
  speed?: number;
  /** Backend timestamp (ms epoch or ISO). */
  ts?: number | string;
  status?: LiveTruck["status"];
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
  /** Apply a batch of backend GPS fixes. Interpolation happens in _step. */
  ingestFixes: (fixes: TruckFix[]) => void;
  /** Apply a backend-provided route/stop assignment. */
  applyRoute: (truckId: string, route: LatLng[], totalStops?: number) => void;
  _step: (dtMs: number) => void;
};

function initLive(truck: Truck): LiveTruck {
  const path = smoothClosedPath(truck.route, 8);
  const a = path[0];
  const b = path[1] ?? path[0];
  return {
    id: truck.id,
    truck,
    path,
    position: a,
    bearing: bearing(a, b),
    speedMps: 0,
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

// ~20 km/h cruise, with realistic acceleration through the curved path
const CRUISE_MPS = 5.5;
const ACCEL_MPS2 = 1.1;
const DECEL_MPS2 = 2.2;
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
    const newPath = smoothClosedPath(newTruck.route, 8);
    const a = newPath[0];
    const b = newPath[1] ?? newPath[0];
    set({
      trucks: {
        ...state.trucks,
        [id]: {
          ...lt,
          truck: newTruck,
          path: newPath,
          position: a,
          bearing: bearing(a, b),
          speedMps: 0,
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
  ingestFixes: (fixes) => {
    if (!fixes.length) return;
    const state = get();
    const next = { ...state.trucks };
    let changed = false;
    for (const f of fixes) {
      const lt = next[f.truckId];
      if (!lt) continue;
      const pos = { lat: f.lat, lng: f.lng };
      const at = typeof f.ts === "string" ? Date.parse(f.ts) : (f.ts ?? Date.now());
      const prev = lt.fix?.pos ?? lt.position;
      const heading = f.heading ?? (haversine(prev, pos) > 1 ? bearing(prev, pos) : lt.bearing);
      next[f.truckId] = {
        ...lt,
        status: f.status ?? lt.status,
        fix: { pos, bearing: heading, speedMps: f.speed ?? 0, at },
      };
      changed = true;
    }
    if (changed) set({ trucks: next, tick: state.tick + 1 });
  },
  applyRoute: (truckId, route, totalStops) => {
    const state = get();
    const lt = state.trucks[truckId];
    if (!lt || route.length < 2) return;
    const path = smoothClosedPath(route, 8);
    set({
      trucks: {
        ...state.trucks,
        [truckId]: {
          ...lt,
          truck: { ...lt.truck, route, totalStops: totalStops ?? lt.truck.totalStops },
          path,
          trail: [],
        },
      },
      tick: state.tick + 1,
    });
  },
  _step: (dtMs) => {
    const state = get();
    // Hard-pause stepping while reconnecting so positions don't jump on resume
    if (state.connection === "reconnecting") return;
    const next: Record<string, LiveTruck> = {};
    let changed = false;
    const now = Date.now();
    // --- LIVE MODE: no motion is generated locally. We only ease the marker
    // toward the last GPS fix received from the backend (position, heading and
    // speed all originate server-side).
    if (LIVE_BACKEND) {
      for (const id in state.trucks) {
        const lt = state.trucks[id];
        if (!lt.fix) {
          next[id] = lt;
          continue;
        }
        const gap = haversine(lt.position, lt.fix.pos);
        if (gap < 0.3 && Math.abs(lt.speedMps - lt.fix.speedMps) < 0.05) {
          next[id] = lt;
          continue;
        }
        // Ease over ~1 fix interval so 3-5s backend updates render continuously.
        const k = Math.min(1, dtMs / 900);
        const pos = lerpLatLng(lt.position, lt.fix.pos, k);
        const bear = lerpAngle(lt.bearing, lt.fix.bearing, Math.min(1, dtMs / 260));
        const trail = lt.trail.length > 24 ? lt.trail.slice(-24) : lt.trail.slice();
        trail.push(pos);
        let history = lt.history;
        let lastUpdate = lt.lastUpdate;
        if (now - lt.lastUpdate >= HISTORY_INTERVAL_MS) {
          history = lt.history.length >= HISTORY_CAP ? lt.history.slice(-HISTORY_CAP + 1) : lt.history.slice();
          history.push({ at: now, pos });
          lastUpdate = now;
        }
        next[id] = { ...lt, position: pos, bearing: bear, speedMps: lt.fix.speedMps, trail, history, lastUpdate };
        changed = true;
      }
      if (changed) set({ trucks: next, tick: state.tick + 1 });
      return;
    }
    for (const id in state.trucks) {
      const lt = state.trucks[id];
      if (lt.status === "offline") {
        next[id] = lt;
        continue;
      }
      const route = lt.path;
      const a = route[lt.segmentIndex % route.length];
      const b = route[(lt.segmentIndex + 1) % route.length];
      const segLen = Math.max(0.5, haversine(a, b));
      // --- speed model: ease down into curves, accelerate out of them ---
      const ahead = route[(lt.segmentIndex + 3) % route.length];
      const curve = turnAngle(a, b, ahead); // 0..180
      const curveFactor = Math.max(0.45, 1 - curve / 60);
      const target = CRUISE_MPS * curveFactor;
      const dtS = dtMs / 1000;
      const accel = target > lt.speedMps ? ACCEL_MPS2 : -DECEL_MPS2;
      let speed = lt.speedMps + accel * dtS;
      speed = accel > 0 ? Math.min(target, speed) : Math.max(target, speed);
      speed = Math.max(0.8, speed);
      const advanceM = speed * dtS;
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
      // Heading smoothing: slower easing at speed, snappier when crawling.
      bear = lerpAngle(bear, targetBearing, Math.min(1, dtMs / (180 + speed * 30)));
      const trail = lt.trail.length > 24 ? lt.trail.slice(-24) : lt.trail.slice();
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
        speedMps: speed,
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
/** Marker/polyline update budget: never commit GPS batches faster than this. */
const UPDATE_FPS_BUDGET = 30;
const UPDATE_INTERVAL_MS = 1000 / UPDATE_FPS_BUDGET;
type Snapshot = Record<string, { position: LatLng; bearing: number; segmentIndex: number; segmentT: number; completedStops: number; status: LiveTruck["status"] }>;
const SNAPSHOT_KEY = "trucks";

/** Restore last-known truck state so an offline/cold start isn't blank. */
function restoreSnapshot() {
  const snap = readCache<Snapshot>(SNAPSHOT_KEY, 1000 * 60 * 30);
  if (!snap) return;
  const cur = useTrucks.getState().trucks;
  const next: Record<string, LiveTruck> = { ...cur };
  let changed = false;
  for (const id in snap) {
    const lt = cur[id];
    const s = snap[id];
    if (!lt || !s) continue;
    next[id] = { ...lt, ...s, trail: [], lastUpdate: Date.now() };
    changed = true;
  }
  if (changed) useTrucks.setState({ trucks: next, tick: useTrucks.getState().tick + 1 });
}

function persistSnapshot() {
  const trucks = useTrucks.getState().trucks;
  const snap: Snapshot = {};
  for (const id in trucks) {
    const t = trucks[id];
    snap[id] = {
      position: t.position,
      bearing: t.bearing,
      segmentIndex: t.segmentIndex,
      segmentT: t.segmentT,
      completedStops: t.completedStops,
      status: t.status,
    };
  }
  writeCache(SNAPSHOT_KEY, snap);
}

export function startSimulation() {
  if (started || typeof window === "undefined") return;
  started = true;
  startOfflineWatcher();
  restoreSnapshot();
  if (SOCKET_ENABLED) {
    // Live mode: open the backend transport. The RAF loop below only
    // interpolates between backend GPS fixes — it generates no motion.
    void import("@/lib/realtime").then((m) => m.getSocket());
  }
  const snapshotTimer = window.setInterval(persistSnapshot, 10_000);
  window.addEventListener("pagehide", () => {
    window.clearInterval(snapshotTimer);
    persistSnapshot();
  });
  let last = performance.now();
  // Throttling + batching: GPS deltas accumulate between commits, so the store
  // (and therefore every marker/polyline) updates at most UPDATE_FPS_BUDGET/s.
  let pending = 0;
  let sinceCommit = 0;
  let batchStart = performance.now();
  // Perf sampling
  let frames = 0;
  let commits = 0;
  let latencySum = 0;
  let latencySamples = 0;
  let sampleStart = performance.now();
  const loop = (now: number) => {
    // Clamp dt so a tab-resume or reconnect never jumps trucks forward
    const dt = Math.min(80, now - last);
    last = now;
    frames++;
    if (pending === 0) batchStart = now;
    pending += dt;
    sinceCommit += dt;
    if (sinceCommit >= UPDATE_INTERVAL_MS) {
      const batched = pending;
      pending = 0;
      sinceCommit = 0;
      useTrucks.getState()._step(batched);
      commits++;
      latencySum += performance.now() - batchStart;
      latencySamples++;
    }
    if (usePerf.getState().enabled && now - sampleStart >= 1000) {
      const secs = (now - sampleStart) / 1000;
      const state = useTrucks.getState();
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      usePerf.getState()._report({
        fps: Math.round(frames / secs),
        commits: Math.round(commits / secs),
        renders: Math.round(drainRenderCount() / secs),
        latencyMs: latencySamples ? Math.round((latencySum / latencySamples) * 10) / 10 : 0,
        trucks: Object.keys(state.trucks).length,
        activeTrucks: Object.values(state.trucks).filter((t) => t.status !== "offline").length,
        droppedFrames: Math.max(0, Math.round(60 * secs) - frames),
        memoryMb: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
        socketState: state.connection,
      });
      frames = 0;
      commits = 0;
      latencySum = 0;
      latencySamples = 0;
      sampleStart = now;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // --- "WebSocket" simulation: detect online / offline / hidden tab ---
  const set = (c: "live" | "reconnecting") => {
    if (useTrucks.getState().connection !== c) useTrucks.getState().setConnection(c);
    // Reset RAF clock on resume to avoid a giant dt the next frame
    last = performance.now();
    pending = 0;
    sinceCommit = 0;
  };
  const goOffline = () => set("reconnecting");
  const goOnline = () => {
    // Simulate a short reconnect handshake before resuming smoothly
    set("reconnecting");
    setTimeout(() => set("live"), 700);
  };
  window.addEventListener("offline", goOffline);
  window.addEventListener("online", goOnline);
  if (!LIVE_BACKEND) {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) goOffline();
      else goOnline();
    });
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) goOffline();
}
/** Per-truck subscription: components re-render only when *their* truck changes. */
export function useTruck(id: string | undefined) {
  return useTrucks((s) => (id ? s.trucks[id] : undefined));
}
