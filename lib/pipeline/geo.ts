/**
 * Geodesic helpers shared by location verification, candidate discovery and
 * community-vote proximity checks.
 *
 * PRD §9 requires metric/geodesic distance calculations; raw degree differences
 * must never be used for proximity decisions.
 */

const EARTH_RADIUS_METERS = 6371000;

export function calculateGeodesicDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) {
    return Number.NaN;
  }

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function isValidWGS84Coordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
