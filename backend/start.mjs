import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env automatically if present
const envPath = resolve(__dirname, ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch {}
}

const outputPath = resolve(__dirname, ".output/server/index.mjs");

if (!existsSync(outputPath)) {
  console.log("[CleanTrack Backend] .output build not found. Running 'npm run build'...");
  execSync("npm run build", { cwd: __dirname, stdio: "inherit" });
}

console.log(`[CleanTrack Backend] Starting server on port ${process.env.PORT || 3000}...`);
await import(pathToFileURL(outputPath).href);
