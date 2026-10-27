import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, submitOrganizationVerification } from "@/lib/organizations";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    const orgData = await getUserOrganization(session.userId);
    if (!orgData) {
      return NextResponse.json({ error: "No organization found for current user." }, { status: 404 });
    }

    const body = await req.json();
    if (!body.documents || !Array.isArray(body.documents) || body.documents.length === 0) {
      return NextResponse.json({ error: "At least one verification document is required." }, { status: 400 });
    }

    await submitOrganizationVerification({
      organizationId: orgData.organization.id,
      userId: session.userId,
      documents: body.documents,
    });

    return NextResponse.json({ success: true, message: "Verification documents submitted for review." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to submit verification." }, { status: 400 });
  }
}
