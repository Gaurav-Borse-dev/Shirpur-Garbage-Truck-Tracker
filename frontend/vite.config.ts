// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Workaround for Rolldown/Nitro code-splitting bugs in the production build:
 *
 * Bug 1: `_ssr/ssr.mjs` re-exports `ssr_exports` which is never defined.
 *         It should be `server_default` from `_ssr/ssr2.mjs`.
 *
 * Bug 2: `_ssr/ssr2.mjs` imports `createMiddleware` from `_ssr/ssr.mjs`,
 *         but `ssr.mjs` also imports from `ssr2.mjs` — a circular dependency.
 *         At module evaluation time, `createMiddleware` is still undefined when
 *         `ssr2.mjs` calls it at top-level (line ~534/1504).
 *
 * Fix: Inline the `createMiddleware` function into `ssr2.mjs` (removing the
 * circular import) and fix the `ssr_exports` reference in `ssr.mjs`.
 */
function fixSsrExports(): import("vite").Plugin {
  return {
    name: "fix-ssr-exports",
    apply: "build",
    enforce: "post",
    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        const ssrDir = resolve(process.cwd(), ".output/server/_ssr");
        const ssrPath = resolve(ssrDir, "ssr.mjs");
        const ssr2Path = resolve(ssrDir, "ssr2.mjs");

        if (!existsSync(ssrPath)) return;

        let ssrCode = readFileSync(ssrPath, "utf8");
        let ssr2Code = existsSync(ssr2Path)
          ? readFileSync(ssr2Path, "utf8")
          : "";
        let patched = false;

        // --- Fix Bug 2: circular createMiddleware import ---
        // Extract the createMiddleware function body from ssr.mjs
        const cmRegion =
          /\/\/#region[^\n]*createMiddleware[^\n]*\n([\s\S]*?)\/\/#endregion/;
        const cmMatch = ssrCode.match(cmRegion);

        if (cmMatch && ssr2Code) {
          const createMiddlewareFn = cmMatch[1].trim();

          // Check if ssr2.mjs imports createMiddleware from ssr.mjs
          const circularImport = ssr2Code.match(
            /import\s*\{[^}]*\bo\s+as\s+createMiddleware\b[^}]*\}\s*from\s*["']\.\/ssr\.mjs["'];?\n?/,
          );
          if (circularImport) {
            // Remove the circular import line
            ssr2Code = ssr2Code.replace(circularImport[0], "");
            // Inject createMiddleware definition before its first usage
            const firstUsageIdx = ssr2Code.indexOf("createMiddleware");
            if (firstUsageIdx > -1) {
              // Find a good insertion point (start of the line before first usage)
              const insertAt = ssr2Code.lastIndexOf("\n", firstUsageIdx) + 1;
              ssr2Code =
                ssr2Code.slice(0, insertAt) +
                "// [fix-ssr-exports] Inlined createMiddleware to break circular import\n" +
                createMiddlewareFn +
                "\n" +
                ssr2Code.slice(insertAt);
            }
            writeFileSync(ssr2Path, ssr2Code, "utf8");
            patched = true;
            console.log(
              "[fix-ssr-exports] Inlined createMiddleware into ssr2.mjs to break circular dependency",
            );
          }
        }

        // --- Fix Bug 1: undefined ssr_exports ---
        if (ssrCode.includes("ssr_exports")) {
          if (
            !ssrCode.includes("var ssr_exports") &&
            !ssrCode.includes("const ssr_exports") &&
            !ssrCode.includes("let ssr_exports")
          ) {
            // Ensure server_default is imported from ssr2.mjs
            const ssr2Import = ssrCode.match(
              /import\s*\{([^}]+)\}\s*from\s*["']\.\/ssr2\.mjs["'];/,
            );
            if (ssr2Import && !ssr2Import[1].includes("server_default")) {
              ssrCode = ssrCode.replace(
                ssr2Import[0],
                ssr2Import[0].replace("{", "{ a as server_default,"),
              );
            }
            ssrCode = ssrCode.replace(/\bssr_exports\b/g, "server_default");
            writeFileSync(ssrPath, ssrCode, "utf8");
            patched = true;
            console.log(
              "[fix-ssr-exports] Fixed undefined ssr_exports in ssr.mjs",
            );
          }
        }

        if (patched) {
          console.log("[fix-ssr-exports] SSR output patching complete ✓");
        }
      },
    },
  };
}

export default defineConfig({
  nitro: {
    preset: process.env.NITRO_PRESET || "node-server",
  },
  tanstackStart: {
    serverFns: {
      disableCsrfMiddlewareWarning: true,
    },
  },
  plugins: [fixSsrExports()],
});
