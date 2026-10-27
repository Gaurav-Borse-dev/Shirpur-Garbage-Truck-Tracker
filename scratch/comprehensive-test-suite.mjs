import http from "node:http";

async function postJson(url, body, headers = {}) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsedBody;
          try {
            parsedBody = JSON.parse(data);
          } catch {
            parsedBody = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsedBody });
        });
      }
    );
    req.on("error", (err) => resolve({ error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function getJson(url, headers = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsedBody;
          try {
            parsedBody = JSON.parse(data);
          } catch {
            parsedBody = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsedBody });
        });
      }
    );
    req.on("error", (err) => resolve({ error: err.message }));
    req.end();
  });
}

const results = [];

function assert(description, condition, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    results.push({ description, pass: true });
  } else {
    console.log(`  ❌ FAIL: ${description} ${details ? "- " + details : ""}`);
    results.push({ description, pass: false, details });
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   CLEANTRACK COMPREHENSIVE QA & STRESS TEST SUITE     ");
  console.log("=======================================================\n");

  // SECTION 1: Backend API Health and Service Status
  console.log("▶ [1] Testing Backend API Endpoints (Port 3001)");
  
  const healthRes = await getJson("http://localhost:3001/api/health");
  assert("Backend health check responds with 200", healthRes.status === 200);
  assert("Backend reports healthy database status", healthRes.body?.status === "ok" || healthRes.body?.database === "connected");

  const trucksRes = await getJson("http://localhost:3001/api/trucks");
  assert("Backend GET /api/trucks responds 200", trucksRes.status === 200);
  assert("Backend GET /api/trucks returns trucks array", Array.isArray(trucksRes.body?.trucks) || Array.isArray(trucksRes.body));

  const locsRes = await getJson("http://localhost:3001/api/trucks/locations");
  assert("Backend GET /api/trucks/locations responds 200", locsRes.status === 200);

  const driversRes = await getJson("http://localhost:3001/api/drivers");
  assert("Backend GET /api/drivers responds 200", driversRes.status === 200);

  // SECTION 2: Backend Auth & Boundary Testing
  console.log("\n▶ [2] Testing Backend Auth Security & Edge Cases (Port 3001)");

  // Missing credentials
  const emptyAuth = await postJson("http://localhost:3001/api/auth/admin", {});
  assert("Empty admin auth body rejected with 401", emptyAuth.status === 401);

  // Invalid password
  const badPass = await postJson("http://localhost:3001/api/auth/admin", {
    username: "admin",
    password: "wrong-password-12345",
  });
  assert("Incorrect admin password rejected with 401", badPass.status === 401);

  // Valid credentials (default admin123)
  const validAdmin = await postJson("http://localhost:3001/api/auth/admin", {
    username: "admin",
    password: "admin123",
  });
  assert("Valid admin credentials accepted with 200", validAdmin.status === 200 && validAdmin.body?.success === true);

  // Non-admin phone in OTP
  const badOtpPhone = await postJson("http://localhost:3001/api/auth/otp", {
    phone: "9876543210",
    code: "123456",
  });
  assert("Non-admin phone to admin OTP endpoint rejected with 400", badOtpPhone.status === 400);

  // Invalid OTP code for admin phone
  const badOtpCode = await postJson("http://localhost:3001/api/auth/otp", {
    phone: "9999999999",
    code: "000000",
  });
  assert("Incorrect OTP code rejected with 400", badOtpCode.status === 400);

  // Correct OTP code for admin phone
  const goodOtp = await postJson("http://localhost:3001/api/auth/otp", {
    phone: "9999999999",
    code: "123456",
  });
  assert("Correct OTP for 9999999999 accepted with 200", goodOtp.status === 200 && goodOtp.body?.success === true);

  // SECTION 3: Frontend Server Functions & Session Isolation (Port 3000)
  console.log("\n▶ [3] Testing Frontend SSR & Server Functions Security (Port 3000)");

  // Test adminLogin with wrong credentials
  // We can dynamically invoke the functions or RPC endpoints
  console.log("\n▶ [4] Testing Concurrency & Load (Simulating 50 Concurrent Requests)");
  const startTime = Date.now();
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(getJson("http://localhost:3000/api/health").catch((e) => e));
  }
  const loadResults = await Promise.all(promises);
  const duration = Date.now() - startTime;
  const successes = loadResults.filter((r) => r && r.status === 200).length;
  console.log(`  Completed 50 concurrent requests in ${duration}ms (Avg: ${(duration / 50).toFixed(1)}ms/req)`);
  assert("50 concurrent requests handled without server crash", successes === 50, `${successes}/50 succeeded`);

  console.log("\n=======================================================");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${results.length} checks`);
  console.log("=======================================================\n");
}

runTests();
