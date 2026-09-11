import { create } from "zustand";
import { type Truck } from "@/lib/trucks";
import { bearing, haversine, lerpAngle, lerpLatLng, smoothClosedPath, type LatLng } from "@/lib/geo";
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
  /** Whether the fleet has been loaded from the database yet. */
  dbLoaded: boolean;
  connection: "live" | "reconnecting";
  lastDrop: number | null;
  setStatus: (id: string, status: LiveTruck["status"]) => void;
  setDriverOnline: (id: string, online: boolean) => void;
  completeStop: (id: string) => void;
  setConnection: (c: "live" | "reconnecting") => void;
  /** Apply a batch of backend GPS fixes. Interpolation happens in _step. */
  ingestFixes: (fixes: TruckFix[]) => void;
  /** Apply a backend-provided route/stop assignment. */
  applyRoute: (truckId: string, route: LatLng[], totalStops?: number) => void;
  /** Replace the truck fleet with data from the database. */
  loadFleet: (trucks: Truck[]) => void;
  _step: (dtMs: number) => void;
};

const PALETTE = ["#22C55E", "#06B6D4", "#F97316", "#A855F7", "#EAB308", "#EC4899", "#0EA5E9", "#14B8A6"];

function initLive(truck: Truck): LiveTruck {
  const path = truck.route.length >= 3 ? smoothClosedPath(truck.route, 8) : [];
  const a = path[0] ?? { lat: 21.3483, lng: 74.8827 }; // Shirpur center fallback
  const b = path[1] ?? a;
  return {
    id: truck.id,
    truck,
    path,
    position: a,
    bearing: path.length >= 2 ? bearing(a, b) : 0,
    speedMps: 0,
    status: truck.startOnline ? "online" : "offline",
    segmentIndex: 0,
    segmentT: 0,
    completedStops: 0,
    trail: [],
    lastUpdate: Date.now(),
  };
}

// Start with empty fleet — loaded from DB and realtime fixes
const initial: Record<string, LiveTruck> = {};


export const useTrucks = create<TrucksState>((set, get) => ({
  trucks: initial,
  tick: 0,
  dbLoaded: false,
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
  setConnection: (connection) =>
    set((s) => ({ connection, lastDrop: connection === "reconnecting" ? Date.now() : s.lastDrop })),

  ingestFixes: (fixes) => {
    if (!fixes.length) return;
    const state = get();
    const next = { ...state.trucks };
    let changed = false;
    for (const f of fixes) {
      let lt = next[f.truckId];
      // Auto-create entry for trucks we learn about from realtime but don't have yet
      if (!lt) {
        const idx = Object.keys(next).length;
        const truck: Truck = {
          id: f.truckId,
          name: f.truckId,
          driverName: "",
          driverPhone: "",
          wardName: f.truckId,
          city: "Shirpur",
          color: PALETTE[idx % PALETTE.length],
          route: [],
          totalStops: 12,
          startOnline: true,
        };
        lt = initLive(truck);
        next[f.truckId] = lt;
      }
      const pos = { lat: f.lat, lng: f.lng };
      const at = typeof f.ts === "string" ? Date.parse(f.ts) : (f.ts ?? Date.now());
      const prev = lt.fix?.pos ?? lt.position;
      const heading = f.heading ?? (haversine(prev, pos) > 1 ? bearing(prev, pos) : lt.bearing);
      next[f.truckId] = {
        ...lt,
        status: f.status ?? (f.speed && f.speed > 0.5 ? "collecting" : "online"),
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

  loadFleet: (trucks) => {
    const state = get();
    const next: Record<string, LiveTruck> = {};
    for (const truck of trucks) {
      // Preserve existing fix/position if we already had this truck
      const existing = state.trucks[truck.id];
      if (existing) {
        next[truck.id] = {
          ...existing,
          truck: { ...truck, route: existing.truck.route.length ? existing.truck.route : truck.route },
        };
      } else {
        next[truck.id] = initLive(truck);
      }
    }
    set({ trucks: next, tick: state.tick + 1, dbLoaded: true });
  },

  _step: (dtMs) => {
    const state = get();
    // Hard-pause stepping while reconnecting so positions don't jump on resume
    if (state.connection === "reconnecting") return;
    const next: Record<string, LiveTruck> = {};
    let changed = false;
    const now = Date.now();

    for (const id in state.trucks) {
      const lt = state.trucks[id];

      // Live GPS fix received from driver device — interpolate smoothly
      if (lt.fix) {
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
        next[id] = { ...lt, position: pos, bearing: bear, speedMps: lt.fix.speedMps, trail, lastUpdate: now };
        changed = true;
        continue;
      }

      next[id] = lt;
    }
    if (changed) set({ trucks: next, tick: state.tick + 1 });
  },
}));

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

/** Loads fleet data from the database and populates the store. */
async function loadFleetFromDb() {
  try {
    const { getFleetTrucks } = await import("@/lib/tracking.functions");
    const res = await getFleetTrucks();
    if (!res.trucks?.length) return;

    const trucks: Truck[] = res.trucks.map((r, i) => {
      return {
        id: r.truckCode,
        dbId: r.dbId,
        name: r.truckCode,
        driverName: "",
        driverPhone: "",
        wardName: r.ward ?? r.truckCode,
        city: "Shirpur",
        color: PALETTE[i % PALETTE.length],
        route: [],
        totalStops: 12,
        startOnline: r.status !== "offline" && r.status !== "decommissioned",
      };
    });

    useTrucks.getState().loadFleet(trucks);
    console.info(`[fleet] Loaded ${trucks.length} trucks from database`);
  } catch (err) {
    console.warn("[fleet] Could not load trucks from DB", err);
  }
}

export function startSimulation() {
  if (started || typeof window === "undefined") return;
  started = true;
  startOfflineWatcher();
  restoreSnapshot();

  // Load real fleet data from the database
  void loadFleetFromDb();

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

  // Detect online / offline / hidden tab
  const setConn = (c: "live" | "reconnecting") => {
    if (useTrucks.getState().connection !== c) useTrucks.getState().setConnection(c);
    // Reset RAF clock on resume to avoid a giant dt the next frame
    last = performance.now();
    pending = 0;
    sinceCommit = 0;
  };
  const goOffline = () => setConn("reconnecting");
  const goOnline = () => {
    setConn("reconnecting");
    setTimeout(() => setConn("live"), 700);
  };
  window.addEventListener("offline", goOffline);
  window.addEventListener("online", goOnline);
  if (typeof navigator !== "undefined" && navigator.onLine === false) goOffline();
}

/** Per-truck subscription: components re-render only when *their* truck changes. */
export function useTruck(id: string | undefined) {
  return useTrucks((s) => (id ? s.trucks[id] : undefined));
}
