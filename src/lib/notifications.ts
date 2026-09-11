/**
 * Backend-driven notifications.
 *
 * Geofencing lives on the backend; the frontend only renders whatever the
 * backend emits (Truck Nearby / Truck Arrived / Route Started / Route
 * Completed / booking updates), with a deep link into the relevant screen and
 * an offline fallback that replays undelivered items on reconnect.
 */
import { useToast } from "@/components/Toast";
import { readCache, writeCache } from "@/lib/cache";
import { playNotificationSound, type SoundType } from "@/lib/notification-sound";

export type NotificationKind =
  | "truck_nearby"
  | "truck_arrived"
  | "route_started"
  | "route_completed"
  | "booking_update"
  | "generic";

export type BackendNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** In-app deep link, e.g. "/resident?truck=GBR-04". */
  link?: string;
  ts?: number | string;
};

const INBOX_KEY = "notifications";
const MAX_INBOX = 100;

export function readInbox(): BackendNotification[] {
  return readCache<BackendNotification[]>(INBOX_KEY, 1000 * 60 * 60 * 24 * 7) ?? [];
}

function persist(n: BackendNotification) {
  const inbox = readInbox();
  if (inbox.some((x) => x.id === n.id)) return false;
  writeCache(INBOX_KEY, [n, ...inbox].slice(0, MAX_INBOX));
  return true;
}

/** Entry point used by the socket adapter and by the REST catch-up fetch. */
export function handleBackendNotification(n: BackendNotification) {
  if (!n?.id) return;
  const isNew = persist(n);
  if (!isNew) return; // de-duplicate across socket + catch-up delivery

  // Play signature CleanTrack garbage tracker sound
  playNotificationSound(n.kind as SoundType);

  // WhatsApp-style heads-up banner
  useToast.getState().push({
    title: n.title,
    subtitle: n.body,
    tone: n.kind as SoundType,
    link: n.link,
    sender: "CleanTrack Shirpur",
  });

  showSystemNotification(n);
}

function showSystemNotification(n: BackendNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return; // heads-up banner already shown in foreground
  try {
    const notif = new Notification(n.title, {
      body: n.body,
      tag: n.id,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });
    notif.onclick = () => {
      window.focus();
      if (n.link) window.location.assign(n.link);
    };
  } catch {}
}

/** Ask once, from a user gesture or after login. */
export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}