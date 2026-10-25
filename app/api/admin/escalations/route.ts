import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { db, incidents } from "@/lib/db";
import { desc, or, eq, sql } from "drizzle-orm";
import type { EscalationDocket } from "@/lib/types/hazard";

/**
 * PRD §14 & §16 Authority Escalations Endpoint
 * GET /api/admin/escalations
 *
 * Fetches real database-backed municipal escalation dockets and dispatched civic reports
 * for administrative tracking and SLA monitoring.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);

    if (session.role !== "moderator" && session.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only designated moderators or administrators can access municipal escalations.",
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Query incidents with municipal dockets or published status
    const rows = await db
      .select()
      .from(incidents)
      .where(
        or(
          sql`${incidents.metadata}->>'municipalDocketNumber' IS NOT NULL`,
          eq(incidents.isPublished, true),
          eq(incidents.status, "approved"),
        ),
      )
      .orderBy(desc(incidents.updatedAt))
      .limit(limit);

    const escalations: EscalationDocket[] = rows.map((inc) => {
      const meta = (inc.metadata || {}) as Record<string, unknown>;
      const daysOpen = Math.max(
        1,
        Math.floor((Date.now() - new Date(inc.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      );

      const hasDispatched = Boolean(meta.municipalDocketNumber);
      const isResolved = inc.status === "resolved";

      let status: EscalationDocket["status"] = "awaiting-response";
      let statusLabel = "Awaiting Municipal Response";
      let statusVariant: EscalationDocket["statusVariant"] = "destructive";

      if (isResolved) {
        status = "resolved";
        statusLabel = "Remediation Complete";
        statusVariant = "default";
      } else if (hasDispatched) {
        status = "acknowledged";
        statusLabel = `Docket: ${meta.municipalDocketNumber}`;
        statusVariant = "secondary";
      } else {
        status = "in-progress";
        statusLabel = "Pending Dispatch";
        statusVariant = "secondary";
      }

      const dispatchedAt = meta.municipalDispatchedAt as string | undefined;
      const lastUpdate = dispatchedAt
        ? `Emailed to ${meta.municipalRecipient || "Municipality"} on ${new Date(dispatchedAt).toLocaleDateString()}`
        : `Verified canonical incident ${inc.incidentNumber}`;

      return {
        id: inc.id,
        title: `${inc.category} — ${inc.incidentNumber}`,
        summary: inc.summary || inc.title,
        authority:
          (meta.municipalRecipient as string) ||
          "Greater Noida Industrial Development Authority (GNIDA)",
        officer: "Executive Engineer (Civil/Roads)",
        status,
        statusLabel,
        statusVariant,
        daysOpen,
        linkedReports: inc.reportCount || 1,
        lastUpdate,
        originReportId: inc.incidentNumber,
      };
    });

    return NextResponse.json({
      success: true,
      count: escalations.length,
      escalations,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
