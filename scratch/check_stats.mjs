import { createClient } from "@supabase/supabase-js";

const url = "https://bqmqnzkmhmuuszwsonds.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbXFuemttaG11dXN6d3NvbmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg5OTk2OCwiZXhwIjoyMTAyNDc1OTY4fQ.tAA0BokNfcy-aiWzQg0ELvVbpVQJqLOckixSWvsMmdc";
const supabase = createClient(url, key);

async function check() {
  const { data: trucks } = await supabase.from("trucks").select("*");
  console.log("=== TRUCKS ===");
  console.log(JSON.stringify(trucks, null, 2));

  const { data: wards } = await supabase.from("wards").select("*");
  console.log("=== WARDS ===");
  console.log(JSON.stringify(wards, null, 2));

  const { data: locs } = await supabase.from("truck_live_location").select("*");
  console.log("=== TRUCK LIVE LOCATIONS ===");
  console.log(JSON.stringify(locs, null, 2));

  const { data: drivers } = await supabase.from("drivers").select("*");
  console.log("=== DRIVERS ===");
  console.log(JSON.stringify(drivers, null, 2));

  const { data: routes } = await supabase.from("routes").select("*");
  console.log("=== ROUTES ===");
  console.log(JSON.stringify(routes, null, 2));
}

check().catch(console.error);
