export type LatLng = { lat: number; lng: number };

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const λ1 = toRad(a.lng);
  const λ2 = toRad(b.lng);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) };
}

/** Interpolate angle taking shortest path (handles 350 -> 10 via 0). */
export function lerpAngle(a: number, b: number, t: number) {
  let diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Catmull-Rom spline resampling of a closed waypoint loop.
 * Turns the sparse waypoint list into a dense, road-like curved path so
 * trucks never travel in visible straight hops between waypoints.
 */
export function smoothClosedPath(points: LatLng[], samplesPerSegment = 8): LatLng[] {
  const n = points.length;
  if (n < 3) return points.slice();
  const out: LatLng[] = [];
  const at = (i: number) => points[((i % n) + n) % n];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a: number, b: number, c2: number, d: number) =>
        0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      out.push({
        lat: c(p0.lat, p1.lat, p2.lat, p3.lat),
        lng: c(p0.lng, p1.lng, p2.lng, p3.lng),
      });
    }
  }
  return out;
}

/** Signed turn angle (degrees, 0..180) between three consecutive points. */
export function turnAngle(a: LatLng, b: LatLng, c: LatLng): number {
  const d = Math.abs(((bearing(b, c) - bearing(a, b) + 540) % 360) - 180);
  return d;
}

/** Total length of a polyline in meters. */
export function pathLength(points: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return d;
}

/** Format meters → human distance. */
export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Format minutes from meters @ avg 20 km/h */
export function fmtEta(m: number): string {
  const mins = Math.max(1, Math.round(m / 333));
  return `${mins} min`;
}