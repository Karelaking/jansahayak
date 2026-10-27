import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, createAdoptionProposal } from "@/lib/organizations";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    const { id } = await context.params;
    const orgData = await getUserOrganization(session.userId);
    if (!orgData) {
      return NextResponse.json(
        { error: "Forbidden: You must belong to a registered organization to propose adoption." },
        { status: 403 },
      );
    }

    const body = await req.json();
    if (!body.proposedRole || !body.proposalDescription || !body.scope) {
      return NextResponse.json(
        { error: "Missing required fields: proposedRole, proposalDescription, scope." },
        { status: 400 },
      );
    }

    const proposal = await createAdoptionProposal({
      incidentId: id,
      organizationId: orgData.organization.id,
      userId: session.userId,
      proposedRole: body.proposedRole,
      proposalDescription: body.proposalDescription,
      scope: body.scope,
      estimatedCost: body.estimatedCost ? parseFloat(body.estimatedCost) : undefined,
      currency: body.currency || "INR",
      proposedDeadline: body.proposedDeadline ? new Date(body.proposedDeadline) : undefined,
    });

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error: any) {
    const status = error.message.includes("Verification status is") || error.message.includes("Only verified organizations")
      ? 403
      : 400;
    return NextResponse.json({ error: error.message || "Failed to create adoption proposal." }, { status });
  }
}
