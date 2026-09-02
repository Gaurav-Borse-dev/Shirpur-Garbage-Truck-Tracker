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

/** @deprecated Wards are now stored in the `wards` database table. Use `getWards()` from fleet.functions.ts. */
export const SHIRPUR_WARDS: string[] = [];


export const FALLBACK_TRUCKS: Truck[] = [];

/** @deprecated Use database fleet data. Kept as empty array for backward compatibility. */
export const TRUCKS: Truck[] = [];