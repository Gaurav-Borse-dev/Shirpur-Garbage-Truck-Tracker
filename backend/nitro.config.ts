import { defineConfig } from "nitro/config";

export default defineConfig({
  compatibilityDate: "2026-08-11",
  handlers: [
    { route: "/", handler: "./routes/index.ts", method: "get" },
    { route: "/api/health", handler: "./routes/api/health.ts", method: "get" },
    { route: "/api/trucks", handler: "./routes/api/trucks/index.get.ts", method: "get" },
    { route: "/api/drivers", handler: "./routes/api/drivers/index.get.ts", method: "get" },
    { route: "/api/auth/admin", handler: "./routes/api/auth/admin.post.ts", method: "post" },
    { route: "/api/auth/otp", handler: "./routes/api/auth/otp.post.ts", method: "post" },
    { route: "/api/**", handler: "./routes/api/[...].ts" },
  ],
});
