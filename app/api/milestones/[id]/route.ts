import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, updateProjectMilestone } from "@/lib/organizations";

export async function PATCH(
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
      return NextResponse.json({ error: "No organization found for current user." }, { status: 404 });
    }

    const body = await req.json();
    const updated = await updateProjectMilestone({
      milestoneId: id,
      organizationId: orgData.organization.id,
      userId: session.userId,
      status: body.status,
      completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
      evidenceReferences: body.evidenceReferences,
    });

    return NextResponse.json({ milestone: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update milestone." }, { status: 400 });
  }
}
