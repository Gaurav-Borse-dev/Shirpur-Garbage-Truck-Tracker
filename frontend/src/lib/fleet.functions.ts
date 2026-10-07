/**
 * Fleet management server functions — admin-only CRUD for drivers and truck assignments.
 *
 * These write to the Supabase `profiles`, `drivers`, and `trucks` tables so
 * changes made in the admin dashboard are visible to all users and devices.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addDriverInput = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\d{10}$/),
  licenseNo: z.string().min(1).max(40).default("N/A"),
  truckCode: z.string().min(1).max(20),
});

const updateDriverInput = z.object({
  driverId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  truckCode: z.string().min(1).max(20).optional(),
  active: z.boolean().optional(),
});

const removeDriverInput = z.object({
  driverId: z.string().uuid(),
});

const updateTruckInput = z.object({
  truckCode: z.string().min(1).max(20),
  ward: z.string().min(1).max(120),
});

async function requireAdmin() {
  const { getUser } = await import("./session.server");
  const user = await getUser();
  if (!user || user.role !== "admin") throw new Error("unauthorized");
  return user;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Add a new driver to the fleet.
 * Creates a Supabase Auth user (if needed), a `profiles` row, and a `drivers` row.
 */
export const addFleetDriver = createServerFn({ method: "POST" })
  .validator((data: unknown) => addDriverInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();

    // 1. Resolve truck UUID from truck_code
    const { data: truck } = await sb
      .from("trucks")
      .select("id")
      .eq("truck_code", data.truckCode)
      .maybeSingle();

    if (!truck) {
      return { ok: false as const, error: `Truck ${data.truckCode} not found in database` };
    }

    // 2. Check if truck is already assigned to another active driver
    const { data: existingAssignment } = await sb
      .from("drivers")
      .select("id")
      .eq("assigned_truck_id", truck.id)
      .eq("on_duty", true)
      .maybeSingle();

    // Allow assignment even if exists — admin is reassigning intentionally

    // 3. Check if a profile with this phone already exists
    const { data: existingProfile } = await sb
      .from("profiles")
      .select("user_id")
      .eq("phone", data.phone)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.user_id;
    } else {
      // 4. Create a Supabase Auth user for this phone
      const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
        phone: `+91${data.phone}`,
        phone_confirm: true,
        user_metadata: { full_name: data.name },
      });

      if (authErr || !authUser?.user) {
        // If user already exists in auth but not in profiles, try to find them
        const { data: existingAuthUsers } = await sb.auth.admin.listUsers();
        const found = existingAuthUsers?.users?.find(
          (u: { phone?: string }) => u.phone === `+91${data.phone}`,
        );
        if (found) {
          userId = found.id;
        } else {
          return {
            ok: false as const,
            error: `Failed to create auth user: ${authErr?.message ?? "unknown"}`,
          };
        }
      } else {
        userId = authUser.user.id;
      }

      // 5. Create profile
      await sb.from("profiles").upsert(
        {
          user_id: userId,
          full_name: data.name,
          phone: data.phone,
        },
        { onConflict: "user_id" },
      );
    }

    // 6. Check if driver row already exists for this user
    const { data: existingDriver } = await sb
      .from("drivers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingDriver) {
      // Update the existing driver row
      await sb
        .from("drivers")
        .update({
          assigned_truck_id: truck.id,
          license_no: data.licenseNo,
        })
        .eq("id", existingDriver.id);

      return { ok: true as const, driverId: existingDriver.id, action: "updated" };
    }

    // 7. Create driver row
    const { data: newDriver, error: driverErr } = await sb
      .from("drivers")
      .insert({
        user_id: userId,
        license_no: data.licenseNo,
        assigned_truck_id: truck.id,
      })
      .select("id")
      .single();

    if (driverErr || !newDriver) {
      return {
        ok: false as const,
        error: `Failed to create driver: ${driverErr?.message ?? "unknown"}`,
      };
    }

    // 8. Assign role
    await sb
      .from("user_roles")
      .upsert({ user_id: userId, role: "driver" as const }, { onConflict: "user_id" });

    return { ok: true as const, driverId: newDriver.id, action: "created" };
  });

/**
 * Update an existing driver's name, phone, truck assignment, or active status.
 */
export const updateFleetDriver = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateDriverInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();

    // Get current driver
    const { data: driver } = await sb
      .from("drivers")
      .select("id, user_id, assigned_truck_id")
      .eq("id", data.driverId)
      .single();

    if (!driver) return { ok: false as const, error: "Driver not found" };

    // Update profile if name or phone changed
    if (data.name || data.phone) {
      const profilePatch: { full_name?: string; phone?: string } = {};
      if (data.name) profilePatch.full_name = data.name;
      if (data.phone) profilePatch.phone = data.phone;
      await sb.from("profiles").update(profilePatch).eq("user_id", driver.user_id);
    }

    // Update truck assignment if changed
    if (data.truckCode) {
      const { data: truck } = await sb
        .from("trucks")
        .select("id")
        .eq("truck_code", data.truckCode)
        .maybeSingle();

      if (!truck) return { ok: false as const, error: `Truck ${data.truckCode} not found` };
      await sb.from("drivers").update({ assigned_truck_id: truck.id }).eq("id", data.driverId);
    }

    // Update active/duty status
    if (data.active !== undefined) {
      await sb.from("drivers").update({ on_duty: data.active }).eq("id", data.driverId);
    }

    return { ok: true as const };
  });

/**
 * Remove a driver from the fleet (deletes the driver row; profile stays for audit).
 */
export const removeFleetDriver = createServerFn({ method: "POST" })
  .validator((data: unknown) => removeDriverInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();

    const { error } = await sb.from("drivers").delete().eq("id", data.driverId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/**
 * Remove a driver by phone number — used when the client doesn't have the driver's dbId
 * (e.g. seed/phantom drivers from localStorage).
 */
export const removeFleetDriverByPhone = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ phone: z.string().regex(/^\d{10}$/) }).parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();

    // Find profile by phone
    const { data: profile } = await sb
      .from("profiles")
      .select("user_id")
      .eq("phone", data.phone)
      .maybeSingle();

    if (!profile) return { ok: false as const, error: "No driver found with this phone" };

    // Delete driver row linked to this user
    const { error } = await sb.from("drivers").delete().eq("user_id", profile.user_id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/**
 * Update a truck's ward assignment in the database.
 * The change propagates to all users via the realtime subscription on the trucks table.
 */
export const updateTruckAssignment = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateTruckInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();

    const { error } = await sb
      .from("trucks")
      .update({ ward: data.ward })
      .eq("truck_code", data.truckCode);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/* ── Ward management ─────────────────────────────────────────────────── */

const addWardInput = z.object({
  name: z.string().min(1).max(120).trim(),
});

const removeWardInput = z.object({
  wardId: z.string().uuid(),
});

/**
 * Fetch every ward from the `wards` table.
 */
export const getWards = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { admin } = await import("./tracking.server");
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("wards")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (error) return { wards: null, error: error.message };
    return { wards: rows ?? [], error: null };
  } catch (err) {
    console.error("[wards] fetch failed", err);
    return { wards: null, error: "unavailable" };
  }
});

/**
 * Add a new ward (admin-only).
 */
export const addWard = createServerFn({ method: "POST" })
  .validator((data: unknown) => addWardInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();

    const { data: row, error } = await sb
      .from("wards")
      .insert({ name: data.name })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false as const, error: "A ward with this name already exists" };
      }
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, wardId: row.id };
  });

/**
 * Remove a ward (admin-only).
 * If any trucks are assigned to this ward, they will be cleanly unassigned.
 */
export const removeWard = createServerFn({ method: "POST" })
  .validator((data: unknown) => removeWardInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();

    // Look up ward name first
    const { data: ward } = await sb.from("wards").select("id, name").eq("id", data.wardId).single();

    if (!ward) return { ok: false as const, error: "Ward not found" };

    // Unassign any trucks that were assigned to this ward
    await sb.from("trucks").update({ ward: null }).eq("ward", ward.name);

    // Delete the ward
    const { error } = await sb.from("wards").delete().eq("id", data.wardId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/**
 * Clear all drivers from the database (admin-only).
 */
export const clearAllDrivers = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const sb = await db();

  const { error } = await sb
    .from("drivers")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
});

const setDutyInput = z.object({
  truckCode: z.string().min(1).max(20),
  online: z.boolean(),
});

/**
 * Called when a driver toggles the online/offline switch.
 * Sets `on_duty` + `duty_state` in the DB so admin panel shows correct status.
 * Also updates the `trucks` table status to `collecting` or `offline`.
 * Does NOT require admin — driver session is verified via session cookie.
 */
export const setDriverDuty = createServerFn({ method: "POST" })
  .validator((data: unknown) => setDutyInput.parse(data))
  .handler(async ({ data }) => {
    const { getUser } = await import("./session.server");
    const { admin } = await import("./tracking.server");

    const user = await getUser();
    if (!user || (user.role !== "driver" && user.role !== "admin")) {
      return { ok: false as const, error: "unauthorized" };
    }

    const sb = await admin();

    // Resolve truck UUID
    const { data: truck } = await sb
      .from("trucks")
      .select("id")
      .eq("truck_code", data.truckCode)
      .maybeSingle();

    if (!truck) return { ok: false as const, error: `Truck ${data.truckCode} not found` };

    // Update truck status
    const truckStatus = data.online ? "collecting" : "offline";
    await sb
      .from("trucks")
      .update({ status: truckStatus })
      .eq("id", truck.id);

    // Update driver on_duty in the drivers table
    const dutyState = data.online ? "on_duty" : "offline";
    let updatedDriver = false;
    if (user.phone) {
      const cleanPhone = user.phone.trim().replace(/\D/g, "").slice(-10);
      const { data: profile } = await sb
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${cleanPhone},phone.eq.91${cleanPhone},phone.eq.+91${cleanPhone}`)
        .maybeSingle();

      if (profile?.user_id) {
        await sb
          .from("drivers")
          .update({
            on_duty: data.online,
            duty_state: dutyState,
            ...(data.online ? { duty_started_at: new Date().toISOString() } : {}),
          })
          .eq("user_id", profile.user_id);
        updatedDriver = true;
      }
    }

    if (!updatedDriver) {
      await sb
        .from("drivers")
        .update({
          on_duty: data.online,
          duty_state: dutyState,
          ...(data.online ? { duty_started_at: new Date().toISOString() } : {}),
        })
        .eq("assigned_truck_id", truck.id);
    }

    return { ok: true as const };
  });
