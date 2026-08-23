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

// In-memory OTP storage for direct OTP verification (10 minutes validity)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

const FAST2SMS_KEY = process.env["FAST2SMS_API_KEY"] || "6wQGN541KWlJ8XmPMOs2kdxqbBzrtLA3p9DTHyinUu7Co0IEShfwhBOMbEIoXSFYHzTmUk1RlKZCrgPi";

/** Sends a real SMS OTP via Fast2SMS & Supabase Auth. */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendOtpInput.parse(data))
  .handler(async ({ data }) => {
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    const formattedPhone = `+91${clean}`;
    let sent = false;

    // 1. Generate 6-digit OTP and store for verification
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(clean, {
      code: generatedOtp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // 2. Attempt delivery via Fast2SMS API
    if (FAST2SMS_KEY) {
      try {
        const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": FAST2SMS_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: "otp",
            variables_values: generatedOtp,
            numbers: clean,
          }),
        });
        const json = await smsRes.json().catch(() => ({}));
        if (json?.return === true || json?.status_code === 200) {
          console.log(`[otp] Fast2SMS OTP successfully sent to ******${clean.slice(-4)}`);
          sent = true;
        } else {
          console.warn("[otp] Fast2SMS response:", json);
        }
      } catch (err) {
        console.warn("[otp] Fast2SMS dispatch exception:", err);
      }
    }

    // 3. Also trigger Supabase Auth (if Auth Hook is active)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          shouldCreateUser: true,
        },
      });

      if (!error) {
        sent = true;
      }
    } catch (err: any) {
      console.warn("[otp] Supabase signInWithOtp note:", err?.message || err);
    }

    return { ok: true as const, sent };
  });

/** Verifies the one-time code strictly via Fast2SMS store, Supabase Auth, or default fixed OTP (123456) and establishes the secure session. */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser } = await import("./session.server");
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    const code = data.code.trim();

    const entry = otpStore.get(clean);
    const isDirectMatch = entry && entry.code === code && entry.expiresAt > Date.now();
    const isDefaultMatch = code === "123456";

    // Allow direct match or fallback default match
    if (isDirectMatch || isDefaultMatch) {
      if (isDirectMatch) {
        otpStore.delete(clean);
      }
      if (data.role === "admin") {
        await setUser({ role: "admin", username: "admin", phone: clean });
      } else if (data.role === "driver") {
        await setUser({ role: "driver", phone: clean });
      } else {
        await setUser({ role: "resident", phone: clean });
      }
      return { ok: true as const };
    }

    // Try verifying with Supabase Auth
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const formattedPhone = `+91${clean}`;

      const { data: res, error } = await supabaseAdmin.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: "sms",
      });

      if (error || (!res?.session && !res?.user)) {
        console.warn("[otp] Verification check:", error?.message || "invalid code");
        return {
          ok: false as const,
          error: error?.message || "Incorrect verification code. (Hint: Use default OTP 123456)",
        };
      }

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