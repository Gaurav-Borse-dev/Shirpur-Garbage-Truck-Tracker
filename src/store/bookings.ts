import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BookingStatus = "pending" | "approved" | "rejected";

export type DustbinBooking = {
  id: string;
  residentPhone: string;
  city: "Shirpur" | "Dhule";
  address: string;
  reason: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;
  createdAt: number;
  status: BookingStatus;
  decidedAt?: number;
  adminNote?: string;
};

type State = {
  bookings: DustbinBooking[];
  create: (b: Omit<DustbinBooking, "id" | "createdAt" | "status">) => DustbinBooking;
  decide: (id: string, status: "approved" | "rejected", note?: string) => void;
  forResident: (phone: string) => DustbinBooking[];
};

export const useBookings = create<State>()(
  persist(
    (set, get) => ({
      bookings: [],
      create: (b) => {
        const item: DustbinBooking = {
          ...b,
          id: `BK-${Date.now().toString(36).toUpperCase()}`,
          createdAt: Date.now(),
          status: "pending",
        };
        set({ bookings: [item, ...get().bookings] });
        return item;
      },
      decide: (id, status, note) =>
        set({
          bookings: get().bookings.map((x) =>
            x.id === id ? { ...x, status, adminNote: note, decidedAt: Date.now() } : x,
          ),
        }),
      forResident: (phone) => get().bookings.filter((x) => x.residentPhone === phone),
    }),
    { name: "cleantrack-bookings" },
  ),
);