import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentials = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

const otpInput = z.object({
  phone: z.string().regex(/^\d{10}$/),
  role: z.enum(["resident", "driver"]),
  code: z.string().regex(/^\d{6}$/),
});

/** Verifies the admin credentials on the server and issues an encrypted session cookie. */
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentials.parse(data))
  .handler(async ({ data }) => {
    const { setUser, secretMatches } = await import("./session.server");
    const okUser = await secretMatches(data.username, process.env["ADMIN_USERNAME"]);
    const okPass = await secretMatches(data.password, process.env["ADMIN_PASSWORD"]);
    if (!okUser || !okPass) return { ok: false as const };
    await setUser({ role: "admin", username: data.username });
    return { ok: true as const };
  });

/** Verifies the one-time code on the server and issues an encrypted session cookie. */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser, secretMatches } = await import("./session.server");
    const ok = await secretMatches(data.code, process.env["LOGIN_OTP_CODE"]);
    if (!ok) return { ok: false as const };
    await setUser({ role: data.role, phone: data.phone });
    return { ok: true as const };
  });

/** Returns the server-verified session, or null. Never trusts client state. */
export const getServerSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getUser } = await import("./session.server");
  return await getUser();
});

export const serverSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const { clearUser } = await import("./session.server");
  await clearUser();
  return { ok: true as const };
});