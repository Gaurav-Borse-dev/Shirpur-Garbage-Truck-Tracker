import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentials = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

const otpInput = z.object({
  phone: z.string().regex(/^\d{10}$/),
  role: z.enum(["resident", "driver", "admin"]),
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
    // 1. Municipal Admin (9999999999) has a fixed mock OTP (123456)
    if (data.phone === "9999999999") {
      return { ok: true as const, sent: true };
    }

    // 2. Real SMS for Residents and Drivers via Supabase (Twilio)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const formattedPhone = `+91${data.phone}`;
      const { error } = await supabaseAdmin.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        console.warn("[otp] Supabase Auth SMS send error:", error.message);
        return { ok: false as const, error: error.message };
      }

      return { ok: true as const, sent: true };
    } catch (err: any) {
      console.error("[otp] SMS send exception:", err);
      return {
        ok: false as const,
        error: err?.message || "Failed to send SMS OTP. Please try again.",
      };
    }
  });

/** Verifies the one-time code via Supabase Auth (or fixed code for Admin) and issues encrypted session cookie. */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser, secretMatches } = await import("./session.server");

    // 1. Municipal Admin: Fixed Phone 9999999999 & Fixed OTP 123456
    if (data.phone === "9999999999" || data.role === "admin") {
      const ok = await secretMatches(data.code, "123456");
      if (!ok) {
        return { ok: false as const, error: "Incorrect Admin OTP. Please enter 123456." };
      }
      await setUser({ role: "admin", username: "admin", phone: "9999999999" });
      return { ok: true as const };
    }

    // 2. Driver & Resident: Require accurate Supabase Twilio SMS OTP
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const formattedPhone = `+91${data.phone}`;
      const { data: res, error } = await supabaseAdmin.auth.verifyOtp({
        phone: formattedPhone,
        token: data.code,
        type: "sms",
      });

      if (error || (!res?.session && !res?.user)) {
        console.warn("[otp] Supabase verification failed:", error?.message);
        return {
          ok: false as const,
          error: error?.message || "Incorrect code. Please enter the accurate OTP received on your mobile.",
        };
      }

      // Accurate OTP verified by Supabase! Establish session
      if (data.role === "driver") {
        await setUser({ role: "driver", phone: data.phone });
      } else {
        await setUser({ role: "resident", phone: data.phone });
      }
      return { ok: true as const };
    } catch (err: any) {
      console.error("[otp] Verification exception:", err);
      return {
        ok: false as const,
        error: err?.message || "Unable to verify the code right now.",
      };
    }
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