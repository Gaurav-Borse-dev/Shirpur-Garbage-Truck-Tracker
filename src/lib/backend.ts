/**
 * Backend configuration + REST client.
 *
 * Configure with env vars (no values are invented at runtime):
 *   VITE_API_URL     e.g. https://api.example.com/v1
 *   VITE_SOCKET_URL  e.g. https://api.example.com        (defaults to VITE_API_URL origin)
 *   VITE_SOCKET_PATH e.g. /socket.io                     (Socket.IO default)
 *
 * When VITE_API_URL / VITE_SOCKET_URL are absent the app runs in LOCAL mode and
 * keeps the existing on-device engine so the UI is never blank. As soon as the
 * URLs are present, every position, route, ETA and notification comes from the
 * backend and the local engine is disabled.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const API_URL = (env["VITE_API_URL"] ?? "").replace(/\/$/, "");
export const SOCKET_URL = (env["VITE_SOCKET_URL"] ?? API_URL).replace(/\/$/, "");
export const SOCKET_PATH = env["VITE_SOCKET_PATH"] ?? "/socket.io";

/** True when a production backend is configured. */
export const LIVE_BACKEND = Boolean(SOCKET_URL);

const TOKEN_KEY = "ct.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/** Thin typed REST wrapper. Throws ApiError; callers decide on queueing/fallback. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  if (!API_URL) throw new ApiError("Backend API URL is not configured", 0);
  const token = getToken();
  const res = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });
  if (!res.ok) throw new ApiError(await res.text().catch(() => res.statusText), res.status);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Endpoint map — single place to re-point if the backend paths differ. */
export const endpoints = {
  authVerify: "/auth/verify",
  me: "/me",
  citizenProfile: "/citizen/profile",
  driverProfile: "/driver/profile",
  trucks: "/trucks",
  truckLocations: "/trucks/locations",
  routes: "/routes",
  stops: "/stops",
  notifications: "/notifications",
  complaints: "/complaints",
  feedback: "/feedback",
  analytics: "/analytics",
  driverDuty: "/driver/duty",
  driverGps: "/driver/gps",
  stopComplete: (id: string) => `/stops/${id}/complete`,
  stopSkip: (id: string) => `/stops/${id}/skip`,
} as const;