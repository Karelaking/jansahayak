import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { castCitizenVote } from "@/lib/organizations";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json(
        { error: "Authentication required: Anonymous voting is prohibited." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    if (!body.vote || !["RESOLVED", "NOT_RESOLVED", "CANNOT_VERIFY"].includes(body.vote)) {
      return NextResponse.json(
        { error: "Invalid vote: Must be 'RESOLVED', 'NOT_RESOLVED', or 'CANNOT_VERIFY'." },
        { status: 400 },
      );
    }

    const voteRow = await castCitizenVote({
      verificationCaseId: id,
      userId: session.userId,
      vote: body.vote,
      explanation: body.explanation,
      evidenceUrl: body.evidenceUrl,
      latitude: body.latitude !== undefined ? parseFloat(body.latitude) : undefined,
      longitude: body.longitude !== undefined ? parseFloat(body.longitude) : undefined,
    });

    return NextResponse.json({ vote: voteRow }, { status: 201 });
  } catch (error: any) {
    if (error.message.includes("Duplicate vote")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message.includes("Conflict of interest")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Failed to record vote." }, { status: 400 });
  }
}
