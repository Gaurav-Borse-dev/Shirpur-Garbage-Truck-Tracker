import { eventHandler } from "h3";

export default eventHandler(async () => {
  let dbStatus = "up";
  let supabaseStatus = "up";

  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) {
      dbStatus = "unconfigured";
      supabaseStatus = "unconfigured";
    } else {
      const { supabaseAdmin } = await import("../../src/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("trucks").select("id").limit(1);
      if (error) {
        dbStatus = "degraded";
        supabaseStatus = "degraded";
      }
    }
  } catch {
    dbStatus = "degraded";
    supabaseStatus = "degraded";
  }

  return {
    success: true,
    service: "CleanTrack Backend",
    status: (dbStatus === "up" || dbStatus === "unconfigured") ? "healthy" : "degraded",
    services: {
      application: "up",
      database: dbStatus,
      supabase: supabaseStatus,
    },
    timestamp: new Date().toISOString(),
  };
});
