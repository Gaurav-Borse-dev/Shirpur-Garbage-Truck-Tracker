import { z } from "zod";

export const alertFrequencies = ["immediate", "every_15m", "hourly", "daily"] as const;
export const permissionStates = ["default", "granted", "denied", "unsupported"] as const;

export const prefsInput = z.object({
  nearbyAlertsEnabled: z.boolean(),
  alertFrequency: z.enum(alertFrequencies),
  permissionState: z.enum(permissionStates).optional(),
});

export const registerTokenInput = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["web", "android", "ios"]).default("web"),
  userAgent: z.string().max(300).optional(),
});

export const revokeTokenInput = z.object({
  token: z.string().min(20).max(4096).optional(),
});

export const revokeTokenIdInput = z.object({
  id: z.string().uuid(),
});

export const recentDeliveriesInput = z.object({
  since: z.string().datetime(),
});

export const selfTestInput = z.object({
  truckCode: z.string().max(20).optional(),
});

export const testPushInput = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("resident"), phone: z.string().regex(/^\d{10}$/) }),
    z.object({ kind: z.literal("truck"), truckCode: z.string().regex(/^GBR-\d{2}$/) }),
  ]),
  title: z.string().min(1).max(80),
  body: z.string().max(200).optional(),
});