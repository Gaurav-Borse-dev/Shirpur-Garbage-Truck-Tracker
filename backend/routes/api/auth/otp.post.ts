import { eventHandler, readBody, setResponseStatus } from "h3";
import { secretMatches } from "../../../src/server/session.server";

export default eventHandler(async (event) => {
  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<string, any>;
  const code = String(body.code ?? "");
  const phone = String(body.phone ?? "");
  const role = String(body.role ?? "resident");

  const clean = phone.trim().replace(/\D/g, "").slice(-10);
  const isAdminPhone = clean === "9999999999" || clean === "9999999990";

  if (!isAdminPhone) {
    setResponseStatus(event, 400);
    return { success: false, error: "Please enter the real SMS OTP sent to your phone." };
  }

  const expectedOtp = process.env["LOGIN_OTP_CODE"] || "123456";
  const ok = await secretMatches(code, expectedOtp);

  if (!ok) {
    setResponseStatus(event, 400);
    return { success: false, error: "Incorrect verification code" };
  }

  return {
    success: true,
    user: { role, phone: clean },
    timestamp: new Date().toISOString(),
  };
});
