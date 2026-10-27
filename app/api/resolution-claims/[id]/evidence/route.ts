import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, addResolutionEvidence } from "@/lib/organizations";

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
      return NextResponse.json({ error: "Forbidden: You must belong to an organization to attach evidence." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    if (!body.evidenceType || !body.mediaUrl) {
      return NextResponse.json({ error: "evidenceType and mediaUrl are required." }, { status: 400 });
    }

    const evidence = await addResolutionEvidence({
      resolutionClaimId: id,
      organizationId: orgData.organization.id,
      userId: session.userId,
      evidenceType: body.evidenceType,
      mediaUrl: body.mediaUrl,
      description: body.description,
      capturedAt: body.capturedAt ? new Date(body.capturedAt) : undefined,
      locationReference: body.locationReference,
      visibility: body.visibility || "public",
    });

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error: any) {
    const status = error.message.includes("Unauthorized") || error.message.includes("does not belong") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to attach evidence." }, { status });
  }
}
