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

/** Sends a real SMS OTP via Supabase Auth (which triggers the send-sms Edge Function Auth Hook). */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendOtpInput.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
      const formattedPhone = `+91${clean}`;

      const { error } = await supabaseAdmin.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        console.warn("[otp] Supabase Auth SMS send warning:", error.message);
      }

      return { ok: true as const, sent: !error };
    } catch (err: any) {
      console.warn("[otp] SMS send exception, proceeding with default OTP support:", err);
      return {
        ok: true as const,
        sent: false,
      };
    }
  });

/** Verifies the one-time code strictly via Supabase Auth or default fixed OTP (123456) and establishes the secure session. */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser } = await import("./session.server");
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    const code = data.code.trim();

    // Support fixed default OTP "123456"
    if (code === "123456") {
      if (data.role === "admin") {
        await setUser({ role: "admin", username: "admin", phone: clean });
      } else if (data.role === "driver") {
        await setUser({ role: "driver", phone: clean });
      } else {
        await setUser({ role: "resident", phone: clean });
      }
      return { ok: true as const };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const formattedPhone = `+91${clean}`;

      const { data: res, error } = await supabaseAdmin.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: "sms",
      });

      if (error || (!res?.session && !res?.user)) {
        console.warn("[otp] Supabase verification failed:", error?.message);
        const msg = (error?.message || "").toLowerCase();
        if (msg.includes("expired")) {
          return {
            ok: false as const,
            error: "This OTP has expired. Please enter default OTP 123456 or request a new one.",
          };
        }
        return {
          ok: false as const,
          error: error?.message || "Incorrect verification code. (Hint: Use default OTP 123456)",
        };
      }

      // Establish session based on detected / resolved role
      if (data.role === "admin") {
        await setUser({ role: "admin", username: "admin", phone: clean });
      } else if (data.role === "driver") {
        await setUser({ role: "driver", phone: clean });
      } else {
        await setUser({ role: "resident", phone: clean });
      }

      return { ok: true as const };
    } catch (err: any) {
      console.error("[otp] Verification exception:", err);
      return {
        ok: false as const,
        error: err?.message || "Unable to verify code right now. Use default OTP 123456.",
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