import http from "node:http";
import { readFileSync } from "node:fs";

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw: data,
        });
      });
    });
    req.on("error", reject);
    if (body) {
      if (typeof body === "string") req.write(body);
      else req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const tests = [];
function assert(name, condition, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    tests.push({ name, pass: true });
  } else {
    console.log(`  ❌ FAIL: ${name} ${details ? "(" + details + ")" : ""}`);
    tests.push({ name, pass: false, details });
  }
}

async function run() {
  console.log("\n=======================================================");
  console.log("   CLEANTRACK LIVE HTTP END-TO-END REGRESSION SUITE   ");
  console.log("=======================================================\n");

  // 1. Check all critical frontend pages on Port 3000
  console.log("▶ [1] Frontend SSR Web Pages Status");
  const pages = ["/", "/role", "/driver", "/resident", "/admin", "/admin/reports", "/admin/map", "/privacy"];
  for (const p of pages) {
    try {
      const res = await request({ hostname: "localhost", port: 3000, path: p, method: "GET" });
      assert(`Page ${p} renders with HTTP 200`, res.statusCode === 200, `Got: ${res.statusCode}`);
      assert(`Page ${p} returns non-empty HTML`, res.raw && res.raw.includes("<html") && res.raw.length > 500);
    } catch (err) {
      assert(`Page ${p} accessible`, false, err.message);
    }
  }

  // 2. Check Backend REST endpoints on Port 3001
  console.log("\n▶ [2] Backend REST Endpoints (Port 3001)");
  try {
    const health = await request({ hostname: "localhost", port: 3001, path: "/api/health", method: "GET" });
    assert("Backend /api/health responds 200", health.statusCode === 200);

    const trucks = await request({ hostname: "localhost", port: 3001, path: "/api/trucks", method: "GET" });
    assert("Backend /api/trucks responds 200", trucks.statusCode === 200);
    assert("Backend /api/trucks returns success: true", trucks.data?.success === true);

    const locations = await request({ hostname: "localhost", port: 3001, path: "/api/trucks/locations", method: "GET" });
    assert("Backend /api/trucks/locations responds 200", locations.statusCode === 200);
    assert("Backend /api/trucks/locations returns success: true", locations.data?.success === true);

    const drivers = await request({ hostname: "localhost", port: 3001, path: "/api/drivers", method: "GET" });
    assert("Backend /api/drivers responds 200", drivers.statusCode === 200);
    assert("Backend /api/drivers returns success: true", drivers.data?.success === true);
  } catch (err) {
    assert("Backend endpoints accessible", false, err.message);
  }

  // 3. Backend Auth Security
  console.log("\n▶ [3] Backend Auth Endpoint Security (Port 3001)");
  try {
    const badLogin = await request(
      {
        hostname: "localhost",
        port: 3001,
        path: "/api/auth/admin",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { username: "admin", password: "invalid-password" }
    );
    assert("Invalid admin password returns 401 Unauthorized", badLogin.statusCode === 401);

    const validLogin = await request(
      {
        hostname: "localhost",
        port: 3001,
        path: "/api/auth/admin",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { username: "admin", password: "admin123" }
    );
    assert("Valid admin credentials return 200 and success: true", validLogin.statusCode === 200 && validLogin.data?.success === true);

    const badOtp = await request(
      {
        hostname: "localhost",
        port: 3001,
        path: "/api/auth/otp",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { phone: "9876543210", code: "123456" }
    );
    assert("Non-admin phone to admin OTP endpoint rejected with 400", badOtp.statusCode === 400);
  } catch (err) {
    assert("Auth security checks executed", false, err.message);
  }

  // 4. Capacitor Config Target URL
  console.log("\n▶ [4] Mobile Deployment Target URL Check");
  const cap = JSON.parse(readFileSync("capacitor.config.json", "utf-8"));
  assert("Capacitor does not point to backend REST API", !cap?.server?.url?.includes("shirpur-garbage-backend.onrender.com"));
  assert("Capacitor points to frontend application", cap?.server?.url === "https://street-scan-track.shirpur.app");

  // 5. Package.json build command
  console.log("\n▶ [5] Build Scripts Check");
  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
  assert("Root package.json build script targets frontend", pkg.scripts?.build === "npm --prefix frontend run build");
  assert("Root package.json dev script targets frontend", pkg.scripts?.dev === "npm --prefix frontend run dev");
  assert("Root package.json has build:backend script", Boolean(pkg.scripts?.["build:backend"]));

  console.log("\n=======================================================");
  const passedCount = tests.filter((t) => t.pass).length;
  const failedCount = tests.filter((t) => !t.pass).length;
  console.log(`TOTAL CHECKS: ${passedCount} PASSED, ${failedCount} FAILED out of ${tests.length}`);
  console.log("=======================================================\n");

  if (failedCount > 0) process.exit(1);
}

run();
