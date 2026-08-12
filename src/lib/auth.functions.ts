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
    const expectedUser = process.env["ADMIN_USERNAME"] || "admin";
    const expectedPass = process.env["ADMIN_PASSWORD"] || "admin123";
    const okUser = await secretMatches(data.username, expectedUser);
    const okPass = await secretMatches(data.password, expectedPass);
    if (!okUser || !okPass) return { ok: false as const };
    await setUser({ role: "admin", username: data.username });
    return { ok: true as const };
  });

const sendOtpInput = z.object({
  phone: z.string().regex(/^\d{10}$/),
});

/** Sends a real SMS OTP via Supabase Auth (Twilio provider). */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendOtpInput.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Format to E.164 (+91 for India)
      const formattedPhone = `+91${data.phone}`;
      const { error } = await supabaseAdmin.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        console.warn("[otp] Supabase Auth SMS send failed, falling back:", error.message);
        return { ok: true, sent: false, note: "Using demo code 123456" };
      }

      return { ok: true, sent: true };
    } catch (err) {
      console.warn("[otp] SMS send exception:", err);
      return { ok: true, sent: false, note: "Using demo code 123456" };
    }
  });

/** Verifies the one-time code via Supabase Auth or fallback env code and issues encrypted session cookie. */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser, secretMatches } = await import("./session.server");

    // 1. Try Supabase Auth verification first (Twilio SMS OTP)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const formattedPhone = `+91${data.phone}`;
      const { data: res, error } = await supabaseAdmin.auth.verifyOtp({
        phone: formattedPhone,
        token: data.code,
        type: "sms",
      });

      if (!error && res?.session) {
        await setUser({ role: data.role, phone: data.phone });
        return { ok: true as const };
      }
    } catch (err) {
      console.warn("[otp] Supabase Auth verification error, checking fallback:", err);
    }

    // 2. Fallback to server env code (for test/demo logins)
    const expectedOtp = process.env["LOGIN_OTP_CODE"] || "123456";
    const ok = await secretMatches(data.code, expectedOtp);
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