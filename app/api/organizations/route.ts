import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { registerOrganization, listOrganizations } from "@/lib/organizations";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    const rate = checkRateLimit(`org_reg_${session.userId}`, { limit: 5, windowMs: 60 * 1000 });
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const result = await registerOrganization({
      legalName: body.legalName,
      displayName: body.displayName,
      organizationType: body.organizationType,
      registrationNumber: body.registrationNumber,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      publicDescription: body.publicDescription,
      websiteUrl: body.websiteUrl,
      operatingLocations: body.operatingLocations,
      focusAreas: body.focusAreas,
      ownerUserId: session.userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to register organization." }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const verificationStatus = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const orgs = await listOrganizations({
      verificationStatus,
      limit: Math.min(100, Math.max(1, limit)),
    });

    return NextResponse.json({ organizations: orgs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list organizations." }, { status: 500 });
  }
}
