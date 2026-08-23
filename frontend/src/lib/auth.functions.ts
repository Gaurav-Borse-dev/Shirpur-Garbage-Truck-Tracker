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

// Twilio Verify Credentials
const TWILIO_ACCOUNT_SID = process.env["TWILIO_ACCOUNT_SID"] || "AC6ac22d5b7e9601e9ac27cd4a96c5471f";
const TWILIO_AUTH_TOKEN = process.env["TWILIO_AUTH_TOKEN"] || "4161d6044e40a52998c326a6612bd724";
const TWILIO_VERIFY_SERVICE_SID = process.env["TWILIO_VERIFY_SERVICE_SID"] || "VA2e2921239ad93656ef667153e8beb91a";

/** Sends a real SMS OTP via Twilio Verify & Supabase Auth. */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendOtpInput.parse(data))
  .handler(async ({ data }) => {
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    const formattedPhone = `+91${clean}`;
    let sent = false;

    // 1. Dispatch real SMS OTP via Twilio Verify API
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID) {
      try {
        const authHeader = "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
        const bodyParams = new URLSearchParams({
          To: formattedPhone,
          Channel: "sms",
        });

        const twilioRes = await fetch(
          `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
          {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: bodyParams.toString(),
          }
        );

        const twilioJson = await twilioRes.json().catch(() => ({}));
        if (twilioRes.ok && (twilioJson?.status === "pending" || twilioJson?.sid)) {
          console.log(`[otp] Real Twilio SMS OTP successfully sent to ******${clean.slice(-4)}`);
          sent = true;
        } else {
          console.warn("[otp] Twilio Verify notice:", twilioJson?.message || twilioJson);
        }
      } catch (err) {
        console.warn("[otp] Twilio Verify dispatch exception:", err);
      }
    }

    // 2. Also trigger Supabase Auth (if Auth Hook is active)
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

/** Verifies the real one-time code via Twilio Verify, Supabase Auth, or default fixed OTP (123456). */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser } = await import("./session.server");
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    const code = data.code.trim();
    const formattedPhone = `+91${clean}`;

    // Developer fallback code
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

    // 1. Verify via Twilio Verify API
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID) {
      try {
        const authHeader = "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
        const bodyParams = new URLSearchParams({
          To: formattedPhone,
          Code: code,
        });

        const twilioCheckRes = await fetch(
          `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
          {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: bodyParams.toString(),
          }
        );

        const twilioCheckJson = await twilioCheckRes.json().catch(() => ({}));
        if (twilioCheckRes.ok && twilioCheckJson?.status === "approved") {
          console.log(`[otp] Real Twilio OTP verified successfully for ******${clean.slice(-4)}`);
          if (data.role === "admin") {
            await setUser({ role: "admin", username: "admin", phone: clean });
          } else if (data.role === "driver") {
            await setUser({ role: "driver", phone: clean });
          } else {
            await setUser({ role: "resident", phone: clean });
          }
          return { ok: true as const };
        }
      } catch (err) {
        console.warn("[otp] Twilio verification check exception:", err);
      }
    }

    // 2. Try verifying with Supabase Auth
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: res, error } = await supabaseAdmin.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: "sms",
      });

      if (error || (!res?.session && !res?.user)) {
        console.warn("[otp] Verification check:", error?.message || "invalid code");
        return {
          ok: false as const,
          error: error?.message || "Incorrect verification code. Please check your SMS.",
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
        error: err?.message || "Unable to verify code right now.",
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