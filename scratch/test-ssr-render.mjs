import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import http from "node:http";

// Import start.mjs logic
process.env.PORT = "3005";
await import("../start.mjs");

// Wait 1 second for Nitro server to bind
await new Promise(r => setTimeout(r, 1200));

async function testRoute(path) {
  try {
    const res = await fetch(`http://127.0.0.1:3005${path}`);
    const text = await res.text();
    console.log(`[SSR TEST] ${path} -> Status ${res.status}, Body length: ${text.length}`);
    if (res.status !== 200) {
      console.error(`[SSR TEST FAILED] Response preview: ${text.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[SSR TEST ERROR] ${path}: ${err.message}`);
    return false;
  }
}

const routes = ["/", "/role", "/driver", "/resident", "/admin/map", "/admin/reports"];
let allPassed = true;
for (const r of routes) {
  const ok = await testRoute(r);
  if (!ok) allPassed = false;
}

console.log(`[SSR TEST RESULT] allPassed: ${allPassed}`);
process.exit(allPassed ? 0 : 1);
