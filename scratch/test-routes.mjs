import http from "node:http";

const routes = [
  "/",
  "/role",
  "/driver",
  "/resident",
  "/resident/alerts",
  "/resident/booking",
  "/resident/notifications",
  "/resident/profile",
  "/resident/privacy",
  "/resident/schedule",
  "/admin",
  "/admin/map",
  "/admin/drivers",
  "/admin/assignments",
  "/admin/wards",
  "/admin/alerts",
  "/admin/bookings",
  "/admin/reports",
  "/privacy",
  "/devices",
  "/sitemap.xml"
];

async function checkRoute(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          path,
          status: res.statusCode,
          headers: res.headers,
          length: data.length,
          preview: data.slice(0, 150).replace(/\s+/g, " ")
        });
      });
    });
    req.on("error", (err) => {
      resolve({ path, error: err.message });
    });
  });
}

async function run() {
  console.log("Checking all routes on http://localhost:3000...\n");
  for (const r of routes) {
    const res = await checkRoute(r);
    if (res.error) {
      console.log(`❌ ${r}: ERROR - ${res.error}`);
    } else {
      const icon = res.status >= 200 && res.status < 400 ? "✅" : "⚠️";
      console.log(`${icon} ${r.padEnd(26)} -> Status: ${res.status} (${res.length} bytes)`);
    }
  }
}

run();
