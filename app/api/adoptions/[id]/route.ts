import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getAdoptionById, updateAdoptionStatus } from "@/lib/organizations";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const adoption = await getAdoptionById(id);
    if (!adoption) {
      return NextResponse.json({ error: "Adoption not found." }, { status: 404 });
    }

    return NextResponse.json(adoption);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch adoption." }, { status: 500 });
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

    const { id } = await context.params;
    const body = await req.json();

    const updated = await updateAdoptionStatus({
      adoptionId: id,
      status: body.status,
      reviewerUserId: session.userId,
      rejectionReason: body.rejectionReason,
    });

    return NextResponse.json({ adoption: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update adoption status." }, { status: 400 });
  }
}
