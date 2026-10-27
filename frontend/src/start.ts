import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Minimal SSR window shim for client-only libraries (e.g. Leaflet) evaluated during bundle loading
if (typeof globalThis.window === "undefined") {
  const g = globalThis as any;
  const doc = {
    createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {}, getElementsByTagName: () => [], getContext: () => null }),
    createElementNS: () => ({ style: {}, setAttribute: () => {} }),
    documentElement: { style: {} },
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  let nav = g.navigator;
  if (!nav) {
    nav = { userAgent: "Node", platform: "Win32" };
    try {
      g.navigator = nav;
    } catch {
      Object.defineProperty(g, "navigator", { value: nav, configurable: true, writable: true });
    }
  } else {
    try {
      if (!nav.platform) {
        Object.defineProperty(nav, "platform", { value: "Win32", configurable: true });
      }
    } catch {}
  }

  try {
    g.document = doc;
  } catch {
    Object.defineProperty(g, "document", { value: doc, configurable: true, writable: true });
  }

  const win = {
    requestAnimationFrame: (cb: (...args: any[]) => void) => setTimeout(cb, 16),
    cancelAnimationFrame: (id: any) => clearTimeout(id),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    location: { href: "", protocol: "https:", host: "localhost", pathname: "/" },
    devicePixelRatio: 1,
    screen: { deviceXDPI: 96, logicalXDPI: 96, width: 1920, height: 1080 },
    navigator: nav,
    document: doc,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };

  try {
    g.localStorage = win.localStorage;
  } catch {
    Object.defineProperty(g, "localStorage", { value: win.localStorage, configurable: true, writable: true });
  }
  try {
    g.sessionStorage = win.sessionStorage;
  } catch {
    Object.defineProperty(g, "sessionStorage", { value: win.sessionStorage, configurable: true, writable: true });
  }

  try {
    g.window = win;
  } catch {
    Object.defineProperty(g, "window", { value: win, configurable: true, writable: true });
  }
}

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));
