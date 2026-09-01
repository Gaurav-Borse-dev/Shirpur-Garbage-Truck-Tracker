/**
 * Booking server functions — CRUD for dustbin booking requests.
 *
 * Residents create bookings; admins list all and approve/reject.
 * All data is stored in the `dustbin_bookings` Supabase table.
 *
 * NOTE: The `dustbin_bookings` table is added via migration but its types
 * haven't been regenerated yet. We use `any` casts on `.from()` calls until
 * `npx supabase gen types` is run against the live database.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const createInput = z.object({
  address: z.string().min(5).max(200),
  reason: z.string().min(5).max(300),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const decideInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  note: z.string().max(300).optional(),
});

const listInput = z.object({
  status: z.enum(["all", "pending", "approved", "rejected"]).optional(),
}).optional();

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Helper — access the dustbin_bookings table (not yet in generated types). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bookingsTable(sb: Awaited<ReturnType<typeof db>>) {
  return (sb as any).from("dustbin_bookings");
}

/** Resident creates a new dustbin booking request. */
export const createBooking = createServerFn({ method: "POST" })
  .validator((data: unknown) => createInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const user = await getUser();
    if (!user || !user.phone) return { ok: false as const, error: "Sign in to submit a booking." };

    if (data.fromDate > data.toDate) {
      return { ok: false as const, error: "From date must be before To date." };
    }

    const sb = await db();
    const { data: row, error } = await bookingsTable(sb)
      .insert({
        resident_phone: user.phone,
        city: "Shirpur",
        address: data.address,
        reason: data.reason,
        from_date: data.fromDate,
        to_date: data.toDate,
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      console.error("[booking] insert failed", error.message);
      return { ok: false as const, error: "Could not submit booking. Please try again." };
    }

    return { ok: true as const, booking: row };
  });

/** Resident fetches their own bookings. */
export const getMyBookings = createServerFn({ method: "GET" }).handler(async () => {
  const { getUser } = await import("./session.server");
  const user = await getUser();
  if (!user || !user.phone) return { ok: false as const, bookings: [] };

  const sb = await db();
  const { data: rows } = await bookingsTable(sb)
    .select("*")
    .eq("resident_phone", user.phone)
    .order("created_at", { ascending: false });

  return {
    ok: true as const,
    bookings: (rows ?? []).map(mapBookingRow),
  };
});

/** Admin fetches all bookings, optionally filtered by status. */
export const getAllBookings = createServerFn({ method: "POST" })
  .validator((data: unknown) => (listInput ?? z.object({})).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const user = await getUser();
    if (!user || user.role !== "admin") return { ok: false as const, bookings: [] };

    const sb = await db();
    let query = bookingsTable(sb).select("*").order("created_at", { ascending: false });

    const status = (data as { status?: string } | undefined)?.status;
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: rows } = await query;
    return {
      ok: true as const,
      bookings: (rows ?? []).map(mapBookingRow),
    };
  });

/** Admin approves or rejects a booking. */
export const decideBooking = createServerFn({ method: "POST" })
  .validator((data: unknown) => decideInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const user = await getUser();
    if (!user || user.role !== "admin") return { ok: false as const, error: "unauthorized" };

    const sb = await db();
    const { error } = await bookingsTable(sb)
      .update({
        status: data.status,
        admin_note: data.note ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (error) {
      console.error("[booking] decide failed", error.message);
      return { ok: false as const, error: "Could not update booking." };
    }

    return { ok: true as const };
  });

/** Maps a DB row to the shape the frontend expects. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBookingRow(r: any) {
  return {
    id: r.id as string,
    residentPhone: r.resident_phone as string,
    city: r.city as string,
    address: r.address as string,
    reason: r.reason as string,
    fromDate: r.from_date as string,
    toDate: r.to_date as string,
    status: r.status as "pending" | "approved" | "rejected",
    adminNote: (r.admin_note as string) ?? undefined,
    decidedAt: (r.decided_at as string) ?? undefined,
    createdAt: Date.parse(r.created_at as string),
  };
}
