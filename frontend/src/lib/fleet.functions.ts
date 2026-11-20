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
  phone: z.string().min(10).max(15),
  licenseNo: z.string().min(1).max(40).default("N/A"),
  truckCode: z.string().min(1).max(20),
});

const updateDriverInput = z.object({
  driverId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
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
  if (!user || user.role !== "admin") {
    throw new Error("Admin session expired. Please sign out and sign in again with 9999999999.");
  }
  return user;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const KNOWN_TRUCK_IDS: Record<string, string> = {
  "GBR-01": "a12a7089-f41f-4c08-bce8-0b65a69a460a",
  "GBR-02": "48744cf0-9938-4f3a-a947-98a51c6f6905",
  "GBR-03": "a8e603a5-187f-42d1-aa5e-30cfc6236ef7",
  "GBR-04": "1edb9d6a-32ff-4d88-8280-3f88adab92f5",
  "GBR-05": "31cfd891-f344-43ef-a163-4a9edebb2656",
  "GBR-06": "aea06034-1113-4363-a59b-2e65f4fe3495",
  "GBR-07": "5ad6aab3-6e40-47a4-ba2c-e60d248a6029",
  "GBR-08": "10f5cfeb-13da-4161-924d-e84daa5dcec0",
  "GBR-09": "99e862b1-07ae-4d10-8df6-bb20286ad667",
  "GBR-10": "c7eb378b-45ad-46fc-8f12-fec8e119349a",
  "GBR-11": "1aba2dc2-fd71-48cd-aeff-d46732ba7830",
  "GBR-12": "e7056d3a-52b0-4b79-badf-6cc9698940aa",
  "GBR-13": "bfb3777f-3be0-4909-9760-e00efe9a86b4",
  "GBR-14": "2708ec0c-1a8a-414d-8421-77a53961b79e",
  "GBR-15": "577d73be-af9c-4fba-93d2-a71067102e1c",
  "GBR-16": "8a7789b4-59fa-4112-9b0c-a750f8bc91fd",
};

/**
 * Add a new driver to the fleet.
 * Resolves or auto-creates the truck, creates the profile, and links the driver record.
 */
export const addFleetDriver = createServerFn({ method: "POST" })
  .validator((data: unknown) => addDriverInput.parse(data))
  .handler(async ({ data }) => {
    try {
      await requireAdmin();
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Admin authorization required" };
    }

    try {
      const sb = await db();
      const cleanPhone = data.phone.trim().replace(/\D/g, "").slice(-10);

      // 1. Resolve truck UUID from static known map or query DB
      let truckId: string = KNOWN_TRUCK_IDS[data.truckCode] || "";
      if (!truckId) {
        const { data: truck } = await sb
          .from("trucks")
          .select("id")
          .eq("truck_code", data.truckCode)
          .maybeSingle();

        if (truck?.id) {
          truckId = truck.id;
        } else {
          // Auto-create truck so driver creation never fails because truck is unseeded
          const { data: newTruck } = await sb
            .from("trucks")
            .insert({
              truck_code: data.truckCode,
              registration_no: `MH18-${data.truckCode}`,
              capacity_kg: 5000,
              status: "offline",
            })
            .select("id")
            .maybeSingle();

          truckId = newTruck?.id || "";
        }
      }

      // 2. Check if a profile with this phone already exists
      const { data: existingProfile } = await sb
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${cleanPhone},phone.eq.91${cleanPhone},phone.eq.+91${cleanPhone}`)
        .maybeSingle();

      let userId = existingProfile?.user_id;

      if (!userId) {
        // Generate a clean UUID for this driver (no Supabase Auth user needed)
        userId = crypto.randomUUID();
        console.log(`[fleet] Creating new driver profile: userId=${userId}, phone=${cleanPhone}`);

        // Create profile via direct REST call as a fallback if SDK fails
        let profileCreated = false;

        // Attempt 1: Use Supabase SDK
        try {
          const { error: profileErr } = await sb.from("profiles").upsert(
            {
              user_id: userId,
              full_name: data.name.trim(),
              phone: cleanPhone,
            },
            { onConflict: "user_id" },
          );

          if (profileErr) {
            console.error("[fleet] SDK profile upsert error:", profileErr.message);
          } else {
            profileCreated = true;
          }
        } catch (sdkErr: any) {
          console.error("[fleet] SDK profile upsert threw:", sdkErr?.message);
        }

        // Attempt 2: Direct REST API fallback if SDK failed
        if (!profileCreated) {
          console.log("[fleet] Trying direct REST API for profile creation...");
          try {
            const SUPABASE_URL =
              process.env.VITE_SUPABASE_URL ||
              process.env.SUPABASE_URL ||
              "https://bqmqnzkmhmuuszwsonds.supabase.co";
            const SERVICE_KEY =
              (process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith("eyJ")
                ? process.env.SUPABASE_SERVICE_ROLE_KEY
                : "") ||
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbXFuemttaG11dXN6d3NvbmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg5OTk2OCwiZXhwIjoyMTAyNDc1OTY4fQ.tAA0BokNfcy-aiWzQg0ELvVbpVQJqLOckixSWvsMmdc";

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12_000);
            const res = await fetch(
              `${SUPABASE_URL}/rest/v1/profiles`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: SERVICE_KEY,
                  Authorization: `Bearer ${SERVICE_KEY}`,
                  Prefer: "resolution=merge-duplicates",
                },
                body: JSON.stringify({
                  user_id: userId,
                  full_name: data.name.trim(),
                  phone: cleanPhone,
                }),
                signal: controller.signal,
              },
            );
            clearTimeout(timer);

            if (res.ok || res.status === 201 || res.status === 200) {
              profileCreated = true;
              console.log("[fleet] Direct REST profile creation succeeded");
            } else {
              const body = await res.text();
              console.error("[fleet] Direct REST profile creation failed:", res.status, body);
            }
          } catch (restErr: any) {
            console.error("[fleet] Direct REST profile creation threw:", restErr?.message);
          }
        }

        if (!profileCreated) {
          return {
            ok: false as const,
            error: "Failed to create driver profile after multiple attempts. Please try again.",
          };
        }
      } else {
        // Update existing profile's name and ensure phone format
        await sb
          .from("profiles")
          .update({ full_name: data.name, phone: cleanPhone })
          .eq("user_id", userId);
      }

      // 3. Check if driver row already exists for this user
      const { data: existingDriver } = await sb
        .from("drivers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingDriver) {
        // Update the existing driver row
        const { error: updateErr } = await sb
          .from("drivers")
          .update({
            assigned_truck_id: truckId,
            license_no: data.licenseNo || "N/A",
          })
          .eq("id", existingDriver.id);

        if (updateErr) {
          return { ok: false as const, error: `Failed to update driver: ${updateErr.message}` };
        }

        // Ensure user_roles has driver role (note: UNIQUE constraint is on user_id, role)
        await sb
          .from("user_roles")
          .upsert({ user_id: userId, role: "driver" as const }, { onConflict: "user_id,role" });

        return { ok: true as const, driverId: existingDriver.id, action: "updated" };
      }

      // 4. Create new driver row
      const { data: newDriver, error: driverErr } = await sb
        .from("drivers")
        .insert({
          user_id: userId,
          license_no: data.licenseNo || "N/A",
          assigned_truck_id: truckId,
        })
        .select("id")
        .single();

      if (driverErr || !newDriver) {
        return {
          ok: false as const,
          error: `Failed to create driver record: ${driverErr?.message ?? "unknown error"}`,
        };
      }

      // 5. Assign driver role (note: UNIQUE constraint is user_id, role)
      await sb
        .from("user_roles")
        .upsert({ user_id: userId, role: "driver" as const }, { onConflict: "user_id,role" });

      return { ok: true as const, driverId: newDriver.id, action: "created" };
    } catch (err: any) {
      console.error("[fleet] addFleetDriver error", err);
      return { ok: false as const, error: err?.message ?? "Internal error adding driver" };
    }
  });

/**
 * Update an existing driver's name, phone, truck assignment, or active status.
 */
export const updateFleetDriver = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateDriverInput.parse(data))
  .handler(async ({ data }) => {
    try {
      await requireAdmin();
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Admin authorization required" };
    }

    try {
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
        let truckId: string;
        let { data: truck } = await sb
          .from("trucks")
          .select("id")
          .eq("truck_code", data.truckCode)
          .maybeSingle();

        if (!truck) {
          const { data: newTruck } = await sb
            .from("trucks")
            .insert({
              truck_code: data.truckCode,
              registration_no: `MH18-${data.truckCode}`,
              capacity_kg: 5000,
              status: "offline",
            })
            .select("id")
            .single();
          if (!newTruck) return { ok: false as const, error: `Truck ${data.truckCode} not found` };
          truckId = newTruck.id;
        } else {
          truckId = truck.id;
        }

        await sb.from("drivers").update({ assigned_truck_id: truckId }).eq("id", data.driverId);
      }

      // Update active/duty status
      if (data.active !== undefined) {
        await sb.from("drivers").update({ on_duty: data.active }).eq("id", data.driverId);
      }

      return { ok: true as const };
    } catch (err: any) {
      console.error("[fleet] updateFleetDriver error", err);
      return { ok: false as const, error: err?.message ?? "Failed to update driver" };
    }
  });

/**
 * Remove a driver from the fleet (deletes the driver row; profile stays for audit).
 */
export const removeFleetDriver = createServerFn({ method: "POST" })
  .validator((data: unknown) => removeDriverInput.parse(data))
  .handler(async ({ data }) => {
    try {
      await requireAdmin();
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Admin authorization required" };
    }

    try {
      const sb = await db();
      const { error } = await sb.from("drivers").delete().eq("id", data.driverId);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    } catch (err: any) {
      return { ok: false as const, error: err?.message ?? "Failed to remove driver" };
    }
  });

/**
 * Remove a driver by phone number — used when the client doesn't have the driver's dbId
 * (e.g. seed/phantom drivers from localStorage).
 */
export const removeFleetDriverByPhone = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ phone: z.string().regex(/^\d{10}$/) }).parse(data))
  .handler(async ({ data }) => {
    try {
      await requireAdmin();
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Admin authorization required" };
    }

    try {
      const sb = await db();
      const clean = data.phone.trim().replace(/\D/g, "").slice(-10);

      // Find profile by phone
      const { data: profile } = await sb
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${clean},phone.eq.91${clean},phone.eq.+91${clean}`)
        .maybeSingle();

      if (!profile) return { ok: false as const, error: "No driver found with this phone" };

      // Delete driver row linked to this user
      const { error } = await sb.from("drivers").delete().eq("user_id", profile.user_id);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    } catch (err: any) {
      return { ok: false as const, error: err?.message ?? "Failed to remove driver" };
    }
  });

/**
 * Update a truck's ward assignment in the database.
 * The change propagates to all users via the realtime subscription on the trucks table.
 */
export const updateTruckAssignment = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateTruckInput.parse(data))
  .handler(async ({ data }) => {
    try {
      await requireAdmin();
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Admin authorization required" };
    }

    try {
      const sb = await db();
      const { error } = await sb
        .from("trucks")
        .update({ ward: data.ward })
        .eq("truck_code", data.truckCode);

      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    } catch (err: any) {
      return { ok: false as const, error: err?.message ?? "Failed to update truck" };
    }
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
    try {
      await requireAdmin();
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Admin authorization required" };
    }

    try {
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
    } catch (err: any) {
      return { ok: false as const, error: err?.message ?? "Failed to add ward" };
    }
  });

/**
 * Remove a ward (admin-only).
 * If any trucks are assigned to this ward, they will be cleanly unassigned.
 */
export const removeWard = createServerFn({ method: "POST" })
  .validator((data: unknown) => removeWardInput.parse(data))
  .handler(async ({ data }) => {
    try {
      await requireAdmin();
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Admin authorization required" };
    }

    try {
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
    } catch (err: any) {
      return { ok: false as const, error: err?.message ?? "Failed to remove ward" };
    }
  });

/**
 * Clear all drivers from the database (admin-only).
 */
export const clearAllDrivers = createServerFn({ method: "POST" }).handler(async () => {
  try {
    await requireAdmin();
  } catch (err: any) {
    return { ok: false as const, error: err?.message || "Admin authorization required" };
  }

  try {
    const sb = await db();

    const { error } = await sb
      .from("drivers")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  } catch (err: any) {
    return { ok: false as const, error: err?.message ?? "Failed to clear drivers" };
  }
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
