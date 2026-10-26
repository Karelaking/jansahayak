import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { db, incidents } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

/**
 * PRD §1, §13, §16 Pipeline Incidents Endpoint
 * GET /api/pipeline/incidents
 *
 * Enforces strict public privacy: unauthenticated and citizen callers can ONLY view
 * published incidents (isPublished = true). Access to unpublished, under-review,
 * or rejected incident queues is restricted exclusively to authorized staff (moderator/admin).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    const isStaff = session.role === "moderator" || session.role === "admin";

    const { searchParams } = new URL(req.url);
    const publishedParam = searchParams.get("published");
    const status = searchParams.get("status");

    // Non-staff callers requesting unpublished incidents or non-published statuses are blocked (PRD §1 & §16)
    if (!isStaff) {
      if (
        publishedParam === "false" ||
        (status && status !== "published" && status !== "resolved")
      ) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Only authorized civic staff can inspect unpublished or internal review incidents.",
          },
          { status: 403 },
        );
      }
    }

    let query = db.select().from(incidents).orderBy(desc(incidents.createdAt)).$dynamic();

    if (!isStaff || publishedParam === "true") {
      // Strictly enforce published-only for public and citizen requests
      query = query.where(eq(incidents.isPublished, true));
    } else if (status) {
      query = query.where(eq(incidents.status, status));
    }

    const rows = await query.limit(50);

    return NextResponse.json({
      success: true,
      count: rows.length,
      incidents: rows,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
