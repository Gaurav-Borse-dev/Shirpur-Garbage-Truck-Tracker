import http from "node:http";

if (process.loadEnvFile) {
  try {
    process.loadEnvFile("backend/.env");
  } catch {}
}

const testResults = [];

function check(testName, passed, details = "") {
  if (passed) {
    console.log(`  ✅ PASS: ${testName}`);
    testResults.push({ testName, passed: true });
  } else {
    console.log(`  ❌ FAIL: ${testName} ${details ? "(" + details + ")" : ""}`);
    testResults.push({ testName, passed: false, details });
  }
}

async function runRegressionSuite() {
  console.log("\n=======================================================");
  console.log("   CLEANTRACK AUTOMATED REGRESSION & VERIFICATION SUITE ");
  console.log("=======================================================\n");

  // ── TEST 1: Role Escalation Prevention ──
  console.log("▶ [Test 1] Auth & Role Escalation Prevention");
  try {
    const { setFirebaseSession } = await import("../frontend/src/lib/auth.functions.ts");
    
    // Attempt privilege escalation: ordinary phone claiming driver role
    const attackerPhone = "9123456789";
    const resAttacker = await setFirebaseSession({
      data: {
        phone: attackerPhone,
        role: "driver",
        firebaseUid: "fake-attacker-uid-12345",
      },
    });

    check(
      "Unauthorized resident claiming driver role is NOT granted driver role",
      resAttacker?.resolvedRole !== "driver",
      `Assigned role was: ${resAttacker?.resolvedRole}`
    );

    // Attempt privilege escalation: ordinary phone claiming admin role
    const resAdminAttacker = await setFirebaseSession({
      data: {
        phone: attackerPhone,
        role: "admin",
        firebaseUid: "fake-admin-uid-12345",
      },
    });

    check(
      "Unauthorized phone claiming admin role is NOT granted admin role",
      resAdminAttacker?.resolvedRole !== "admin",
      `Assigned role was: ${resAdminAttacker?.resolvedRole}`
    );

    // Legitimate admin phone
    const resLegitAdmin = await setFirebaseSession({
      data: {
        phone: "9999999999",
        role: "admin",
        firebaseUid: "legit-admin-uid",
      },
    });

    check(
      "Designated admin phone 9999999999 is granted admin role",
      resLegitAdmin?.resolvedRole === "admin"
    );
  } catch (err) {
    check("Auth regression test executed without crash", false, err.message);
  }

  // ── TEST 2: getDailyDriverReport Authorization ──
  console.log("\n▶ [Test 2] Daily Driver Report PII Protection");
  try {
    const { getDailyDriverReport } = await import("../frontend/src/lib/tracking.functions.ts");
    const { clearUser } = await import("../frontend/src/lib/session.server.ts");
    
    // Ensure caller is unauthenticated
    await clearUser();

    const unauthReport = await getDailyDriverReport();
    check(
      "Unauthenticated caller to getDailyDriverReport is rejected with unauthorized",
      unauthReport?.error === "unauthorized" && (!unauthReport.drivers || unauthReport.drivers.length === 0),
      `Returned: ${JSON.stringify(unauthReport)}`
    );
  } catch (err) {
    check("Daily driver report authorization test", false, err.message);
  }

  // ── TEST 3: Dustbin Booking Validation ──
  console.log("\n▶ [Test 3] Dustbin Booking Validation & Past Date Rejection");
  try {
    const { createBooking } = await import("../frontend/src/lib/booking.functions.ts");
    const { setUser } = await import("../frontend/src/lib/session.server.ts");

    // Set a resident session
    await setUser({ role: "resident", phone: "9876543210" });

    // Test past date
    const pastRes = await createBooking({
      data: {
        address: "Main Market Road, Shirpur",
        reason: "Community Festival Waste Collection",
        fromDate: "2020-01-01",
        toDate: "2020-01-05",
      },
    });

    check(
      "Booking with past date is rejected",
      pastRes?.ok === false && pastRes?.error?.includes("past"),
      `Error was: ${pastRes?.error}`
    );

    // Test reversed date range (fromDate > toDate)
    const reversedRes = await createBooking({
      data: {
        address: "Main Market Road, Shirpur",
        reason: "Community Festival Waste Collection",
        fromDate: "2027-01-10",
        toDate: "2027-01-05",
      },
    });

    check(
      "Booking with fromDate > toDate is rejected",
      reversedRes?.ok === false && (reversedRes?.error?.includes("before") || reversedRes?.error?.includes("equal")),
      `Error was: ${reversedRes?.error}`
    );
  } catch (err) {
    check("Booking validation test executed without crash", false, err.message);
  }

  // ── TEST 4: Chatbot Database Query Resiliency ──
  console.log("\n▶ [Test 4] Chatbot Schema & Query Resiliency");
  try {
    const { getTruckLocation, getTruckStatus, getTruckRoute } = await import("../frontend/src/lib/chatbot.functions.ts");

    const locRes = await getTruckLocation("non-existent-user-id");
    check(
      "getTruckLocation executes without PostgreSQL column error",
      Boolean(locRes?.text) && !locRes?.text.includes("Error processing")
    );

    const statusRes = await getTruckStatus("non-existent-user-id");
    check(
      "getTruckStatus executes without PostgreSQL column error",
      Boolean(statusRes?.text) && !statusRes?.text.includes("Error processing")
    );

    const routeRes = await getTruckRoute("non-existent-user-id");
    check(
      "getTruckRoute executes without PostgreSQL column error",
      Boolean(routeRes?.text) && !routeRes?.text.includes("Error processing")
    );
  } catch (err) {
    check("Chatbot queries executed without crash", false, err.message);
  }

  // ── TEST 5: Capacitor Configuration Target URL ──
  console.log("\n▶ [Test 5] Capacitor Mobile App Target URL");
  try {
    const { readFileSync } = await import("node:fs");
    const capConfig = JSON.parse(readFileSync("capacitor.config.json", "utf-8"));
    const url = capConfig?.server?.url;

    check(
      "Capacitor server.url does NOT point to the backend REST API",
      !url?.includes("shirpur-garbage-backend.onrender.com"),
      `URL was: ${url}`
    );

    check(
      "Capacitor server.url points to the production frontend application",
      url === "https://street-scan-track.shirpur.app",
      `URL was: ${url}`
    );
  } catch (err) {
    check("Capacitor config test", false, err.message);
  }

  console.log("\n=======================================================");
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;
  console.log(`REGRESSION RESULTS: ${passedCount} PASSED, ${failedCount} FAILED out of ${testResults.length} tests`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runRegressionSuite();
