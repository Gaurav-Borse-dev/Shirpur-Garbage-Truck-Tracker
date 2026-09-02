/**
 * Truck type definitions, static ward/color reference data, and fallback seed.
 *
 * The authoritative truck list comes from the Supabase `trucks` table (fetched
 * by `getFleetTrucks` in `tracking.functions.ts`). This file provides the
 * `Truck` type used throughout the frontend and a **fallback seed** that the
 * truck store uses when the database is unavailable (cold start / offline).
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

export const FALLBACK_TRUCKS: Truck[] = [];

/** @deprecated Use database fleet data. Kept as empty array for backward compatibility. */
export const TRUCKS: Truck[] = [];