/**
 * Truck type definitions, static ward/color reference data, and fallback seed.
 *
 * The authoritative truck list comes from the Supabase `trucks` table (fetched
 * by `getFleetTrucks` in `tracking.functions.ts`). This file provides the
 * `Truck` type used throughout the frontend, organic ward routes, and fallback seed data.
 */
import type { LatLng } from "./geo";

/** Shirpur city center – default map position. */
export const SHIRPUR: LatLng = { lat: 21.3483, lng: 74.8827 };

export type TruckStatus = "offline" | "online" | "collecting";

export type Truck = {
  id: string;
  name: string;
  driverName: string;
  driverPhone: string;
  wardName: string;
  city: string;
  color: string;
  route: LatLng[];
  totalStops: number;
  startOnline: boolean;
  /** Database UUID, if loaded from DB. */
  dbId?: string;
};

// Mulberry32 PRNG for repeatable jitter
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hand-tunable loop generator: builds an organic curved closed loop of N waypoints
 * around a center, simulating a residential collection route.
 */
export function makeRoute(center: LatLng, seed: number, radiusKm = 0.9, n = 12): LatLng[] {
  const r = rng(seed);
  const pts: LatLng[] = [];
  const baseAngle = r() * Math.PI * 2;
  // Approx degree-per-km
  const kmLat = 1 / 110.574;
  const kmLng = 1 / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const angle = baseAngle + t * Math.PI * 2;
    // Vary radius to avoid perfect circle (organic curve)
    const rad = radiusKm * (0.55 + 0.5 * (0.5 + 0.5 * Math.sin(angle * 2 + r() * 2)));
    const jitter = (r() - 0.5) * 0.15;
    const dx = Math.cos(angle) * rad * (1 + jitter);
    const dy = Math.sin(angle) * rad * (1 + jitter);
    pts.push({
      lat: Number((center.lat + dy * kmLat).toFixed(6)),
      lng: Number((center.lng + dx * kmLng).toFixed(6)),
    });
  }
  return pts;
}

export const SHIRPUR_WARDS = [
  "Shirpur Ward 1 — Old City",
  "Shirpur Ward 2 — Station Road",
  "Shirpur Ward 3 — Tilak Nagar",
  "Shirpur Ward 4 — Subhash Nagar",
  "Shirpur Ward 5 — Gandhi Chowk",
  "Shirpur Ward 6 — Bhadgaon Road",
  "Shirpur Ward 7 — Shahada Road",
  "Shirpur Ward 8 — Thakkar Bappa Nagar",
  "Shirpur Ward 9 — Karwand Naka",
  "Shirpur Ward 10 — Boradi Road",
  "Shirpur Ward 11 — Sangvi",
  "Shirpur Ward 12 — Thalner Road",
  "Shirpur Ward 13 — Arthe",
  "Shirpur Ward 14 — Mukti Dham",
  "Shirpur Ward 15 — NMU Campus",
  "Shirpur Ward 16 — Dondaicha Road",
];

export const DRIVER_NAMES: { name: string; phone: string }[] = [];

export const PALETTE = [
  "#22C55E",
  "#06B6D4",
  "#F97316",
  "#A855F7",
  "#EAB308",
  "#EC4899",
  "#0EA5E9",
  "#14B8A6",
];

export function offsetCenter(base: LatLng, idx: number): LatLng {
  // Spread truck loops around city center to avoid overlap
  const angle = (idx / 16) * Math.PI * 2;
  const off = 0.013 + (idx % 3) * 0.005;
  return {
    lat: Number((base.lat + Math.sin(angle) * off).toFixed(6)),
    lng: Number((base.lng + Math.cos(angle) * off).toFixed(6)),
  };
}

/** Cache of precomputed routes per ward index */
const WARD_ROUTES_CACHE: Map<number, LatLng[]> = new Map();

/** Get a realistic ward collection route for a specific ward index (0..15) */
export function getWardRoute(idx: number): LatLng[] {
  const normIdx = ((idx % 16) + 16) % 16;
  const cached = WARD_ROUTES_CACHE.get(normIdx);
  if (cached) return cached;
  const center = offsetCenter(SHIRPUR, normIdx);
  const route = makeRoute(center, 1000 + normIdx * 137, 0.75 + (normIdx % 3) * 0.2, 14);
  WARD_ROUTES_CACHE.set(normIdx, route);
  return route;
}

export const FALLBACK_TRUCKS: Truck[] = Array.from({ length: 16 }).map((_, i) => {
  const wardName = SHIRPUR_WARDS[i];
  const route = getWardRoute(i);
  return {
    id: `GBR-${String(i + 1).padStart(2, "0")}`,
    name: `Tipper Truck ${String(i + 1).padStart(2, "0")}`,
    driverName: "Unassigned",
    driverPhone: "",
    wardName,
    city: "Shirpur",
    color: PALETTE[i % PALETTE.length],
    route,
    totalStops: 12,
    startOnline: false,
  };
});

/** @deprecated Use database fleet data. Kept as FALLBACK_TRUCKS for backward compatibility. */
export const TRUCKS: Truck[] = FALLBACK_TRUCKS;

/** Resident demo location — fallback when geolocation is unavailable. */
export const RESIDENT_DEMO: Record<string, LatLng> = {
  Shirpur: { lat: SHIRPUR.lat + 0.003, lng: SHIRPUR.lng + 0.004 },
};
