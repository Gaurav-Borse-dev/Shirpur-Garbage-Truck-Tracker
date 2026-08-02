/**
 * Production Socket.IO transport adapter.
 *
 * Event contract (rename here if the backend differs — nothing else needs edits):
 *   server -> client
 *     "truck:location"  TruckFix                  single GPS fix
 *     "truck:locations" TruckFix[]                batched fixes
 *     "route:assigned"  { truckId, route: [{lat,lng}], totalStops? }
 *     "notification"    BackendNotification
 *   client -> server
 *     "subscribe:all"    {}                       admin
 *     "subscribe:nearby" { lat, lng, radiusM }    citizen
 *     "subscribe:truck"  { truckId }              driver
 *     "driver:gps"       { truckId, lat, lng, heading, speed, ts }
 *     "driver:duty"      { truckId, action }
 *     "ping"             {}                       heartbeat, every 30s
 *
 * Fixes are pushed into a buffer and flushed into the store on the existing
 * batched commit budget, so markers/polylines never re-render per event.
 */
import { io, type Socket } from "socket.io-client";
import { LIVE_BACKEND, SOCKET_PATH, SOCKET_URL, getToken } from "@/lib/backend";
import { useTrucks, type TruckFix } from "@/store/trucks";
import { handleBackendNotification, type BackendNotification } from "@/lib/notifications";

export type Subscription =
  | { role: "admin" }
  | { role: "resident"; lat: number; lng: number; radiusM: number }
  | { role: "driver"; truckId: string };

let socket: Socket | null = null;
let heartbeat: number | null = null;
let flushTimer: number | null = null;
let subscription: Subscription | null = null;

/** Coalesces bursts of fixes: one store commit per flush, keyed by truck. */
const buffer = new Map<string, TruckFix>();
const FLUSH_MS = 1000 / 30;

function flush() {
  if (!buffer.size) return;
  const fixes = [...buffer.values()];
  buffer.clear();
  useTrucks.getState().ingestFixes(fixes);
}

function sendSubscribe(s: Socket) {
  if (!subscription) return;
  if (subscription.role === "admin") s.emit("subscribe:all", {});
  else if (subscription.role === "resident")
    s.emit("subscribe:nearby", {
      lat: subscription.lat,
      lng: subscription.lng,
      radiusM: subscription.radiusM,
    });
  else s.emit("subscribe:truck", { truckId: subscription.truckId });
}

/** Idempotent: repeated calls reuse the single connection. */
export function getSocket(): Socket | null {
  if (!LIVE_BACKEND || typeof window === "undefined") return null;
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    transports: ["websocket"],
    auth: (cb) => cb({ token: getToken() }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    timeout: 12000,
  });

  socket.on("connect", () => {
    useTrucks.getState().setConnection("live");
    sendSubscribe(socket!);
  });
  socket.on("disconnect", () => useTrucks.getState().setConnection("reconnecting"));
  socket.io.on("reconnect_attempt", () => useTrucks.getState().setConnection("reconnecting"));

  socket.on("truck:location", (fix: TruckFix) => {
    if (fix?.truckId) buffer.set(fix.truckId, fix);
  });
  socket.on("truck:locations", (fixes: TruckFix[]) => {
    for (const f of fixes ?? []) if (f?.truckId) buffer.set(f.truckId, f);
  });
  socket.on(
    "route:assigned",
    (p: { truckId: string; route: { lat: number; lng: number }[]; totalStops?: number }) => {
      if (p?.truckId && p.route?.length) useTrucks.getState().applyRoute(p.truckId, p.route, p.totalStops);
    },
  );
  socket.on("notification", (n: BackendNotification) => handleBackendNotification(n));

  flushTimer = window.setInterval(flush, FLUSH_MS);
  heartbeat = window.setInterval(() => socket?.connected && socket.emit("ping", {}), 30_000);

  return socket;
}

/** Set (or change) what this client is subscribed to. Safe to call on every mount. */
export function subscribe(next: Subscription) {
  subscription = next;
  const s = getSocket();
  if (s?.connected) sendSubscribe(s);
}

export function emitDriverGps(payload: {
  truckId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  ts: number;
}): boolean {
  const s = getSocket();
  if (!s?.connected) return false;
  s.emit("driver:gps", payload);
  return true;
}

export function emitDriverDuty(truckId: string, action: "start" | "pause" | "resume" | "stop"): boolean {
  const s = getSocket();
  if (!s?.connected) return false;
  s.emit("driver:duty", { truckId, action });
  return true;
}

export function disconnectRealtime() {
  if (heartbeat) window.clearInterval(heartbeat);
  if (flushTimer) window.clearInterval(flushTimer);
  heartbeat = flushTimer = null;
  socket?.disconnect();
  socket = null;
  subscription = null;
  buffer.clear();
}