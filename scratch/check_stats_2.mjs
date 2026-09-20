import { createClient } from "@supabase/supabase-js";

const url = "https://bqmqnzkmhmuuszwsonds.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbXFuemttaG11dXN6d3NvbmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg5OTk2OCwiZXhwIjoyMTAyNDc1OTY4fQ.tAA0BokNfcy-aiWzQg0ELvVbpVQJqLOckixSWvsMmdc";
const supabase = createClient(url, key);

async function check() {
  const { data: trucks, count: truckCount } = await supabase.from("trucks").select("*", { count: "exact" });
  console.log("Total trucks:", truckCount);
  trucks?.forEach(t => console.log(`Truck ${t.truck_code} (${t.registration_no}) - Ward: ${t.ward} - Status: ${t.status}`));

  const { data: profiles, count: profileCount } = await supabase.from("profiles").select("*", { count: "exact" });
  console.log("\nTotal profiles / registered people:", profileCount);
  profiles?.forEach(p => console.log(`Profile: ${p.full_name || p.phone} | Phone: ${p.phone} | Role: ${p.role}`));

  const { data: wards, count: wardCount } = await supabase.from("wards").select("*", { count: "exact" });
  console.log("\nTotal Wards:", wardCount);
  wards?.forEach(w => console.log(`Ward: ${w.name}`));
}

check().catch(console.error);
