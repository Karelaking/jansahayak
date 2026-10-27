import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, withdrawAdoption } from "@/lib/organizations";

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
    const reason = body.reason || "Withdrawn by adopting organization.";

    const updated = await withdrawAdoption({
      adoptionId: id,
      organizationId: orgData.organization.id,
      userId: session.userId,
      reason,
    });

    return NextResponse.json({
      adoption: updated,
      message: "Adoption successfully withdrawn. The incident remains open for civic intervention.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to withdraw adoption." }, { status: 400 });
  }
}
