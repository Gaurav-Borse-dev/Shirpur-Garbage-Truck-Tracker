/**
 * Server-only FCM (HTTP v1) delivery layer.
 *
 * Credentials come from the FIREBASE_SERVICE_ACCOUNT secret and never leave
 * the server. An OAuth access token is minted with a locally signed RS256 JWT
 * and cached in module memory until shortly before it expires.
 */

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cached: { token: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    console.error("[fcm] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

export function pushConfigured() {
  return serviceAccount() !== null;
}

function b64url(bytes: ArrayBuffer | Uint8Array | string) {
  const data =
    typeof bytes === "string"
      ? new TextEncoder().encode(bytes)
      : bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes);
  let binary = "";
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string) {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function accessToken(): Promise<string | null> {
  const sa = serviceAccount();
  if (!sa) return null;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );

  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToPkcs8(sa.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(`${header}.${claims}`),
    );
    const assertion = `${header}.${claims}.${b64url(signature)}`;

    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[fcm] token exchange failed", res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return cached.token;
  } catch (error) {
    console.error("[fcm] failed to mint access token", error);
    return null;
  }
}

export type PushMessage = {
  title: string;
  body?: string;
  /** In-app deep link, e.g. "/resident?truck=GBR-04". */
  link?: string;
  kind?: string;
  data?: Record<string, string>;
};

export type SendOutcome =
  | { ok: true }
  /** `retire` marks tokens FCM says are permanently dead. */
  | { ok: false; error: string; retire: boolean };

const DEAD_TOKEN_STATUSES = new Set(["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"]);

/** Sends one message to one registration token. Never throws. */
export async function sendToToken(token: string, message: PushMessage): Promise<SendOutcome> {
  const sa = serviceAccount();
  const bearer = await accessToken();
  if (!sa || !bearer) return { ok: false, error: "push_not_configured", retire: false };

  const data: Record<string, string> = {
    kind: message.kind ?? "generic",
    ...(message.link ? { link: message.link } : {}),
    ...(message.data ?? {}),
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, ...(message.body ? { body: message.body } : {}) },
            data,
            android: {
              priority: "HIGH",
              notification: {
                channel_id: "cleantrack_truck_alerts",
                sound: "truck_bell",
                notification_priority: "PRIORITY_MAX",
                visibility: "PUBLIC",
                default_vibrate_timings: false,
                vibrate_timings: ["0.1s", "0.2s", "0.1s", "0.2s"],
                icon: "ic_launcher",
              },
            },
            webpush: {
              headers: {
                Urgency: "high",
              },
              notification: {
                icon: "/shirpur-logo.jpg",
                badge: "/shirpur-logo.jpg",
                vibrate: [200, 100, 200, 100, 200],
                requireInteraction: true,
              },
              fcm_options: {
                link: message.link || "/resident",
              },
            },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.ok) return { ok: true };

    const text = await res.text();
    let status = "";
    try {
      status = (JSON.parse(text) as { error?: { status?: string } }).error?.status ?? "";
    } catch {}
    const retire = res.status === 404 || DEAD_TOKEN_STATUSES.has(status);
    console.error("[fcm] send failed", res.status, status);
    return { ok: false, error: status || `http_${res.status}`, retire };
  } catch (error) {
    console.error("[fcm] send threw", error);
    return { ok: false, error: "network_error", retire: false };
  }
}
