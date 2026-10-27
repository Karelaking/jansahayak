import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, getAdoptionsByOrganization } from "@/lib/organizations";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    const orgData = await getUserOrganization(session.userId);
    if (!orgData) {
      return NextResponse.json({ error: "No organization found for current user." }, { status: 404 });
    }

    const adoptions = await getAdoptionsByOrganization(orgData.organization.id);
    return NextResponse.json({ adoptions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch adoptions." }, { status: 500 });
  }
}
