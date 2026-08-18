import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DRIVER_NAMES, FALLBACK_TRUCKS } from "@/lib/trucks";

export type Role = "resident" | "driver" | "admin";
export type Session =
  | { role: "resident"; phone: string; city: string }
  | { role: "driver"; phone: string; driverName: string; truckId: string }
  | { role: "admin"; username: string }
  | null;

export type ApprovedDriver = {
  name: string;
  phone: string;
  truckId: string;
  active: boolean;
  /** Database UUID, if loaded from DB. */
  dbId?: string;
};

type AuthState = {
  session: Session;
  approvedDrivers: ApprovedDriver[];
  /** Whether the driver roster has been loaded from the database. */
  dbDriversLoaded: boolean;
  setSession: (s: Session) => void;
  logout: () => void;
  addDriver: (d: Omit<ApprovedDriver, "active"> & { active?: boolean }) => string | null;
  updateDriver: (phone: string, patch: Partial<ApprovedDriver>) => string | null;
  removeDriver: (phone: string) => void;
  findDriverByPhone: (phone: string) => ApprovedDriver | undefined;
  /** Replace the entire driver roster with data from the database. */
  loadDrivers: (drivers: ApprovedDriver[]) => void;
};

/** Fallback driver roster from static data — replaced when DB loads. */
const fallbackDrivers: ApprovedDriver[] = DRIVER_NAMES.slice(0, 10).map((d, i) => ({
  name: d.name,
  phone: d.phone,
  truckId: FALLBACK_TRUCKS[i]?.id ?? `GBR-${String(i + 1).padStart(2, "0")}`,
  active: true,
}));

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      approvedDrivers: fallbackDrivers,
      dbDriversLoaded: false,
      setSession: (s) => set({ session: s }),
      logout: () => set({ session: null }),
      findDriverByPhone: (phone) => {
        const clean = phone.trim().replace(/\D/g, "");
        if (!clean) return undefined;
        const drivers = get().approvedDrivers || [];
        const match = drivers.find((d: ApprovedDriver) => d.phone.trim().replace(/\D/g, "") === clean && d.active);
        if (match) return match;
        const seedMatch = fallbackDrivers.find((d: ApprovedDriver) => d.phone.trim().replace(/\D/g, "") === clean && d.active);
        if (seedMatch) return seedMatch;
        return undefined;
      },
      addDriver: (d) => {
        const list = get().approvedDrivers;
        if (!/^\d{10}$/.test(d.phone)) return "Phone must be 10 digits";
        if (list.some((x) => x.phone === d.phone)) return "Phone already registered";
        if (list.some((x) => x.truckId === d.truckId && x.active)) return "Truck already assigned";
        set({ approvedDrivers: [...list, { ...d, active: d.active ?? true }] });
        return null;
      },
      updateDriver: (phone, patch) => {
        const list = get().approvedDrivers;
        if (patch.truckId && list.some((x) => x.phone !== phone && x.truckId === patch.truckId && x.active)) {
          return "Truck already assigned to another active driver";
        }
        set({ approvedDrivers: list.map((x) => (x.phone === phone ? { ...x, ...patch } : x)) });
        return null;
      },
      removeDriver: (phone) => set({ approvedDrivers: get().approvedDrivers.filter((x) => x.phone !== phone) }),
      loadDrivers: (drivers) => set({ approvedDrivers: drivers, dbDriversLoaded: true }),
    }),
    { name: "cleantrack-auth" },
  ),
);

/**
 * Detects user role and metadata based on phone number:
 * - "9999999999" -> Admin
 * - Admin-assigned driver phone number -> Driver
 * - Any other valid 10-digit number -> Resident
 */
export function detectRole(phone: string): {
  role: Role;
  driver?: ApprovedDriver;
} {
  const clean = phone.trim().replace(/\D/g, "");
  if (clean === "9999999999" || clean === "9999999990") {
    return { role: "admin" };
  }
  const driver = useAuth.getState().findDriverByPhone(clean);
  if (driver) {
    return { role: "driver", driver };
  }
  return { role: "resident" };
}

/** Load driver roster from the database, replacing fallback data. */
export async function loadDriversFromDb() {
  try {
    const { getFleetDrivers } = await import("@/lib/tracking.functions");
    const res = await getFleetDrivers();
    if (!res.drivers?.length) return;

    const drivers: ApprovedDriver[] = res.drivers.map((d) => ({
      name: d.name,
      phone: d.phone,
      truckId: d.assignedTruckCode ?? "",
      active: true,
      dbId: d.dbId,
    }));

    useAuth.getState().loadDrivers(drivers);
    console.info(`[fleet] Loaded ${drivers.length} drivers from database`);
  } catch (err) {
    console.warn("[fleet] Could not load drivers from DB, using fallback", err);
  }
}