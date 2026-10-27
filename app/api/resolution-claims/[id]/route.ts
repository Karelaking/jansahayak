import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getResolutionClaimById, updateClaimReview, getUserOrganization } from "@/lib/organizations";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    const orgData = session.userId ? await getUserOrganization(session.userId) : null;

    const { id } = await context.params;
    const claimDossier = await getResolutionClaimById(id, {
      userId: session.userId,
      userRole: session.role,
      organizationId: orgData?.organization.id,
    });

    if (!claimDossier) {
      return NextResponse.json({ error: "Resolution claim not found." }, { status: 404 });
    }

    return NextResponse.json(claimDossier);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch claim." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    if (session.role !== "admin" && session.role !== "moderator") {
      return NextResponse.json({ error: "Forbidden: Only moderators and admins can review claims." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const updated = await updateClaimReview({
      claimId: id,
      reviewerId: session.userId,
      status: body.status,
      initialReviewNotes: body.initialReviewNotes,
      officialInspectionCompleted: body.officialInspectionCompleted,
      officialInspectionNotes: body.officialInspectionNotes,
    });

    return NextResponse.json({ claim: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to review claim." }, { status: 400 });
  }
}
