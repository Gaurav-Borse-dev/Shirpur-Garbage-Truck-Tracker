/**
 * 1-D Kalman filter for GPS smoothing.
 *
 * Independently filters latitude and longitude, handling the statistical
 * uncertainty of GPS fixes. The filter reduces position noise by weighting
 * new measurements against predicted position based on accuracy.
 *
 * Based on the standard 1D Kalman filter used in vehicle tracking systems.
 */

export type KalmanState = {
  lat: number;
  lng: number;
  varLat: number; // position variance (lat)
  varLng: number; // position variance (lng)
  ts: number; // last update timestamp
};

/** Process noise — how much position can change per second (in degrees). ~5 m/s truck speed */
const Q_METERS_PER_SECOND = 5;
/** 1 meter in degrees latitude (approx) */
const METERS_TO_DEG = 1 / 111_320;

/**
 * Apply one Kalman filter step.
 * @param state  Previous filter state (null for first fix)
 * @param lat    Raw measured latitude
 * @param lng    Raw measured longitude
 * @param accuracyM  GPS reported accuracy in meters (default 30m)
 * @param ts     Timestamp of measurement (ms)
 * @returns Updated filter state (smoothed position)
 */
export function kalmanUpdate(
  state: KalmanState | null,
  lat: number,
  lng: number,
  accuracyM: number = 30,
  ts: number = Date.now(),
): KalmanState {
  // Convert accuracy to degrees variance
  const accuracyDeg = accuracyM * METERS_TO_DEG;
  const measurementVariance = accuracyDeg * accuracyDeg;

  if (!state) {
    // First fix — initialize with measurement
    return {
      lat,
      lng,
      varLat: measurementVariance,
      varLng: measurementVariance,
      ts,
    };
  }

  const dtS = Math.max(0, (ts - state.ts) / 1000);

  // Process noise variance (how much we expect position to change)
  const qDeg = Q_METERS_PER_SECOND * METERS_TO_DEG;
  const processNoise = qDeg * qDeg * dtS;

  // Prediction step: propagate uncertainty
  const predVarLat = state.varLat + processNoise;
  const predVarLng = state.varLng + processNoise;

  // Update step: Kalman gain
  const kLat = predVarLat / (predVarLat + measurementVariance);
  const kLng = predVarLng / (predVarLng + measurementVariance);

  // Apply correction
  const smoothLat = state.lat + kLat * (lat - state.lat);
  const smoothLng = state.lng + kLng * (lng - state.lng);

  // Update variance
  const newVarLat = (1 - kLat) * predVarLat;
  const newVarLng = (1 - kLng) * predVarLng;

  return {
    lat: smoothLat,
    lng: smoothLng,
    varLat: newVarLat,
    varLng: newVarLng,
    ts,
  };
}

/** Estimated accuracy of filtered position in meters */
export function kalmanAccuracyM(state: KalmanState): number {
  const varDeg = Math.sqrt((state.varLat + state.varLng) / 2);
  return varDeg / METERS_TO_DEG;
}
