import type { LatLng } from "./geo";

export const SHIRPUR: LatLng = { lat: 21.3483, lng: 74.8827 };
export const DHULE: LatLng = { lat: 20.9042, lng: 74.7749 };

export type TruckStatus = "offline" | "online" | "collecting";

export type Truck = {
  id: string;
  name: string;
  driverName: string;
  driverPhone: string;
  wardName: string;
  city: "Shirpur" | "Dhule";
  color: string;
  route: LatLng[];
  totalStops: number;
  startOnline: boolean;
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

/** Hand-tunable loop generator: builds an organic curved closed loop of N waypoints
 *  around a center, simulating a residential collection route. */
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
    pts.push({ lat: center.lat + dy * kmLat, lng: center.lng + dx * kmLng });
  }
  return pts;
}

const SHIRPUR_WARDS = [
  "Shirpur Ward 1 — Old City",
  "Shirpur Ward 2 — Station Road",
  "Shirpur Ward 3 — Tilak Nagar",
  "Shirpur Ward 4 — Subhash Nagar",
  "Shirpur Ward 5 — Gandhi Chowk",
  "Shirpur Ward 6 — Bhadgaon Road",
  "Shirpur Ward 7 — Shahada Road",
  "Shirpur Ward 8 — Thakkar Bappa Nagar",
];
const DHULE_WARDS = [
  "Dhule Ward 1 — Deopur",
  "Dhule Ward 2 — Mohadi Road",
  "Dhule Ward 3 — Sakri Road",
  "Dhule Ward 4 — Avadhan",
  "Dhule Ward 5 — Pachora Road",
  "Dhule Ward 6 — Songir Road",
  "Dhule Ward 7 — Malegaon Road",
  "Dhule Ward 8 — Nakane Road",
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

function offsetCenter(base: LatLng, idx: number): LatLng {
  // Spread truck loops around city center to avoid overlap
  const angle = (idx / 8) * Math.PI * 2;
  const off = 0.012;
  return { lat: base.lat + Math.sin(angle) * off, lng: base.lng + Math.cos(angle) * off };
}

export const TRUCKS: Truck[] = Array.from({ length: 16 }).map((_, i) => {
  const inShirpur = i < 8;
  const cityCenter = inShirpur ? SHIRPUR : DHULE;
  const localIdx = i % 8;
  const driver = DRIVER_NAMES[i] ?? { name: "Unassigned", phone: "" };
  const wardName = (inShirpur ? SHIRPUR_WARDS : DHULE_WARDS)[localIdx];
  const route = makeRoute(offsetCenter(cityCenter, localIdx), 1000 + i * 137, 0.7 + (i % 3) * 0.2, 12 + (i % 3));
  return {
    id: `GBR-${String(i + 1).padStart(2, "0")}`,
    name: `Tipper Truck ${String(i + 1).padStart(2, "0")}`,
    driverName: driver.name,
    driverPhone: driver.phone,
    wardName,
    city: inShirpur ? "Shirpur" : "Dhule",
    color: PALETTE[i % PALETTE.length],
    route,
    totalStops: 12,
    startOnline: i < 8, // GBR-01..08 online, GBR-09..16 offline
  };
});

/** Resident demo locations (one per city). */
export const RESIDENT_DEMO: Record<"Shirpur" | "Dhule", LatLng> = {
  Shirpur: { lat: SHIRPUR.lat + 0.003, lng: SHIRPUR.lng + 0.004 },
  Dhule: { lat: DHULE.lat + 0.002, lng: DHULE.lng - 0.003 },
};