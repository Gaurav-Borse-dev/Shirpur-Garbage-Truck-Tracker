import type { LatLng } from "./geo";

export const SHIRPUR: LatLng = { lat: 21.3483, lng: 74.8827 };

export type TruckStatus = "offline" | "online" | "collecting";

export type Truck = {
  id: string;
  name: string;
  driverName: string;
  driverPhone: string;
  wardName: string;
  city: "Shirpur";
  color: string;
  route: LatLng[];
  totalStops: number;
  startOnline: boolean;
};

export const DRIVER_NAMES: { name: string; phone: string }[] = [];

export const TRUCKS: Truck[] = [];