import { create } from "zustand";

export type PendingAction = {
  id: string;
  kind: "booking" | "stop-complete" | "stop-skip" | "duty";
  payload: unknown;
  queuedAt: number;
};

const KEY = "ct.pending";

function load(): PendingAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as PendingAction[];
  } catch {
    return [];
  }
}

function save(q: PendingAction[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(q));
  } catch {}
}

type OfflineState = {
  online: boolean;
  pending: PendingAction[];
  hydrated: boolean;
  hydrate: () => void;
  setOnline: (v: boolean) => void;
  /** Queue a write made while offline so it can be replayed on reconnect. */
  enqueue: (kind: PendingAction["kind"], payload: unknown) => void;
  /** Replay queued writes; the handler resolves false to keep an item queued. */
  flush: (handler: (a: PendingAction) => boolean | Promise<boolean>) => Promise<number>;
};

export const useOffline = create<OfflineState>((set, get) => ({
  online: true,
  pending: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ pending: load(), hydrated: true, online: navigator.onLine !== false });
  },
  setOnline: (online) => set({ online }),
  enqueue: (kind, payload) => {
    const item: PendingAction = {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      payload,
      queuedAt: Date.now(),
    };
    const pending = [...get().pending, item];
    save(pending);
    set({ pending });
  },
  flush: async (handler) => {
    const queue = get().pending;
    if (!queue.length) return 0;
    const remaining: PendingAction[] = [];
    let done = 0;
    for (const item of queue) {
      const ok = await handler(item);
      if (ok) done++;
      else remaining.push(item);
    }
    save(remaining);
    set({ pending: remaining });
    return done;
  },
}));

/** Wire browser connectivity events once (client only). */
let wired = false;
export function startOfflineWatcher() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  useOffline.getState().hydrate();
  window.addEventListener("online", () => useOffline.getState().setOnline(true));
  window.addEventListener("offline", () => useOffline.getState().setOnline(false));
}
