// Test all variations of user field name with Bearer auth
const apiKey = "L4BywumKe5R9BKExsfjwVgIzMUfJBU";
const mobile = "7414972702";
const senderId = "HORIZN";
const message = "OTP for your new user account registration is: 654321\n\n- SmsHorizon";

async function test(name, opts) {
  console.log(`--- ${name} ---`);
  try {
    const res = await fetch(opts.url, opts.fetchOpts);
    const text = await res.text();
    console.log(`Status: ${res.status}, Body: ${text}\n`);
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
  }
}

async function main() {
  // Test 1: JSON with "username" field
  await test("JSON POST with 'username' field", {
    url: "https://smshorizon.co.in/api/v2/sendsms.php",
    fetchOpts: {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username: "gaurav", mobile, senderid: senderId, message, type: "txt" }),
    }
  });

  // Test 2: Query param user + Bearer header
  await test("GET query ?user=gaurav + Bearer header", {
    url: `https://smshorizon.co.in/api/v2/sendsms.php?user=gaurav&mobile=${mobile}&senderid=${senderId}&message=${encodeURIComponent(message)}&type=txt`,
    fetchOpts: {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}` },
    }
  });

  // Test 3: POST multipart form
  const formData = new URLSearchParams();
  formData.set("user", "gaurav");
  formData.set("mobile", mobile);
  formData.set("senderid", senderId);
  formData.set("message", message);
  formData.set("type", "txt");
  
  await test("POST form (no apikey, only Bearer)", {
    url: "https://smshorizon.co.in/api/v2/sendsms.php",
    fetchOpts: {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    }
  });

  // Test 4: POST form with apikey BUT NO Bearer header
  const formData2 = new URLSearchParams();
  formData2.set("user", "gaurav");
  formData2.set("apikey", apiKey);
  formData2.set("mobile", mobile);
  formData2.set("senderid", senderId);
  formData2.set("message", message);
  formData2.set("type", "txt");
  
  await test("POST form with apikey in body, NO Bearer header", {
    url: "https://smshorizon.co.in/api/v2/sendsms.php",
    fetchOpts: {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData2.toString(),
    }
  });

  // Test 5: Try v1 endpoint
  await test("GET v1 sendsms", {
    url: `https://smshorizon.co.in/api/sendsms.php?user=gaurav&apikey=${apiKey}&mobile=${mobile}&senderid=${senderId}&message=${encodeURIComponent(message)}&type=txt`,
    fetchOpts: { method: "GET" }
  });
}

main();
