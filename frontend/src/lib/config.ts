/**
 * Municipality configuration.
 *
 * Shirpur is the first deployment. All municipality-specific values live here
 * so another city can be onboarded by changing this single file (or switching
 * to an env/db-driven config later) without rewriting the application.
 */

import type { LatLng } from "@/lib/geo";

export const municipality = {
  /** Display name shown in headers, emails, and notifications. */
  name: "Shirpur Municipal Corporation",
  /** Short city name used in URLs, session data, and compact UI. */
  city: "Shirpur",
  /** Administrative district. */
  district: "Dhule",
  /** State or province. */
  state: "Maharashtra",
  /** Country code (ISO 3166-1 alpha-2). */
  country: "IN",
  /** Support email displayed in the app. */
  supportEmail: "support@cleantrack.in",
  /** Support phone number. */
  supportPhone: "+91 2563 255 100",
  /** Default map center used when user location is unavailable. */
  mapCenter: { lat: 21.3483, lng: 74.8827 } satisfies LatLng,
  /** IANA timezone identifier. */
  timezone: "Asia/Kolkata",
  /** Default geofence radius for new residents (meters). */
  defaultGeofenceRadius: 500,
  /** Geofence radius options shown in resident profile settings. */
  geofenceOptions: [100, 250, 500, 1000] as readonly number[],
  /** Operating hours display string. */
  operatingHours: "7:00 AM – 1:00 PM",
  /** Total number of trucks in the fleet. */
  fleetSize: 16,
  /** Currency used for bookings/fees. */
  currency: "INR",
  /** Phone country code prefix. */
  phonePrefix: "+91",
  /** Regex for validating local phone numbers (without prefix). */
  phonePattern: /^\d{10}$/ as RegExp,
} as const;

/** Convenience alias for the map center. */
export const SHIRPUR = municipality.mapCenter;
