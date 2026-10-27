import { NextRequest, NextResponse } from "next/server";
import { getPublicOrganizationProfile, getOrganizationById } from "@/lib/organizations";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    // Resolve by slug first, then fallback to UUID
    let profile = await getPublicOrganizationProfile(id);
    if (!profile) {
      const org = await getOrganizationById(id);
      if (org) {
        profile = await getPublicOrganizationProfile(org.publicProfileSlug);
      }
    }

    if (!profile) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch organization profile." }, { status: 500 });
  }
}
