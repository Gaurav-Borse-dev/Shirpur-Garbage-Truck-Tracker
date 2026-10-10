import { create } from "zustand";
import { type Truck, FALLBACK_TRUCKS, PALETTE, getWardRoute, SHIRPUR } from "@/lib/trucks";
import {
  bearing,
  haversine,
  lerpAngle,
  lerpLatLng,
  smoothClosedPath,
  turnAngle,
  type LatLng,
} from "@/lib/geo";
import { usePerf, drainRenderCount } from "@/store/perf";
import { readCache, writeCache } from "@/lib/cache";
import { startOfflineWatcher } from "@/store/offline";
import { SOCKET_ENABLED } from "@/lib/backend";

export type LiveTruck = {
  id: string;
  truck: Truck;
  /** Dense, spline-smoothed drive path derived from the sparse waypoints. */
  path: LatLng[];
  position: LatLng;
  bearing: number;
  /** Current ground speed in m/s. */
  speedMps: number;
  status: "offline" | "online" | "collecting";
  segmentIndex: number; // current waypoint index
  segmentT: number; // 0..1 progress within segment
  completedStops: number;
  trail: LatLng[];
  lastUpdate: number;
  /** Pause timer remaining at a collection stop (in milliseconds) */
  stopPauseMs?: number;
  /** Latest GPS fix received from the backend/driver (live mode). */
  fix?: {
    fromPos: LatLng;
    pos: LatLng;
    bearing: number;
    speedMps: number;
    at: number;
    receivedAt: number;
    intervalMs: number;
  };
};

/** A GPS fix as delivered by the backend transport or driver device. */
export type TruckFix = {
  truckId: string;
  lat: number;
  lng: number;
  /** Backend/driver reported heading in degrees (0..360). */
  heading?: number;
  /** Ground speed in m/s. */
  speed?: number;
  /** Fix timestamp (ms epoch or ISO string). */
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
  /** Apply a batch of live GPS fixes with high-accuracy dead reckoning & interpolation. */
  ingestFixes: (fixes: TruckFix[]) => void;
  /** Apply a backend-provided route/stop assignment. */
  applyRoute: (truckId: string, route: LatLng[], totalStops?: number) => void;
  /** Replace the truck fleet with data from the database. */
  loadFleet: (trucks: Truck[]) => void;
  _step: (dtMs: number) => void;
};

// Physics cruise speeds
const CRUISE_MPS = 5.8;
const ACCEL_MPS2 = 1.8;
const DECEL_MPS2 = 2.4;

function initLive(truck: Truck): LiveTruck {
  const route = truck.route && truck.route.length >= 3 ? truck.route : getWardRoute(0);
  const a = route[0] ?? SHIRPUR;
  return {
    id: truck.id,
    truck: { ...truck, route },
    path: route,
    position: a,
    bearing: 180,
    speedMps: 0,
    status: truck.startOnline ? "collecting" : "offline",
    segmentIndex: 0,
    segmentT: 0,
    completedStops: 0,
    trail: [a],
    lastUpdate: Date.now(),
    stopPauseMs: 0,
  };
}

// Initial fleet populated immediately with Shirpur ward routes so map is never blank
const initial: Record<string, LiveTruck> = {};
for (const t of FALLBACK_TRUCKS) {
  initial[t.id] = initLive(t);
}

export const useTrucks = create<TrucksState>((set, get) => ({
  trucks: initial,
  tick: 0,
  dbLoaded: false,
  connection: "live",
  lastDrop: null,
  setStatus: (id, status) =>
    set((s) => ({
      trucks: {
        ...s.trucks,
        [id]: s.trucks[id] ? { ...s.trucks[id], status } : s.trucks[id],
      },
    })),
  setDriverOnline: (id, online) =>
    set((s) => {
      const lt = s.trucks[id];
      if (!lt) return s;
      return {
        trucks: {
          ...s.trucks,
          [id]: {
            ...lt,
            status: online ? "collecting" : "offline",
            speedMps: online ? Math.max(lt.speedMps, 3.5) : 0,
          },
        },
      };
    }),
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
    const now = Date.now();
    let changed = false;

    for (const f of fixes) {
      let lt = next[f.truckId];
      // Auto-create entry for trucks if not present
      if (!lt) {
        const idx = Object.keys(next).length;
        const fallback = FALLBACK_TRUCKS[idx % FALLBACK_TRUCKS.length];
        const truck: Truck = {
          id: f.truckId,
          name: fallback?.name ?? f.truckId,
          driverName: fallback?.driverName ?? "Unassigned",
          driverPhone: fallback?.driverPhone ?? "",
          wardName: fallback?.wardName ?? f.truckId,
          city: "Shirpur",
          color: PALETTE[idx % PALETTE.length],
          route: getWardRoute(idx),
          totalStops: 12,
          startOnline: f.status !== "offline",
        };
        lt = initLive(truck);
        next[f.truckId] = lt;
      }

      const targetPos: LatLng = {
        lat: Number(f.lat.toFixed(6)),
        lng: Number(f.lng.toFixed(6)),
      };
      const at = typeof f.ts === "string" ? Date.parse(f.ts) : (f.ts ?? now);
      const prevPos = lt.fix?.pos ?? lt.position;
      const deltaDistM = haversine(prevPos, targetPos);

      // Determine vehicle orientation: prefer verified heading; compute from track delta if > 1.2m
      let targetBearing = lt.bearing;
      if (typeof f.heading === "number" && !isNaN(f.heading) && f.heading > 0) {
        targetBearing = f.heading;
      } else if (deltaDistM > 1.2) {
        targetBearing = bearing(prevPos, targetPos);
      }

      const prevReceivedAt = lt.fix?.receivedAt ?? now - 2500;
      const intervalMs = Math.max(800, Math.min(6000, now - prevReceivedAt));
      const targetSpeed =
        typeof f.speed === "number" && !isNaN(f.speed)
          ? Math.max(0, f.speed)
          : deltaDistM > 0.5
            ? Math.min(15, deltaDistM / (intervalMs / 1000))
            : 0;

      // Snapping threshold: if difference is > 80m (initial fix or teleport), snap immediately
      const shouldSnap = deltaDistM > 80 || !lt.fix;

      next[f.truckId] = {
        ...lt,
        status: f.status ?? (targetSpeed > 0.5 ? "collecting" : "online"),
        position: shouldSnap ? targetPos : lt.position,
        bearing: shouldSnap ? targetBearing : lt.bearing,
        speedMps: targetSpeed,
        lastUpdate: now,
        fix: {
          fromPos: shouldSnap ? targetPos : lt.position,
          pos: targetPos,
          bearing: targetBearing,
          speedMps: targetSpeed,
          at,
          receivedAt: now,
          intervalMs,
        },
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
    trucks.forEach((truck, i) => {
      const existing = state.trucks[truck.id];
      const wardRoute = truck.route?.length >= 3 ? truck.route : getWardRoute(i);
      const driverName = truck.driverName || "Unassigned";
      const driverPhone = truck.driverPhone || "";
      const enhancedTruck: Truck = {
        ...truck,
        route: wardRoute,
        driverName,
        driverPhone,
        color: truck.color || PALETTE[i % PALETTE.length],
        totalStops: truck.totalStops || 12,
        startOnline: truck.startOnline ?? false,
      };

      if (existing) {
        next[truck.id] = {
          ...existing,
          truck: enhancedTruck,
          path: existing.path.length ? existing.path : smoothClosedPath(wardRoute, 8),
        };
      } else {
        next[truck.id] = initLive(enhancedTruck);
      }
    });
    set({ trucks: next, tick: state.tick + 1, dbLoaded: true });
  },

  _step: (dtMs) => {
    const state = get();
    if (state.connection === "reconnecting") return;
    const next: Record<string, LiveTruck> = {};
    let changed = false;
    const now = Date.now();
    const dtS = dtMs / 1000;

    for (const id in state.trucks) {
      const lt = state.trucks[id];

      // ── MODE A: Live Hardware GPS Fix Active (Interpolation & Dead Reckoning) ──
      if (lt.fix) {
        const gap = haversine(lt.position, lt.fix.pos);

        // Snap if far away (e.g. initial connection or teleport jump)
        if (gap > 80) {
          next[id] = {
            ...lt,
            position: lt.fix.pos,
            bearing: lt.fix.bearing,
            speedMps: lt.fix.speedMps,
            lastUpdate: now,
          };
          changed = true;
          continue;
        }

        const elapsed = now - lt.fix.receivedAt;
        const intervalMs = Math.max(800, lt.fix.intervalMs);

        // If no new fix for >10s, the driver is likely stopped or connection lost
        // — freeze position instead of endlessly extrapolating
        if (elapsed > 10000) {
          next[id] = lt;
          continue;
        }

        const progress = Math.min(2.0, elapsed / intervalMs);

        let pos: LatLng;
        if (progress <= 1.0) {
          // Precise linear interpolation along ground vector
          pos = lerpLatLng(lt.fix.fromPos, lt.fix.pos, progress);
        } else {
          // Dead-reckoning extrapolation along current bearing when speed > 0.3 m/s
          // This keeps the truck moving smoothly between GPS fixes
          if (lt.fix.speedMps > 0.3) {
            const extrapolationTime = (elapsed - intervalMs) / 1000; // seconds past interpolation
            const extraM = lt.fix.speedMps * extrapolationTime * 0.7; // damped to 70%
            const maxExtraM = lt.fix.speedMps * 3; // max 3 seconds of extrapolation
            const clampedExtraM = Math.min(extraM, maxExtraM);
            const rad = (lt.fix.bearing * Math.PI) / 180;
            const kmLat = 1 / 110.574;
            const kmLng = 1 / (111.32 * Math.cos((lt.fix.pos.lat * Math.PI) / 180));
            pos = {
              lat: lt.fix.pos.lat + Math.cos(rad) * (clampedExtraM / 1000) * kmLat,
              lng: lt.fix.pos.lng + Math.sin(rad) * (clampedExtraM / 1000) * kmLng,
            };
          } else {
            // Stopped — hold at last known position
            pos = lt.fix.pos;
          }
        }

        // Smooth shortest-arc angle rotation
        const bear = lerpAngle(lt.bearing, lt.fix.bearing, Math.min(1, dtMs / 160));
        // Append to trail if moved > 2m
        let trail = lt.trail;
        const lastTrailPt = trail[trail.length - 1];
        if (!lastTrailPt || haversine(lastTrailPt, pos) > 2.5) {
          trail = trail.length > 40 ? trail.slice(-39) : trail.slice();
          trail.push(pos);
        }

        next[id] = {
          ...lt,
          position: pos,
          bearing: bear,
          speedMps: lt.fix.speedMps,
          trail,
          lastUpdate: now,
        };
        changed = true;
        continue;
      }

      // If no active hardware GPS fix, vehicle does not fake-move. Keep current position.
      next[id] = lt;
    }

    if (changed) set({ trucks: next, tick: state.tick + 1 });
  },
}));

// Global RAF loop
let started = false;
const UPDATE_FPS_BUDGET = 30;
const UPDATE_INTERVAL_MS = 1000 / UPDATE_FPS_BUDGET;
type Snapshot = Record<
  string,
  {
    position: LatLng;
    bearing: number;
    segmentIndex: number;
    segmentT: number;
    completedStops: number;
    status: LiveTruck["status"];
  }
>;
const SNAPSHOT_KEY = "trucks";

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
    next[id] = { ...lt, ...s, trail: [s.position], lastUpdate: Date.now() };
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

/** Loads fleet data and real driver assignments from the database. */
async function loadFleetFromDb() {
  try {
    const { getFleetTrucks, getFleetDrivers } = await import("@/lib/tracking.functions");
    const [trucksRes, driversRes] = await Promise.all([getFleetTrucks(), getFleetDrivers()]);
    if (!trucksRes.trucks?.length) return;

    // Map real driver assignments from database
    const driverByTruckCode = new Map<string, { name: string; phone: string }>();
    for (const d of driversRes?.drivers ?? []) {
      if (d.assignedTruckCode && d.name && d.name !== "Unknown") {
        driverByTruckCode.set(d.assignedTruckCode, { name: d.name, phone: d.phone ?? "" });
      }
    }

    const trucks: Truck[] = trucksRes.trucks.map((r, i) => {
      const wardRoute = getWardRoute(i);
      const realDriver = driverByTruckCode.get(r.truckCode);
      return {
        id: r.truckCode,
        dbId: r.dbId,
        name: r.truckCode,
        driverName: realDriver?.name ?? "Unassigned",
        driverPhone: realDriver?.phone ?? "",
        wardName: r.ward ?? `Shirpur Ward ${i + 1}`,
        city: "Shirpur",
        color: PALETTE[i % PALETTE.length],
        route: wardRoute,
        totalStops: 12,
        startOnline: r.status !== "offline" && r.status !== "decommissioned",
      };
    });

    useTrucks.getState().loadFleet(trucks);
    console.info(`[fleet] Loaded ${trucks.length} trucks from database with real assignments`);
  } catch (err) {
    console.warn("[fleet] Could not load trucks from DB, using fallback", err);
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
    void import("@/lib/realtime").then((m) => m.getSocket());
  }

  const snapshotTimer = window.setInterval(persistSnapshot, 10_000);
  window.addEventListener("pagehide", () => {
    window.clearInterval(snapshotTimer);
    persistSnapshot();
  });

  let last = performance.now();
  let pending = 0;
  let sinceCommit = 0;
  let batchStart = performance.now();
  let frames = 0;
  let commits = 0;
  let latencySum = 0;
  let latencySamples = 0;
  let sampleStart = performance.now();

  const loop = (now: number) => {
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

  const setConn = (c: "live" | "reconnecting") => {
    if (useTrucks.getState().connection !== c) useTrucks.getState().setConnection(c);
    last = performance.now();
    pending = 0;
    sinceCommit = 0;
  };
  window.addEventListener("offline", () => setConn("reconnecting"));
  window.addEventListener("online", () => {
    setConn("reconnecting");
    setTimeout(() => setConn("live"), 700);
  });
}

/** Per-truck subscription hook */
export function useTruck(id: string | undefined) {
  return useTrucks((s) => (id ? s.trucks[id] : undefined));
}
