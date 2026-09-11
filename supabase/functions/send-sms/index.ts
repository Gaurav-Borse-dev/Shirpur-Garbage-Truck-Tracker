// Supabase Auth Send SMS Hook -> SmsHorizon v2 Edge Function
// Auth: POST with Bearer token header (API Key)
// Endpoint: https://smshorizon.co.in/api/v2/sendsms.php

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Supabase Auth Hook invokes with POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    console.log("[send-sms] Hook payload:", JSON.stringify(payload));

    // Handle flexible payload formats from Supabase Auth hooks
    const rawPhone =
      payload?.user?.phone ||
      payload?.phone ||
      payload?.recipient ||
      "";

    const otp =
      payload?.sms?.otp ||
      payload?.otp ||
      payload?.code ||
      payload?.token ||
      "";

    if (!rawPhone || !otp) {
      console.error("[send-sms] Missing phone or OTP:", payload);
      return new Response(
        JSON.stringify({ error: "Missing phone number or OTP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone to 10-digit Indian mobile
    const mobile = String(rawPhone).replace(/\D/g, "").slice(-10);
    if (mobile.length !== 10) {
      console.error("[send-sms] Invalid phone:", rawPhone);
      return new Response(
        JSON.stringify({ error: "Invalid mobile number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read secrets from Supabase environment
    const apiKey = Deno.env.get("SMSHORIZON_API_KEY") || "";
    const senderId = Deno.env.get("SMSHORIZON_SENDER_ID") || "HORIZN";
    const username = Deno.env.get("SMSHORIZON_USERNAME") || "gaurav";
    const templateId = Deno.env.get("SMSHORIZON_TID") || Deno.env.get("SMSHORIZON_TEMPLATE_ID");

    if (!apiKey) {
      console.error("[send-sms] Missing SMSHORIZON_API_KEY");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the approved trial template format with OTP as the variable
    const message = `OTP for your new user account registration is: ${otp}\n\n- SmsHorizon`;

    // Build form data for POST body
    const formData = new URLSearchParams();
    formData.set("user", username);
    formData.set("mobile", mobile);
    formData.set("senderid", senderId);
    formData.set("message", message);
    formData.set("type", "txt");
    if (templateId) {
      formData.set("tid", templateId);
    }

    console.log(`[send-sms] Sending OTP to ******${mobile.slice(-4)} via SmsHorizon v2 (Bearer auth)`);

    // SmsHorizon v2 API: POST with Bearer token in header, form data in body
    const res = await fetch("https://smshorizon.co.in/api/v2/sendsms.php", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await res.text();
    console.log(`[send-sms] SmsHorizon response (${res.status}):`, responseText);

    // Check for errors
    const lower = responseText.toLowerCase();
    if (!res.ok || lower.includes("invalid") || lower.includes("error") || lower.includes("fail")) {
      console.error("[send-sms] SmsHorizon error:", responseText);
      return new Response(
        JSON.stringify({ error: `SMS error: ${responseText.trim()}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success — Supabase Auth Hook expects empty 200 JSON
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-sms] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
