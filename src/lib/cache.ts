/**
 * Tiny versioned localStorage cache used for offline reads
 * (last-known truck positions, profile, settings snapshots).
 */
const PREFIX = "ct.cache.";
const VERSION = 1;

type Entry<T> = { v: number; at: number; data: T };

export function writeCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ v: VERSION, at: Date.now(), data } as Entry<T>));
  } catch {}
}

export function readCache<T>(key: string, maxAgeMs = 1000 * 60 * 60 * 24): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.v !== VERSION) return null;
    if (Date.now() - entry.at > maxAgeMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}
