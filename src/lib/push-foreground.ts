/**
 * Foreground push handling.
 *
 * While a tab is open the OS usually suppresses the system notification, so we
 * surface deliveries as in-app toasts instead and immediately refresh live
 * truck positions so the map reflects whatever the alert is about.
 *
 * Three sources feed this: the service worker (web push), the native wrapper
 * (`window.CleanTrackDeliverPush`), and a short poll of server-side delivery
 * records as the catch-all.
 */
import { getRecentDeliveries } from "@/lib/push.functions";
import { handleBackendNotification, type NotificationKind } from "@/lib/notifications";
import { refreshLiveTracking } from "@/lib/live-tracking";

const POLL_MS = 20_000;

type Incoming = { id?: string; title?: string; body?: string; kind?: string; link?: string };

declare global {
  interface Window {
    /** Native wrapper calls this when a push arrives while the app is open. */
    CleanTrackDeliverPush?: (payload: Incoming) => void;
  }
}

function deliver(payload: Incoming) {
  if (!payload?.title) return;
  handleBackendNotification({
    id: payload.id ?? `${payload.title}-${Date.now()}`,
    kind: (payload.kind as NotificationKind) ?? "generic",
    title: payload.title,
    body: payload.body,
    link: payload.link,
    ts: Date.now(),
  });
  // A nearby/arrival alert means positions moved — pull a fresh fix right away.
  refreshLiveTracking();
}

/** Starts foreground delivery. Returns a teardown function. */
export function startForegroundPush(): () => void {
  if (typeof window === "undefined") return () => {};

  window.CleanTrackDeliverPush = deliver;

  const onSwMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; notification?: Incoming; data?: Incoming } | null;
    if (!data) return;
    if (data.type && data.type !== "push") return;
    deliver({ ...(data.notification ?? {}), ...(data.data ?? {}) });
  };
  navigator.serviceWorker?.addEventListener("message", onSwMessage);

  let since = new Date().toISOString();
  let stopped = false;

  async function poll() {
    if (stopped || document.visibilityState !== "visible") return;
    try {
      const res = await getRecentDeliveries({ data: { since } });
      if (!res.ok || !res.items.length) return;
      since = res.items[0]!.created_at;
      for (const item of [...res.items].reverse()) {
        deliver({
          id: item.id,
          title: item.title,
          body: item.body ?? undefined,
          kind: item.kind,
          link: item.kind === "truck_nearby" ? "/resident" : undefined,
        });
      }
    } catch {
      // Offline or signed out — the next tick retries.
    }
  }

  const timer = window.setInterval(() => void poll(), POLL_MS);
  const onVisible = () => void poll();
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    if (window.CleanTrackDeliverPush === deliver) delete window.CleanTrackDeliverPush;
  };
}
