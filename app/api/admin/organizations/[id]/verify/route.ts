import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { reviewOrganizationVerification } from "@/lib/organizations";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    if (session.role !== "admin" && session.role !== "moderator") {
      return NextResponse.json(
        { error: "Forbidden: Only platform administrators or moderators can verify organizations." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    if (!["verified", "rejected", "needs_more_information"].includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status: Must be 'verified', 'rejected', or 'needs_more_information'." },
        { status: 400 },
      );
    }

    const updated = await reviewOrganizationVerification({
      organizationId: id,
      reviewerId: session.userId,
      status: body.status,
      decisionReason: body.decisionReason || "Platform administrative review decision",
    });

    return NextResponse.json({ organization: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to review organization." }, { status: 400 });
  }
}
