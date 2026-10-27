import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { finalizeVerificationCase } from "@/lib/organizations";

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
        { error: "Forbidden: Only platform moderators or admins can finalize verification cases." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body optional
    }

    const result = await finalizeVerificationCase({
      verificationCaseId: id,
      finalizedBy: session.userId,
      forceOutcome: body?.forceOutcome,
      overrideReason: body?.overrideReason,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to finalize verification." }, { status: 400 });
  }
}
