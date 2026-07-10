/**
 * Shared GPS coordinate validation for the map and geocoding paths.
 *
 * A coordinate pair is "displayable" when both values are finite, inside the
 * WGS84 range, and not the (0, 0) "null island" sentinel. IoT devices without a
 * GPS fix report (0, 0); including those points stretches the map's fitBounds
 * across a whole ocean/continent so the real markers can no longer be framed —
 * the user has to hunt for them by zooming out (FR-11283).
 *
 * Only the exact (0, 0) pair is rejected: a point on the equator alone (lat 0)
 * or on the prime meridian alone (lon 0, e.g. London) is a real location and is
 * kept. Frontend and backend keep identical copies of this predicate so the same
 * (0, 0) / range rule runs on both sides. Note the parse feeding it differs —
 * backend GPS detection uses the stricter parseCoordinate, while the map filters
 * and the export use parseFloat — so it is this rule, not the parse, that is
 * guaranteed identical.
 */
export function isDisplayableCoordinate(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  if (lat === 0 && lon === 0) return false;
  return true;
}
