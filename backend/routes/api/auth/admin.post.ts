import { eventHandler, readBody, setResponseStatus } from "h3";
import { secretMatches } from "../../../src/server/session.server";

export default eventHandler(async (event) => {
  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<string, any>;
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");

  const expectedUser = process.env["ADMIN_USERNAME"] || "admin";
  const expectedPass = process.env["ADMIN_PASSWORD"] || "admin123";

  const okUser = await secretMatches(username, expectedUser);
  const okPass = await secretMatches(password, expectedPass);

  if (!okUser || !okPass) {
    setResponseStatus(event, 401);
    return { success: false, error: "Invalid credentials" };
  }

  return {
    success: true,
    user: { role: "admin", username },
    timestamp: new Date().toISOString(),
  };
});
