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

export const DRIVER_NAMES = [
  { name: "Ramesh Patil", phone: "9822011001" },
  { name: "Suresh Mahajan", phone: "9822011002" },
  { name: "Vikas Sonawane", phone: "9822011003" },
  { name: "Anil Bhoi", phone: "9822011004" },
  { name: "Sanjay Wagh", phone: "9822011005" },
  { name: "Prakash Pawar", phone: "9822011006" },
  { name: "Dinesh Chavan", phone: "9822011007" },
  { name: "Mahesh Jadhav", phone: "9822011008" },
  { name: "Rajesh Kale", phone: "9822011009" },
  { name: "Bharat Borse", phone: "9822011010" },
];

const PALETTE = ["#22C55E", "#06B6D4", "#F97316", "#A855F7", "#EAB308", "#EC4899", "#0EA5E9", "#14B8A6"];

/**
 * Fallback seed trucks used when the database is unavailable.
 * Once the store loads data from `getFleetTrucks`, these are replaced.
 */
export const FALLBACK_TRUCKS: Truck[] = Array.from({ length: 16 }).map((_, i) => {
  const driver = DRIVER_NAMES[i] ?? { name: "Unassigned", phone: "" };
  const wardName = SHIRPUR_WARDS[i];
  return {
    id: `GBR-${String(i + 1).padStart(2, "0")}`,
    name: `Tipper Truck ${String(i + 1).padStart(2, "0")}`,
    driverName: driver.name,
    driverPhone: driver.phone,
    wardName,
    city: "Shirpur",
    color: PALETTE[i % PALETTE.length],
    route: [], // No fake routes — positions come from the backend
    totalStops: 12,
    startOnline: false, // Don't pretend trucks are online
  };
});

/** @deprecated Use FALLBACK_TRUCKS. Alias kept for backward compatibility during migration. */
export const TRUCKS = FALLBACK_TRUCKS;

/** Resident demo location — only used as fallback when geolocation is unavailable. */
export const RESIDENT_DEMO: Record<string, LatLng> = {
  Shirpur: { lat: SHIRPUR.lat + 0.003, lng: SHIRPUR.lng + 0.004 },
};