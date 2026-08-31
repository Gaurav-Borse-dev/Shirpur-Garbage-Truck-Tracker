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
 * sendOtp — Sends OTP for login.
 * Configured with OTP 123456 for instant login without SMS gateway delay.
 */
export const sendOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => sendOtpInput.parse(data))
  .handler(async ({ data }) => {
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    console.log(`[otp] OTP 123456 issued for ******${clean.slice(-4)}`);
    return { ok: true as const, sent: true, useFirebase: false };
  });

/**
 * verifyOtp — Handles OTP verification (123456) for resident, driver, and admin.
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => otpInput.parse(data))
  .handler(async ({ data }) => {
    const { setUser } = await import("./session.server");
    const clean = data.phone.trim().replace(/\D/g, "").slice(-10);
    const code = data.code.trim();

    // Verify OTP 123456
    if (code === "123456") {
      if (data.role === "admin") {
        await setUser({ role: "admin", username: "admin", phone: clean });
      } else if (data.role === "driver") {
        await setUser({ role: "driver", phone: clean });
      } else {
        await setUser({ role: "resident", phone: clean });
      }
      console.log(`[otp] Login successful for ******${clean.slice(-4)} as ${data.role}`);
      return { ok: true as const };
    }

    return {
      ok: false as const,
      error: "Incorrect OTP. Please enter 123456",
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