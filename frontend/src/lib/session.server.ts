import { useSession } from "@tanstack/react-start/server";

export type ServerSession = {
  role: "admin" | "driver" | "resident";
  username?: string;
  phone?: string;
};

type SessionData = { user?: ServerSession };

function config() {
  const password =
    process.env["SESSION_SECRET"] || "cleantrack-shirpur-super-secret-session-key-2026-min32chars";
  return {
    password,
    name: "cleantrack-session",
    maxAge: 60 * 60 * 12,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function readSession() {
  return useSession<SessionData>(config());
}

export async function getUser(): Promise<ServerSession | null> {
  try {
    const session = await readSession();
    return session?.data?.user ?? null;
  } catch (err) {
    console.warn("[session] Could not read user session", err);
    return null;
  }
}

export async function setUser(user: ServerSession) {
  try {
    const session = await readSession();
    if (session?.update) {
      await session.update({ user });
    }
  } catch (err) {
    console.warn("[session] Could not update session", err);
  }
}

export async function clearUser() {
  try {
    const session = await readSession();
    if (session?.clear) {
      await session.clear();
    }
  } catch (err) {
    console.warn("[session] Could not clear session", err);
  }
}

/** Constant-time-ish comparison over fixed-length digests. */
export async function secretMatches(input: string, expected: string | undefined) {
  if (!expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
