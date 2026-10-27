/**
 * Reverse Geocoding Utility for JanSahayak SafeStreets
 * Resolves WGS84 GPS latitude/longitude coordinates into human-readable localities,
 * street names, and municipal jurisdictions using OpenStreetMap Nominatim with memory caching.
 */

const geocodeCache = new Map<string, string>();

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "Field Geotag Location";
  }

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "JanSahayak-SafeStreets-Civic-App/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      // Build human-friendly locality string: Street/Suburb, City/Town, State
      const primaryLocality =
        addr.road ||
        addr.street ||
        addr.pedestrian ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.quarter;

      const secondaryDistrict =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.city_district ||
        addr.county ||
        addr.state_district;

      const stateRegion = addr.state;

      const segments = [primaryLocality, secondaryDistrict, stateRegion].filter(Boolean);

      let resolved: string;
      if (segments.length > 0) {
        resolved = segments.join(", ");
      } else if (data.display_name) {
        resolved = data.display_name.split(",").slice(0, 3).join(", ").trim();
      } else {
        resolved = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      }

      geocodeCache.set(cacheKey, resolved);
      return resolved;
    }
  } catch {
    // Non-blocking fallback when network/external service times out
  }

  // Fallback: Check if within Greater Noida bounding box
  if (lat >= 28.38 && lat <= 28.58 && lng >= 77.4 && lng <= 77.62) {
    return "Sector 20, Greater Noida";
  }

  return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
}
