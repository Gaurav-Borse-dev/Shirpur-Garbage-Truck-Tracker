export type ServerSession = {
  role: "admin" | "driver" | "resident";
  username?: string;
  phone?: string;
};

export type SessionData = { user?: ServerSession };

export async function getUser(): Promise<ServerSession | null> {
  return null;
}

export async function setUser(_user: ServerSession): Promise<void> {}

export async function clearUser(): Promise<void> {}




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