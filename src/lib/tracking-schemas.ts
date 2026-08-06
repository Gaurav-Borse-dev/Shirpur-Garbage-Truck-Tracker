import { z } from "zod";

export const gpsInput = z.object({
  truckCode: z.string().regex(/^GBR-\d{2}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKmh: z.number().min(0).max(200).optional(),
  accuracyM: z.number().min(0).max(10000).optional(),
});

export const nearbyInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(100).max(100000),
  limit: z.number().int().min(1).max(50).optional(),
});

export const etaInput = z.object({
  truckCode: z.string().regex(/^GBR-\d{2}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
