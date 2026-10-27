import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, addProjectMilestone } from "@/lib/organizations";

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
      return NextResponse.json({ error: "No organization found for current user." }, { status: 404 });
    }

    const body = await req.json();
    if (!body.title) {
      return NextResponse.json({ error: "Milestone title is required." }, { status: 400 });
    }

    const milestone = await addProjectMilestone({
      adoptionId: id,
      organizationId: orgData.organization.id,
      userId: session.userId,
      title: body.title,
      description: body.description,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    });

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to add milestone." }, { status: 400 });
  }
}
