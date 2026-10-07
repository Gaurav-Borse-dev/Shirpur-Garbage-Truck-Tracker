/**
 * Client-side device-token acquisition.
 *
 * Two supported paths:
 *  1. Native wrapper (Android/iOS shell, e.g. Capacitor/WebView). The shell owns
 *     the FCM SDK and hands us a token — no VAPID key or Firebase web config is
 *     needed in the browser bundle. Drivers and admins use this path.
 *  2. Browser web push, which needs a Firebase web config + VAPID key. When that
 *     is absent we fail softly and the app falls back to in-app alerts only.
 */
import { registerDeviceToken, revokeDeviceToken } from "@/lib/push.functions";

export type TokenPlatform = "web" | "android" | "ios";
export type AcquiredToken = { token: string; platform: TokenPlatform };

type NativeBridge = {
  getFcmToken?: () => string | null | Promise<string | null>;
  platform?: TokenPlatform;
};

declare global {
  interface Window {
    CleanTrackNative?: NativeBridge;
    /** Called by the native shell once it has an FCM token. */
    CleanTrackSetFcmToken?: (token: string, platform?: TokenPlatform) => void;
  }
}

const TOKEN_KEY = "cleantrack.fcm-token";
const PLATFORM_KEY = "cleantrack.fcm-platform";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function storeNativeToken(token: string, platform: TokenPlatform = "android") {
  const s = storage();
  if (!s || !token) return;
  s.setItem(TOKEN_KEY, token);
  s.setItem(PLATFORM_KEY, platform);
}

export function readStoredToken(): AcquiredToken | null {
  const s = storage();
  const token = s?.getItem(TOKEN_KEY);
  if (!token) return null;
  const platform = (s?.getItem(PLATFORM_KEY) as TokenPlatform | null) ?? "android";
  return { token, platform };
}

/** Deep-link entry: /driver?fcm_token=...&fcm_platform=android */
function tokenFromUrl(): AcquiredToken | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("fcm_token");
  if (!token) return null;
  const platform = (params.get("fcm_platform") as TokenPlatform | null) ?? "android";
  return { token, platform };
}

/** Installs the window hook the native shell calls; safe to call repeatedly. */
export function installNativeTokenBridge() {
  if (typeof window === "undefined") return;
  window.CleanTrackSetFcmToken = (token, platform = "android") => {
    storeNativeToken(token, platform);
    void registerThisDevice({ requirePermission: false });
  };
}

/** Resolves a usable FCM token from the native wrapper, URL, or cache. */
export async function acquireDeviceToken(): Promise<AcquiredToken | null> {
  if (typeof window === "undefined") return null;

  const fromUrl = tokenFromUrl();
  if (fromUrl) {
    storeNativeToken(fromUrl.token, fromUrl.platform);
    return fromUrl;
  }

  const bridge = window.CleanTrackNative;
  if (bridge?.getFcmToken) {
    try {
      const token = await bridge.getFcmToken();
      if (token) {
        const platform = bridge.platform ?? "android";
        storeNativeToken(token, platform);
        return { token, platform };
      }
    } catch (error) {
      console.warn("[push] native token bridge failed", error);
    }
  }

  return readStoredToken();
}

const QUEUE_KEY = "cleantrack.push-queue";
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 800;

type PendingOp =
  { kind: "register"; token: string; platform: TokenPlatform } | { kind: "revoke"; token?: string };

function readQueue(): PendingOp[] {
  const s = storage();
  try {
    return s ? (JSON.parse(s.getItem(QUEUE_KEY) ?? "[]") as PendingOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: PendingOp[]) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(QUEUE_KEY, JSON.stringify(ops.slice(-10)));
  } catch {}
}

function enqueue(op: PendingOp) {
  const ops = readQueue().filter(
    (o) =>
      !(o.kind === op.kind && (o as { token?: string }).token === (op as { token?: string }).token),
  );
  writeQueue([...ops, op]);
}

function dequeue(op: PendingOp) {
  writeQueue(readQueue().filter((o) => JSON.stringify(o) !== JSON.stringify(op)));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries a token operation with exponential backoff + jitter. */
async function withBackoff(run: () => Promise<boolean>): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      if (await run()) return true;
    } catch (error) {
      console.warn("[push] token operation failed", error);
    }
    if (attempt === MAX_ATTEMPTS - 1) break;
    const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 250;
    await wait(delay);
  }
  return false;
}

async function runOp(op: PendingOp): Promise<boolean> {
  if (op.kind === "register") {
    const res = await registerDeviceToken({
      data: {
        token: op.token,
        platform: op.platform,
        userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent.slice(0, 300),
      },
    });
    return res.ok;
  }
  const res = await revokeDeviceToken({ data: op.token ? { token: op.token } : {} });
  return res.ok;
}

/** Replays operations that never made it to the server (offline, 5xx, tab closed). */
export async function flushPendingPushOps() {
  for (const op of readQueue()) {
    if (await withBackoff(() => runOp(op))) dequeue(op);
  }
}

/** Call once on app start: retries stragglers now and whenever the network returns. */
export function installPushRetry() {
  if (typeof window === "undefined") return;
  void flushPendingPushOps();
  window.addEventListener("online", () => void flushPendingPushOps());
}

export type RegisterOutcome =
  { ok: true; platform: TokenPlatform } | { ok: false; reason: "no_token" | "denied" | "failed" };

/**
 * Registers this device for push. Requires notification permission on the web;
 * native wrappers request it themselves before handing us a token.
 */
export async function registerThisDevice(
  opts: { requirePermission?: boolean } = {},
): Promise<RegisterOutcome> {
  const acquired = await acquireDeviceToken();
  if (!acquired) return { ok: false, reason: "no_token" };

  if (opts.requirePermission !== false && acquired.platform === "web") {
    const { ensureNotificationPermission } = await import("@/lib/notifications");
    if (!(await ensureNotificationPermission())) return { ok: false, reason: "denied" };
  }

  const op: PendingOp = {
    kind: "register",
    token: acquired.token,
    platform: acquired.platform,
  };
  const ok = await withBackoff(() => runOp(op));
  if (!ok) {
    // Queue it so the device still ends up registered once the network recovers.
    enqueue(op);
    return { ok: false, reason: "failed" };
  }
  dequeue(op);
  return { ok: true, platform: acquired.platform };
}

export async function unregisterThisDevice() {
  const stored = readStoredToken();
  const op: PendingOp = stored ? { kind: "revoke", token: stored.token } : { kind: "revoke" };
  const ok = await withBackoff(() => runOp(op));
  if (!ok) enqueue(op);
  else dequeue(op);
  return ok;
}

/** Current browser permission, normalised for storage in notification settings. */
export function permissionState(): "default" | "granted" | "denied" | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
