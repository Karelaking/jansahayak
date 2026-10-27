import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, appealResolutionClaim } from "@/lib/organizations";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    const orgData = await getUserOrganization(session.userId);
    if (!orgData) {
      return NextResponse.json({ error: "Forbidden: You must belong to an organization to appeal." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    if (!body.appealReason) {
      return NextResponse.json({ error: "appealReason is required." }, { status: 400 });
    }

    const updatedClaim = await appealResolutionClaim({
      claimId: id,
      organizationId: orgData.organization.id,
      userId: session.userId,
      appealReason: body.appealReason,
      supplementaryEvidenceUrl: body.supplementaryEvidenceUrl,
    });

    return NextResponse.json({ claim: updatedClaim, message: "Appeal submitted successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to submit appeal." }, { status: 400 });
  }
}
