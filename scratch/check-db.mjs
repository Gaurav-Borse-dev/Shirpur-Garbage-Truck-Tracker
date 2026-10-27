import { createClient } from "./backend/node_modules/@supabase/supabase-js/dist/index.js";
import { resolve } from "node:path";

if (process.loadEnvFile) process.loadEnvFile("backend/.env");

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await sb.from("trucks").select("truck_number");
  console.log("trucks select truck_number error:", error?.message);

  const { data: validData, error: validError } = await sb.from("trucks").select("truck_code, ward, status");
  console.log("trucks select valid columns:", validData?.length, "rows, error:", validError?.message);

  const { data: liveData, error: liveError } = await sb.from("truck_live_location").select("*");
  console.log("truck_live_location rows:", liveData?.length, "error:", liveError?.message);
}

test();
