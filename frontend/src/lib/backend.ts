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

/** True only when an external Socket.IO gateway is configured. */
export const SOCKET_ENABLED = Boolean(SOCKET_URL);

/**
 * True whenever positions come from a backend rather than the on-device
 * engine. CleanTrack now always tracks against Shirpur Cloud (PostGIS live
 * locations), so no motion is ever synthesized on the client.
 */
export const LIVE_BACKEND = true;

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

/** User-friendly error messages for common HTTP statuses. */
const STATUS_MESSAGES: Record<number, string> = {
  400: "The request was invalid. Please check your input.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "A conflict occurred. The data may have been modified.",
  422: "The data provided is invalid.",
  429: "Too many requests. Please wait a moment.",
  500: "A server error occurred. Please try again later.",
  502: "The server is temporarily unavailable.",
  503: "The service is undergoing maintenance.",
};

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Request timeout in milliseconds (default: 15000). */
  timeout?: number;
  /** Max retry attempts for 5xx and network errors (default: 2). */
  retries?: number;
};

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_MS = 800;

/** Thin typed REST wrapper with timeout, retry, and error classification. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  if (!API_URL) throw new ApiError("Backend API URL is not configured", 0);

  const maxAttempts = 1 + (opts.retries ?? DEFAULT_RETRIES);
  const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT;
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Exponential backoff on retries (skip delay on first attempt)
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const { signal: userSignal } = opts;
    // Combine user signal with timeout
    if (userSignal?.aborted) throw new ApiError("Request cancelled", 0);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (userSignal) {
      userSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
        method: opts.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        const message = STATUS_MESSAGES[res.status] ?? errorText;
        lastError = new ApiError(message, res.status);

        // Only retry on 5xx or 429 (rate limit)
        if (res.status >= 500 || res.status === 429) {
          // Respect Retry-After header if present
          if (res.status === 429) {
            const retryAfter = res.headers.get("Retry-After");
            if (retryAfter) {
              const waitMs = Math.min(parseInt(retryAfter, 10) * 1000 || 5000, 30_000);
              await new Promise((r) => setTimeout(r, waitMs));
            }
          }
          continue; // retry
        }

        // Client errors (4xx except 429) are not retryable
        throw lastError;
      }

      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ApiError) throw err;
      // Network failure or abort — retryable
      const isAbort = (err as Error).name === "AbortError";
      lastError = new ApiError(
        isAbort ? "Request timed out" : "Network error — check your connection",
        0,
      );
      if (isAbort && userSignal?.aborted) throw lastError; // user-initiated abort, don't retry
      continue; // retry on timeout or network error
    }
  }

  throw lastError ?? new ApiError("Request failed after retries", 0);
}

/** Endpoint map — single place to re-point if the backend paths differ. */
export const endpoints = {
  authVerify: "/auth/verify",
  authAdmin: "/auth/admin",
  authOtp: "/auth/otp",
  me: "/me",
  citizenProfile: "/citizen/profile",
  driverProfile: "/driver/profile",
  trucks: "/trucks",
  truckLocations: "/trucks/locations",
  truck: (id: string) => `/trucks/${id}`,
  routes: "/routes",
  route: (id: string) => `/routes/${id}`,
  stops: "/stops",
  notifications: "/notifications",
  complaints: "/complaints",
  complaint: (id: string) => `/complaints/${id}`,
  feedback: "/feedback",
  analytics: "/analytics",
  drivers: "/drivers",
  driver: (id: string) => `/drivers/${id}`,
  driverDuty: "/driver/duty",
  driverGps: "/driver/gps",
  stopComplete: (id: string) => `/stops/${id}/complete`,
  stopSkip: (id: string) => `/stops/${id}/skip`,
  health: "/health",
} as const;
