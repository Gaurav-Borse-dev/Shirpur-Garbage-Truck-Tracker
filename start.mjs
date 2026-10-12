import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const backendOutput = resolve(__dirname, "backend/.output/server/index.mjs");
const rootOutput = resolve(__dirname, ".output/server/index.mjs");

let target = null;

if (existsSync(rootOutput)) {
  target = rootOutput;
} else if (existsSync(backendOutput)) {
  target = backendOutput;
} else {
  console.log("[CleanTrack] No build found. Building backend...");
  execSync("npm --prefix backend install && npm --prefix backend run build", { cwd: __dirname, stdio: "inherit" });
  target = backendOutput;
}

console.log(`[CleanTrack] Starting server on port ${process.env.PORT || 3000}...`);
await import(pathToFileURL(target).href);
