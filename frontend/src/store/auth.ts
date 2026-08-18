import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DRIVER_NAMES, TRUCKS } from "@/lib/trucks";

export type Role = "resident" | "driver" | "admin";
export type Session =
  | { role: "resident"; phone: string; city: "Shirpur" }
  | { role: "driver"; phone: string; driverName: string; truckId: string }
  | { role: "admin"; username: string }
  | null;

export type ApprovedDriver = {
  name: string;
  phone: string;
  truckId: string;
  active: boolean;
};

type AuthState = {
  session: Session;
  approvedDrivers: ApprovedDriver[];
  setSession: (s: Session) => void;
  logout: () => void;
  addDriver: (d: Omit<ApprovedDriver, "active"> & { active?: boolean }) => string | null;
  updateDriver: (phone: string, patch: Partial<ApprovedDriver>) => string | null;
  removeDriver: (phone: string) => void;
  findDriverByPhone: (phone: string) => ApprovedDriver | undefined;
};

const initialDrivers: ApprovedDriver[] = DRIVER_NAMES.slice(0, 10).map((d, i) => ({
  name: d.name,
  phone: d.phone,
  truckId: TRUCKS[i].id,
  active: true,
}));

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      approvedDrivers: initialDrivers,
      setSession: (s) => set({ session: s }),
      logout: () => set({ session: null }),
      findDriverByPhone: (phone) => {
        const clean = phone.trim().replace(/\D/g, "");
        if (!clean) return undefined;
        const drivers = get().approvedDrivers || [];
        const match = drivers.find((d) => d.phone.trim().replace(/\D/g, "") === clean && d.active);
        if (match) return match;
        const seedMatch = initialDrivers.find((d) => d.phone.trim().replace(/\D/g, "") === clean && d.active);
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