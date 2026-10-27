import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Polyfill browser globals for SSR when client-side modules like Leaflet are evaluated
if (typeof globalThis.window === "undefined") {
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

  try {
    globalThis.document = doc;
  } catch {
    Object.defineProperty(globalThis, "document", { value: doc, configurable: true, writable: true });
  }

  let nav = globalThis.navigator;
  if (!nav) {
    nav = { userAgent: "Node", platform: "Win32" };
    try {
      globalThis.navigator = nav;
    } catch {
      Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });
    }
  } else {
    try {
      if (!nav.platform) {
        Object.defineProperty(nav, "platform", { value: "Win32", configurable: true });
      }
    } catch {}
  }

  const win = {
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
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
  win.window = win;
  win.document = doc;

  try {
    globalThis.localStorage = win.localStorage;
  } catch {
    Object.defineProperty(globalThis, "localStorage", { value: win.localStorage, configurable: true, writable: true });
  }
  try {
    globalThis.sessionStorage = win.sessionStorage;
  } catch {
    Object.defineProperty(globalThis, "sessionStorage", { value: win.sessionStorage, configurable: true, writable: true });
  }

  try {
    globalThis.window = win;
  } catch {
    Object.defineProperty(globalThis, "window", { value: win, configurable: true, writable: true });
  }
}

// Load .env automatically if present
const envFiles = [resolve(__dirname, ".env"), resolve(__dirname, "frontend/.env"), resolve(__dirname, "backend/.env")];
for (const envFile of envFiles) {
  if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envFile);
      break;
    } catch {}
  }
}

const frontendOutput = resolve(__dirname, "frontend/.output/server/index.mjs");
const rootOutput = resolve(__dirname, ".output/server/index.mjs");
const backendOutput = resolve(__dirname, "backend/.output/server/index.mjs");

const isBackendService = process.env.SERVICE === "backend" || process.env.TARGET === "backend";

let target = null;

if (isBackendService) {
  if (existsSync(backendOutput)) {
    target = backendOutput;
  } else {
    console.log("[CleanTrack] Building backend...");
    execSync("npm --prefix backend run build", { cwd: __dirname, stdio: "inherit" });
    target = backendOutput;
  }
} else if (existsSync(frontendOutput)) {
  target = frontendOutput;
} else if (existsSync(rootOutput)) {
  target = rootOutput;
} else if (existsSync(backendOutput)) {
  target = backendOutput;
} else {
  console.log("[CleanTrack] No build found. Building frontend...");
  execSync("npm --prefix frontend run build", { cwd: __dirname, stdio: "inherit" });
  target = frontendOutput;
}

console.log(`[CleanTrack] Starting server on port ${process.env.PORT || 3000}...`);
await import(pathToFileURL(target).href);
