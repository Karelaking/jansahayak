import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { dispatchMunicipalReportEmail } from "@/lib/email/municipal-dispatcher";
import { db, incidents } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * PRD §14 & §16 Admin Municipal Dossier Dispatch Endpoint
 * POST /api/admin/incidents/:incidentId/dispatch-municipal
 *
 * Compiles and emails the official Municipal Civic Grievance Dossier to the local
 * municipality for an approved/published canonical incident.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ incidentId: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);

    // Verify staff authorization
    if (session.role !== "moderator" && session.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only designated moderators or administrators can dispatch municipal dossiers.",
        },
        { status: 403 },
      );
    }

    const { incidentId } = await params;

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    if (!incident) {
      return NextResponse.json({ error: `Incident '${incidentId}' not found.` }, { status: 404 });
    }

    // Must be approved before dispatching to municipality
    if (incident.status !== "approved" && !incident.isPublished) {
      return NextResponse.json(
        {
          error:
            "Cannot dispatch to municipality: Incident must be moderation-approved or published before municipal dispatch.",
        },
        { status: 400 },
      );
    }

    const dispatchResult = await dispatchMunicipalReportEmail(incidentId);

    if (!dispatchResult.success) {
      return NextResponse.json(
        { error: dispatchResult.error || "Failed to dispatch municipal email." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      incidentId,
      docketNumber: dispatchResult.docketNumber,
      recipient: dispatchResult.recipient,
      message: `Municipal dossier successfully dispatched to ${dispatchResult.recipient}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
