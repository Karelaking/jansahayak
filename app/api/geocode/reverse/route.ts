import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/geo/reverse-geocode";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: "Missing lat/lng parameters" }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid coordinate values" }, { status: 400 });
  }

  const address = await reverseGeocode(lat, lng);
  return NextResponse.json({ success: true, address, latitude: lat, longitude: lng });
}
