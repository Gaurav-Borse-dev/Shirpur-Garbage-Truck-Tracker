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

/** Admin phone number that bypasses Firebase and uses the static test OTP (123456). */
const ADMIN_PHONE = "9999999999";

/** Verifies the admin credentials on the server and issues an encrypted session cookie. */
export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => credentials.parse(data))
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

/**
 * sendOtp — Determines the authentication flow for the given phone number.
 *
 * - Admin phone (9999999999): Returns `useFirebase: false` for instant static OTP (123456).
 * - All other logins (driver and resident): Returns `useFirebase: true` for real SMS OTP via Firebase.
 */
export const sendOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => sendOtpInput.parse(data))
  .handler(async ({ data }) => {
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);

    if (clean === ADMIN_PHONE) {
      console.log(`[otp] Admin phone ${clean} — bypass mode (123456)`);
      return { ok: true as const, sent: true, useFirebase: false };
    }

    // All non-admin phones use Firebase Phone Auth (free 10K SMS/month)
    console.log(`[otp] Firebase Phone Auth requested for ******${clean.slice(-4)}`);
    return { ok: true as const, sent: true, useFirebase: true };
  });

/**
 * verifyOtp — OTP verification strictly for admin bypass flow (9999999999 with 123456).
 * Drivers and residents authenticate via Firebase and use setFirebaseSession.
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser } = await import("./session.server");
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    const code = data.code.trim();

    if (clean !== ADMIN_PHONE) {
      return {
        ok: false as const,
        error: "Real SMS OTP verification is required for this mobile number.",
      };
    }

    if (code === "123456") {
      await setUser({ role: "admin", username: "admin", phone: clean });
      return { ok: true as const };
    }

    return {
      ok: false as const,
      error: "Incorrect code. Please enter 123456 for admin.",
    };
  });

/**
 * setFirebaseSession — Called after Firebase Phone Auth succeeds on the client.
 * Sets the server session cookie for the authenticated user.
 */
const firebaseSessionInput = z.object({
  phone: z.string().regex(/^\d{10}$/),
  role: z.enum(["resident", "driver", "admin"]),
  firebaseUid: z.string().min(1),
});

export const setFirebaseSession = createServerFn({ method: "POST" })
  .validator((data: unknown) => firebaseSessionInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser } = await import("./session.server");
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);

    console.log(`[firebase-auth] Setting session for ******${clean.slice(-4)} as ${data.role} (uid: ${data.firebaseUid.slice(0, 8)}...)`);

    let isDbDriver = false;
    try {
      const { admin } = await import("./tracking.server");
      const sb = await admin();
      const { data: profile } = await sb
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${clean},phone.eq.91${clean},phone.eq.+91${clean}`)
        .maybeSingle();

      if (profile?.user_id) {
        const { data: driverRow } = await sb
          .from("drivers")
          .select("id")
          .eq("user_id", profile.user_id)
          .maybeSingle();
        if (driverRow) isDbDriver = true;
      }
    } catch (err) {
      console.warn("[firebase-auth] Could not check driver table", err);
    }

    // Role determination is strictly authoritative on the server — never trust client-proclaimed role
    let finalRole: "admin" | "driver" | "resident" = "resident";

    if (clean === ADMIN_PHONE) {
      finalRole = "admin";
      await setUser({ role: "admin", username: "admin", phone: clean });
    } else if (isDbDriver) {
      finalRole = "driver";
      await setUser({ role: "driver", phone: clean });
    } else {
      finalRole = "resident";
      await setUser({ role: "resident", phone: clean });
    }

    return { ok: true as const, resolvedRole: finalRole };
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