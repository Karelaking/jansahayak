import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { openVerificationCase } from "@/lib/organizations";

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
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const vCase = await openVerificationCase({
      resolutionClaimId: id,
      durationHours: body?.durationHours,
      minimumParticipation: body?.minimumParticipation,
      consensusThresholdPct: body?.consensusThresholdPct,
    });

    return NextResponse.json({ verificationCase: vCase }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to open verification case." }, { status: 400 });
  }
}
