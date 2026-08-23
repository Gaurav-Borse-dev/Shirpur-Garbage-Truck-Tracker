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
  { name: "Ganesh Shinde", phone: "9822011011" },
  { name: "Kishor Rajput", phone: "9822011012" },
  { name: "Sunil Chaudhari", phone: "9822011013" },
  { name: "Sachin More", phone: "9822011014" },
  { name: "Nitin Koli", phone: "9822011015" },
  { name: "Ajay Mali", phone: "9822011016" },
];

const PALETTE = [
  "#22C55E", "#06B6D4", "#F97316", "#A855F7",
  "#EAB308", "#EC4899", "#0EA5E9", "#14B8A6",
  "#10B981", "#6366F1", "#F43F5E", "#84CC16",
  "#06B6D4", "#F59E0B", "#8B5CF6", "#3B82F6",
];

/** Detailed street-level collection loops for each ward in Shirpur. */
const WARD_ROUTES: LatLng[][] = [
  // Ward 1: Old City (Near Arunavati riverfront & old market)
  [
    { lat: 21.3440, lng: 74.8780 },
    { lat: 21.3455, lng: 74.8765 },
    { lat: 21.3470, lng: 74.8790 },
    { lat: 21.3450, lng: 74.8810 },
  ],
  // Ward 2: Station Road (Main Commercial Corridor)
  [
    { lat: 21.3485, lng: 74.8835 },
    { lat: 21.3505, lng: 74.8855 },
    { lat: 21.3520, lng: 74.8840 },
    { lat: 21.3498, lng: 74.8820 },
  ],
  // Ward 3: Tilak Nagar
  [
    { lat: 21.3510, lng: 74.8795 },
    { lat: 21.3535, lng: 74.8815 },
    { lat: 21.3545, lng: 74.8785 },
    { lat: 21.3520, lng: 74.8770 },
  ],
  // Ward 4: Subhash Nagar
  [
    { lat: 21.3490, lng: 74.8770 },
    { lat: 21.3515, lng: 74.8750 },
    { lat: 21.3530, lng: 74.8765 },
    { lat: 21.3505, lng: 74.8785 },
  ],
  // Ward 5: Gandhi Chowk & Municipal Council Area
  [
    { lat: 21.3475, lng: 74.8820 },
    { lat: 21.3490, lng: 74.8830 },
    { lat: 21.3480, lng: 74.8845 },
    { lat: 21.3465, lng: 74.8830 },
  ],
  // Ward 6: Bhadgaon Road
  [
    { lat: 21.3450, lng: 74.8860 },
    { lat: 21.3470, lng: 74.8885 },
    { lat: 21.3490, lng: 74.8870 },
    { lat: 21.3465, lng: 74.8845 },
  ],
  // Ward 7: Shahada Road
  [
    { lat: 21.3540, lng: 74.8760 },
    { lat: 21.3570, lng: 74.8745 },
    { lat: 21.3585, lng: 74.8770 },
    { lat: 21.3555, lng: 74.8785 },
  ],
  // Ward 8: Thakkar Bappa Nagar
  [
    { lat: 21.3430, lng: 74.8810 },
    { lat: 21.3415, lng: 74.8835 },
    { lat: 21.3435, lng: 74.8850 },
    { lat: 21.3450, lng: 74.8825 },
  ],
  // Ward 9: Karwand Naka
  [
    { lat: 21.3560, lng: 74.8810 },
    { lat: 21.3590, lng: 74.8825 },
    { lat: 21.3605, lng: 74.8795 },
    { lat: 21.3575, lng: 74.8780 },
  ],
  // Ward 10: Boradi Road
  [
    { lat: 21.3570, lng: 74.8870 },
    { lat: 21.3600, lng: 74.8895 },
    { lat: 21.3615, lng: 74.8865 },
    { lat: 21.3585, lng: 74.8845 },
  ],
  // Ward 11: Sangvi Road
  [
    { lat: 21.3410, lng: 74.8890 },
    { lat: 21.3430, lng: 74.8920 },
    { lat: 21.3450, lng: 74.8905 },
    { lat: 21.3425, lng: 74.8875 },
  ],
  // Ward 12: Thalner Road
  [
    { lat: 21.3390, lng: 74.8830 },
    { lat: 21.3410, lng: 74.8855 },
    { lat: 21.3425, lng: 74.8825 },
    { lat: 21.3400, lng: 74.8805 },
  ],
  // Ward 13: Arthe
  [
    { lat: 21.3460, lng: 74.8920 },
    { lat: 21.3485, lng: 74.8950 },
    { lat: 21.3505, lng: 74.8930 },
    { lat: 21.3480, lng: 74.8900 },
  ],
  // Ward 14: Mukti Dham / Nimzari Naka
  [
    { lat: 21.3520, lng: 74.8900 },
    { lat: 21.3545, lng: 74.8925 },
    { lat: 21.3560, lng: 74.8895 },
    { lat: 21.3535, lng: 74.8875 },
  ],
  // Ward 15: RC Patel / NMU Campus Area
  [
    { lat: 21.3530, lng: 74.8945 },
    { lat: 21.3560, lng: 74.8975 },
    { lat: 21.3575, lng: 74.8940 },
    { lat: 21.3545, lng: 74.8915 },
  ],
  // Ward 16: Dondaicha Road
  [
    { lat: 21.3380, lng: 74.8880 },
    { lat: 21.3405, lng: 74.8910 },
    { lat: 21.3420, lng: 74.8885 },
    { lat: 21.3395, lng: 74.8860 },
  ],
];

/**
 * Fallback seed trucks used when the database is unavailable.
 * Once the store loads data from `getFleetTrucks`, these are augmented.
 */
export const FALLBACK_TRUCKS: Truck[] = Array.from({ length: 16 }).map((_, i) => {
  const driver = DRIVER_NAMES[i] ?? { name: `Driver ${i + 1}`, phone: "" };
  const wardName = SHIRPUR_WARDS[i] ?? `Shirpur Ward ${i + 1}`;
  const route = WARD_ROUTES[i] ?? WARD_ROUTES[0];
  // Keep key wards online so maps are active and responsive
  const startOnline = i < 8;

  return {
    id: `GBR-${String(i + 1).padStart(2, "0")}`,
    name: `Tipper Truck ${String(i + 1).padStart(2, "0")}`,
    driverName: driver.name,
    driverPhone: driver.phone,
    wardName,
    city: "Shirpur",
    color: PALETTE[i % PALETTE.length],
    route,
    totalStops: 12,
    startOnline,
  };
});

/** @deprecated Use FALLBACK_TRUCKS. Alias kept for backward compatibility during migration. */
export const TRUCKS = FALLBACK_TRUCKS;

/** Resident demo location — fallback in Shirpur. */
export const RESIDENT_DEMO: Record<string, LatLng> = {
  Shirpur: { lat: 21.3492, lng: 74.8845 },
};