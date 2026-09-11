/**
 * Alerts & activity log server functions — real data from the database.
 *
 * Replaces the fake seedEvents() / getAlertHistory() mock data with
 * queries against `notifications`, `collection_history`, and `audit_logs`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const adminAlertsInput = z.object({
  type: z.enum(["all", "geofence", "stop", "login"]).optional(),
  limit: z.number().min(1).max(200).optional(),
}).optional();

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AlertEvent = {
  id: string;
  type: "geofence" | "stop" | "login";
  truckId: string;
  truckLabel: string;
  wardLabel: string;
  driverName: string;
  stopNum: number;
  totalStops: number;
  ts: string;
};

/**
 * Admin: fetch real system events from the last 7 days.
 * Merges data from notifications (geofence), collection_history (stops),
 * and audit_logs (logins) into a unified chronological list.
 */
export const getAdminAlerts = createServerFn({ method: "POST" })
  .validator((data: unknown) => (adminAlertsInput ?? z.object({})).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const user = await getUser();
    if (!user || user.role !== "admin") return { ok: false as const, events: [] };

    const sb = await db();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const limit = (data as { limit?: number } | undefined)?.limit ?? 100;
    const typeFilter = (data as { type?: string } | undefined)?.type ?? "all";
    const events: AlertEvent[] = [];

    // 1. Geofence / truck-nearby notifications
    // Using the actual notification_type enum values from the database schema
    if (typeFilter === "all" || typeFilter === "geofence") {
      const { data: notifs } = await sb
        .from("notifications")
        .select(`
          id, type, title, body, sent_at,
          truck:trucks!notifications_truck_id_fkey ( truck_code, ward )
        `)
        .gte("sent_at", since)
        .eq("type", "truck_nearby")
        .order("sent_at", { ascending: false })
        .limit(limit);

      for (const n of notifs ?? []) {
        const truck = n.truck as { truck_code: string; ward: string | null } | null;
        events.push({
          id: `notif-${n.id}`,
          type: "geofence",
          truckId: truck?.truck_code ?? "—",
          truckLabel: truck?.truck_code ?? "—",
          wardLabel: truck?.ward?.split("—")[0]?.trim() ?? "Shirpur",
          driverName: "",
          stopNum: 0,
          totalStops: 0,
          ts: formatTs(n.sent_at),
        });
      }
    }

    // 2. Stop completions from collection_history
    if (typeFilter === "all" || typeFilter === "stop") {
      const { data: stops } = await sb
        .from("collection_history")
        .select(`
          id, completed_at, status, notes,
          truck:trucks!collection_history_truck_id_fkey ( truck_code, ward ),
          driver:drivers!collection_history_driver_id_fkey ( id, user_id )
        `)
        .gte("completed_at", since)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(limit);

      for (const s of stops ?? []) {
        const truck = s.truck as { truck_code: string; ward: string | null } | null;
        events.push({
          id: `stop-${s.id}`,
          type: "stop",
          truckId: truck?.truck_code ?? "—",
          truckLabel: truck?.truck_code ?? "—",
          wardLabel: truck?.ward?.split("—")[0]?.trim() ?? "Shirpur",
          driverName: "",
          stopNum: 0,
          totalStops: 0,
          ts: formatTs(s.completed_at),
        });
      }
    }

    // 3. Driver logins from audit_logs
    if (typeFilter === "all" || typeFilter === "login") {
      const { data: logins } = await sb
        .from("audit_logs")
        .select("id, action, entity, entity_id, metadata, created_at")
        .gte("created_at", since)
        .eq("action", "driver_login")
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const l of logins ?? []) {
        const meta = l.metadata as Record<string, string> | null;
        events.push({
          id: `login-${l.id}`,
          type: "login",
          truckId: meta?.truck_code ?? "—",
          truckLabel: meta?.truck_code ?? "—",
          wardLabel: meta?.ward ?? "Shirpur",
          driverName: meta?.driver_name ?? "Driver",
          stopNum: 0,
          totalStops: 0,
          ts: formatTs(l.created_at),
        });
      }
    }

    // Sort all events by timestamp (most recent first)
    events.sort((a, b) => (b.ts > a.ts ? 1 : -1));

    return { ok: true as const, events: events.slice(0, limit) };
  });

/**
 * Resident: fetch their personal alert history from the notifications table.
 */
export const getResidentAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const { getUser } = await import("./session.server");
  const user = await getUser();
  if (!user || !user.phone) return { ok: false as const, alerts: [] };

  const sb = await db();

  // Find the user's profile to get their user_id for the notifications query
  const { data: profile } = await sb
    .from("profiles")
    .select("user_id")
    .eq("phone", user.phone)
    .maybeSingle();

  if (!profile) {
    // No profile — return empty (new resident who hasn't been notified yet)
    return { ok: true as const, alerts: [] };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();

  const { data: notifs } = await sb
    .from("notifications")
    .select(`
      id, type, title, body, sent_at, read,
      truck:trucks!notifications_truck_id_fkey ( truck_code )
    `)
    .eq("recipient_id", profile.user_id)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(50);

  const alerts = (notifs ?? []).map((n) => {
    const truck = n.truck as { truck_code: string } | null;
    // Map notification_type enum values to UI tones
    const nType = n.type as string;
    const tone: "success" | "warn" | "info" =
      nType === "truck_nearby" || nType === "truck_arrived" ? "info" :
      nType === "route_completed" ? "success" :
      nType === "emergency" ? "warn" :
      "info";

    return {
      id: n.id,
      title: n.title,
      subtitle: n.body + (truck?.truck_code ? ` · ${truck.truck_code}` : ""),
      tone,
      ago: formatAgo(n.sent_at),
      read: n.read,
    };
  });

  return { ok: true as const, alerts };
});

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
