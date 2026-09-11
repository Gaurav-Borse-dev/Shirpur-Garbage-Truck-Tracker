import { createServerFn } from "@tanstack/react-start";
import {
  prefsInput,
  recentDeliveriesInput,
  registerTokenInput,
  revokeTokenIdInput,
  revokeTokenInput,
  selfTestInput,
  testPushInput,
} from "./push-schemas";

/** Reads the caller's notification preferences from the encrypted session cookie. */
export const getNotificationPrefs = createServerFn({ method: "GET" }).handler(async () => {
  const { getUser } = await import("./session.server");
  const { getPrefs, DEFAULT_PREFS } = await import("./push.server");
  const { pushConfigured } = await import("./fcm.server");

  const user = await getUser();
  if (!user) return { ok: false as const, prefs: DEFAULT_PREFS, pushReady: false, devices: 0 };

  const subject = { role: user.role, key: user.phone ?? user.username ?? "" };
  const prefs = await getPrefs(subject);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("device_tokens")
    .select("id", { count: "exact", head: true })
    .eq("subject_role", subject.role)
    .eq("subject_key", subject.key)
    .is("revoked_at", null);

  return { ok: true as const, prefs, pushReady: pushConfigured(), devices: count ?? 0 };
});

export const saveNotificationPrefs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => prefsInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { savePrefs } = await import("./push.server");
    const user = await getUser();
    if (!user) return { ok: false as const };
    const subject = { role: user.role, key: user.phone ?? user.username ?? "" };
    await savePrefs(subject, data);
    return { ok: true as const, prefs: data };
  });

/** Stores an FCM registration token against the signed-in subject. */
export const registerDeviceToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerTokenInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { registerToken } = await import("./push.server");
    const user = await getUser();
    if (!user) return { ok: false as const };
    const subject = { role: user.role, key: user.phone ?? user.username ?? "" };
    const ok = await registerToken(subject, data.token, data.platform, data.userAgent);
    return { ok };
  });

/** Revokes one device token, or every device of the caller when none is given. */
export const revokeDeviceToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => revokeTokenInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { revokeToken, revokeAllTokens } = await import("./push.server");
    const user = await getUser();
    if (!user) return { ok: false as const };
    if (data.token) await revokeToken(data.token);
    else await revokeAllTokens({ role: user.role, key: user.phone ?? user.username ?? "" });
    return { ok: true as const };
  });

/** Admin-only: fires a real push at one resident or at a truck's crew. */
export const sendTestPush = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => testPushInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { sendToSubject, driverPhoneForTruck } = await import("./push.server");

    const user = await getUser();
    if (!user || user.role !== "admin") return { ok: false as const, reason: "unauthorized" };

    const message = {
      title: data.title,
      ...(data.body ? { body: data.body } : {}),
      kind: "generic",
      link: data.target.kind === "resident" ? "/resident/alerts" : "/driver",
    };

    if (data.target.kind === "resident") {
      const result = await sendToSubject({ role: "resident", key: data.target.phone }, message, {
        respectPrefs: false,
      });
      return { ok: true as const, targets: 1, ...result };
    }

    const phone = await driverPhoneForTruck(data.target.truckCode);
    if (!phone) return { ok: false as const, reason: "unknown_truck" };
    const result = await sendToSubject({ role: "driver", key: phone }, message, {
      respectPrefs: false,
    });
    return { ok: true as const, targets: 1, ...result };
  });
/** Lists this account's registered devices (token values are never returned). */
export const listMyDevices = createServerFn({ method: "GET" }).handler(async () => {
  const { getUser } = await import("./session.server");
  const { listTokens } = await import("./push.server");
  const user = await getUser();
  if (!user) return { ok: false as const, devices: [] };
  const devices = await listTokens({ role: user.role, key: user.phone ?? user.username ?? "" });
  return { ok: true as const, devices };
});

/** Removes one registered device from this account. */
export const removeMyDevice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => revokeTokenIdInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { revokeTokenById } = await import("./push.server");
    const user = await getUser();
    if (!user) return { ok: false as const };
    const ok = await revokeTokenById(
      { role: user.role, key: user.phone ?? user.username ?? "" },
      data.id,
    );
    return { ok };
  });

/** Deliveries since a timestamp, replayed as in-app toasts while the app is open. */
export const getRecentDeliveries = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => recentDeliveriesInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { recentDeliveries } = await import("./push.server");
    const user = await getUser();
    if (!user) return { ok: false as const, items: [] };
    const items = await recentDeliveries(
      { role: user.role, key: user.phone ?? user.username ?? "" },
      data.since,
    );
    return { ok: true as const, items };
  });

/** Sends a real nearby-truck style push to the caller's own devices. */
export const sendSelfTestPush = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => selfTestInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { sendToSubject } = await import("./push.server");
    const user = await getUser();
    if (!user) return { ok: false as const, reason: "unauthorized" as const };

    const truck = data.truckCode ? ` ${data.truckCode}` : "";
    const result = await sendToSubject(
      { role: user.role, key: user.phone ?? user.username ?? "" },
      {
        title: "Truck nearby",
        body: `Test alert: garbage truck${truck} is approaching your area.`,
        kind: "truck_nearby",
        link: "/resident",
      },
      { respectPrefs: false },
    );
    return { ok: true as const, ...result };
  });
