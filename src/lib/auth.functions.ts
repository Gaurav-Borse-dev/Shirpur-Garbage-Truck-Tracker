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

/** Admin phone numbers that bypass Firebase and use the dev OTP flow. */
const ADMIN_PHONES = new Set(["9999999999", "9999999990"]);

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
 * - Admin phones (9999999999, 9999999990): Returns `useFirebase: false`.
 *   In non-production, the static OTP 123456 is accepted.
 * - All other phones: Returns `useFirebase: true`.
 *   The client must use Firebase Phone Auth to send and verify the real OTP,
 *   then call `setFirebaseSession` to establish the server session.
 */
export const sendOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => sendOtpInput.parse(data))
  .handler(async ({ data }) => {
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);

    if (ADMIN_PHONES.has(clean)) {
      console.log(`[otp] Admin phone ******${clean.slice(-4)} — bypass mode`);
      return { ok: true as const, sent: true, useFirebase: false };
    }

    // All non-admin phones use Firebase Phone Auth (free 10K SMS/month)
    console.log(`[otp] Firebase Phone Auth requested for ******${clean.slice(-4)}`);
    return { ok: true as const, sent: true, useFirebase: true };
  });

/**
 * verifyOtp — Fallback OTP verification for admin bypass flow.
 *
 * In production, only admin phones can use this endpoint (static OTP is rejected
 * for regular users). Non-admin users authenticate via Firebase Phone Auth on
 * the client and call `setFirebaseSession` instead.
 *
 * In development (NODE_ENV !== 'production'), the static OTP 123456 is accepted
 * for any phone to ease testing.
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser } = await import("./session.server");
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    const code = data.code.trim();
    const isProduction = process.env.NODE_ENV === "production";
    const isAdminPhone = ADMIN_PHONES.has(clean);

    // In production, only admin phones may use the static OTP bypass
    if (isProduction && !isAdminPhone) {
      return {
        ok: false as const,
        error: "Please use Firebase Phone Auth to verify your number.",
      };
    }

    // Verify static OTP (admin bypass, or dev-mode testing)
    if (code === "123456") {
      if (data.role === "admin") {
        await setUser({ role: "admin", username: "admin", phone: clean });
      } else if (data.role === "driver") {
        await setUser({ role: "driver", phone: clean });
      } else {
        await setUser({ role: "resident", phone: clean });
      }
      console.log(`[otp] Login successful for ******${clean.slice(-4)} as ${data.role}${!isProduction ? " (dev bypass)" : ""}`);
      return { ok: true as const };
    }

    return {
      ok: false as const,
      error: isProduction
        ? "Incorrect OTP. Please try again."
        : "Incorrect OTP. Use 123456 in development mode.",
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

    if (data.role === "admin") {
      await setUser({ role: "admin", username: "admin", phone: clean });
    } else if (data.role === "driver") {
      await setUser({ role: "driver", phone: clean });
    } else {
      await setUser({ role: "resident", phone: clean });
    }

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