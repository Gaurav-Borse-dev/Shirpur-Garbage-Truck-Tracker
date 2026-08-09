/**
 * Server-only push orchestration: token lifecycle, per-subject preferences,
 * frequency throttling and delivery logging. All access uses the service-role
 * client — these tables are unreachable from the browser.
 */
import { sendToToken, pushConfigured, type PushMessage } from "./fcm.server";
import { DRIVER_NAMES, TRUCKS } from "./trucks";

export type SubjectRole = "resident" | "driver" | "admin";
export type Subject = { role: SubjectRole; key: string };
export type AlertFrequency = "immediate" | "every_15m" | "hourly" | "daily";

export type Prefs = {
  nearbyAlertsEnabled: boolean;
  alertFrequency: AlertFrequency;
};

const FREQUENCY_MS: Record<AlertFrequency, number> = {
  immediate: 0,
  every_15m: 15 * 60_000,
  hourly: 60 * 60_000,
  daily: 24 * 60 * 60_000,
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const DEFAULT_PREFS: Prefs = { nearbyAlertsEnabled: true, alertFrequency: "immediate" };

export async function getPrefs(subject: Subject): Promise<Prefs> {
  const sb = await db();
  const { data } = await sb
    .from("notification_prefs")
    .select("nearby_alerts_enabled, alert_frequency")
    .eq("subject_role", subject.role)
    .eq("subject_key", subject.key)
    .maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return {
    nearbyAlertsEnabled: data.nearby_alerts_enabled,
    alertFrequency: (data.alert_frequency as AlertFrequency) ?? "immediate",
  };
}

export async function savePrefs(subject: Subject, prefs: Prefs): Promise<Prefs> {
  const sb = await db();
  await sb.from("notification_prefs").upsert(
    {
      subject_role: subject.role,
      subject_key: subject.key,
      nearby_alerts_enabled: prefs.nearbyAlertsEnabled,
      alert_frequency: prefs.alertFrequency,
    },
    { onConflict: "subject_role,subject_key" },
  );
  // Turning alerts off retires the device tokens too, so nothing can be pushed
  // to a device whose owner opted out.
  if (!prefs.nearbyAlertsEnabled) await revokeAllTokens(subject);
  return prefs;
}

/** Registers (or refreshes) a device token, re-binding it to the current subject. */
export async function registerToken(
  subject: Subject,
  token: string,
  platform: "web" | "android" | "ios",
  userAgent?: string,
) {
  const sb = await db();
  const { error } = await sb.from("device_tokens").upsert(
    {
      subject_role: subject.role,
      subject_key: subject.key,
      token,
      platform,
      user_agent: userAgent ?? null,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
      failure_count: 0,
    },
    { onConflict: "token" },
  );
  if (error) {
    console.error("[push] token registration failed", error.message);
    return false;
  }
  return true;
}

/** Marks one token revoked (user removed permission on that device). */
export async function revokeToken(token: string) {
  const sb = await db();
  await sb
    .from("device_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token);
}

export async function revokeAllTokens(subject: Subject) {
  const sb = await db();
  await sb
    .from("device_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("subject_role", subject.role)
    .eq("subject_key", subject.key)
    .is("revoked_at", null);
}

async function activeTokens(subject: Subject) {
  const sb = await db();
  const { data } = await sb
    .from("device_tokens")
    .select("id, token, failure_count")
    .eq("subject_role", subject.role)
    .eq("subject_key", subject.key)
    .is("revoked_at", null);
  return data ?? [];
}

async function log(
  subject: Subject,
  tokenId: string | null,
  message: PushMessage,
  success: boolean,
  error?: string,
) {
  const sb = await db();
  await sb.from("push_deliveries").insert({
    subject_role: subject.role,
    subject_key: subject.key,
    token_id: tokenId,
    title: message.title,
    body: message.body ?? null,
    kind: message.kind ?? "generic",
    success,
    error: error ?? null,
  });
}

/** True when the subject's chosen frequency allows another alert right now. */
async function withinFrequencyBudget(subject: Subject, frequency: AlertFrequency) {
  const gap = FREQUENCY_MS[frequency];
  if (gap === 0) return true;
  const sb = await db();
  const { data } = await sb
    .from("notification_prefs")
    .select("last_alert_at")
    .eq("subject_role", subject.role)
    .eq("subject_key", subject.key)
    .maybeSingle();
  const last = data?.last_alert_at ? Date.parse(data.last_alert_at) : 0;
  return Date.now() - last >= gap;
}

async function touchLastAlert(subject: Subject) {
  const sb = await db();
  await sb
    .from("notification_prefs")
    .update({ last_alert_at: new Date().toISOString() })
    .eq("subject_role", subject.role)
    .eq("subject_key", subject.key);
}

export type SendResult = {
  sent: number;
  failed: number;
  skipped?: "disabled" | "throttled" | "no_devices" | "not_configured";
};

/**
 * Fans a message out to every live device of one subject.
 * `respectPrefs` is on for automated alerts and off for admin test sends.
 */
export async function sendToSubject(
  subject: Subject,
  message: PushMessage,
  opts: { respectPrefs?: boolean } = {},
): Promise<SendResult> {
  if (!pushConfigured()) return { sent: 0, failed: 0, skipped: "not_configured" };
  const respect = opts.respectPrefs ?? true;

  if (respect) {
    const prefs = await getPrefs(subject);
    if (!prefs.nearbyAlertsEnabled) return { sent: 0, failed: 0, skipped: "disabled" };
    if (!(await withinFrequencyBudget(subject, prefs.alertFrequency))) {
      return { sent: 0, failed: 0, skipped: "throttled" };
    }
  }

  const tokens = await activeTokens(subject);
  if (!tokens.length) return { sent: 0, failed: 0, skipped: "no_devices" };

  const sb = await db();
  let sent = 0;
  let failed = 0;

  for (const row of tokens) {
    const outcome = await sendToToken(row.token, message);
    if (outcome.ok) {
      sent++;
      await sb
        .from("device_tokens")
        .update({ last_seen_at: new Date().toISOString(), failure_count: 0 })
        .eq("id", row.id);
      await log(subject, row.id, message, true);
      continue;
    }
    failed++;
    // Dead tokens are retired immediately; transient errors just count up and
    // are pruned by the nightly cleanup once they pass the failure threshold.
    await sb
      .from("device_tokens")
      .update({
        failure_count: row.failure_count + 1,
        ...(outcome.retire ? { revoked_at: new Date().toISOString() } : {}),
      })
      .eq("id", row.id);
    await log(subject, row.id, message, false, outcome.error);
  }

  if (respect && sent > 0) await touchLastAlert(subject);
  return { sent, failed };
}

/** Every admin that has registered a device. */
export async function adminSubjects(): Promise<Subject[]> {
  const sb = await db();
  const { data } = await sb
    .from("device_tokens")
    .select("subject_key")
    .eq("subject_role", "admin")
    .is("revoked_at", null);
  const keys = [...new Set((data ?? []).map((r) => r.subject_key))];
  return keys.map((key) => ({ role: "admin" as const, key }));
}

/** Resolves the roster driver phone that operates a truck code. */
export function driverPhoneForTruck(truckCode: string): string | null {
  const idx = TRUCKS.findIndex((t) => t.id === truckCode);
  if (idx < 0) return null;
  return DRIVER_NAMES[idx]?.phone ?? null;
}