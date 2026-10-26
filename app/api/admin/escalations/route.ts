import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { db, incidents, moderationActions } from "@/lib/db";
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
      const isUnderRepair =
        inc.status === "under_review" || inc.publicOpinionStatus === "under_repair";
      const isDisputed =
        inc.publicOpinionStatus === "reopened_by_community" ||
        inc.publicOpinionStatus === "public_disputed";

      const resVotes = Number(inc.resolutionVotesCount) || 0;
      const unresVotes = Number(inc.unresolvedVotesCount) || 0;
      const totalVotes = resVotes + unresVotes;
      const consensusPercentage = totalVotes > 0 ? Math.round((resVotes / totalVotes) * 100) : 0;

      let status: EscalationDocket["status"] = "awaiting-response";
      let statusLabel = "Awaiting Municipal Response";
      let statusVariant: EscalationDocket["statusVariant"] = "destructive";

      if (isDisputed) {
        status = "in-progress";
        statusLabel = "Community Dispute: Reopened for Re-repair";
        statusVariant = "destructive";
      } else if (isResolved) {
        status = "resolved";
        statusLabel = "Remediation Complete";
        statusVariant = "default";
      } else if (isUnderRepair) {
        status = "in-progress";
        statusLabel = `Under Repair (${consensusPercentage}% Community Consensus)`;
        statusVariant = "secondary";
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
        resolutionVotesCount: resVotes,
        unresolvedVotesCount: unresVotes,
        publicOpinionStatus: inc.publicOpinionStatus || "verified_hazard",
        consensusPercentage,
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

/**
 * PRD §14 & §16 Authority Escalations Update Gateway
 * POST /api/admin/escalations
 *
 * Persists official correspondence, status transitions (e.g. resolved, in-progress, acknowledged),
 * and assigned officer notes into PostgreSQL with an immutable audit trail.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);

    if (session.role !== "moderator" && session.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only designated moderators or administrators can update authority escalations.",
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const incidentId = body.incidentId as string;
    const status = (body.status || body.newStatus) as string | undefined;
    const officialNote = (body.officialNote || body.officialReply) as string | undefined;
    const officer = (body.officer || body.assignedOfficer) as string | undefined;

    if (!incidentId) {
      return NextResponse.json(
        { error: "Missing required parameter: incidentId." },
        { status: 400 },
      );
    }

    // 1. Fetch current incident (support either UUID id or incidentNumber)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      incidentId,
    );

    const [existing] = await db
      .select()
      .from(incidents)
      .where(isUuid ? eq(incidents.id, incidentId) : eq(incidents.incidentNumber, incidentId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: `Incident ${incidentId} not found.` }, { status: 404 });
    }

    // 2. Prepare metadata updates
    const currentMeta = (existing.metadata || {}) as Record<string, unknown>;
    const escalationHistory = Array.isArray(currentMeta.escalationHistory)
      ? [...currentMeta.escalationHistory]
      : [];

    const nowIso = new Date().toISOString();

    if (officialNote) {
      escalationHistory.push({
        authorId: session.userId,
        authorRole: session.role,
        note: officialNote,
        officer: officer || currentMeta.assignedOfficer || "Executive Engineer",
        timestamp: nowIso,
      });
    }

    let updatedIncidentStatus = existing.status;
    let newPublicOpinionStatus = existing.publicOpinionStatus;
    let isEmergencyOverride = false;
    let transitionMessage = `Status updated to ${status}`;

    if (status === "resolved") {
      isEmergencyOverride = Boolean(body.isEmergencyOverride);
      const overrideReason = (body.overrideReason as string)?.trim() || "";

      if (isEmergencyOverride) {
        if (!overrideReason || overrideReason.length < 10) {
          return NextResponse.json(
            {
              error:
                "Emergency administrative override requires a documented reason of at least 10 characters.",
            },
            { status: 400 },
          );
        }
        updatedIncidentStatus = "resolved";
        newPublicOpinionStatus = "community_resolved";
        transitionMessage = "Emergency administrative override: Incident marked resolved by staff.";
      } else {
        // PRD §14B Public-Opinion Consensus Gating Check
        const resVotes = Number(existing.resolutionVotesCount) || 0;
        const unresVotes = Number(existing.unresolvedVotesCount) || 0;
        const totalVotes = resVotes + unresVotes;
        const ratio = totalVotes > 0 ? resVotes / totalVotes : 0;
        const consensusMet = resVotes >= 3 && ratio >= 0.75;

        if (consensusMet) {
          updatedIncidentStatus = "resolved";
          newPublicOpinionStatus = "community_resolved";
          transitionMessage =
            "Community consensus threshold met: Hazard confirmed resolved by local residents.";
        } else {
          // Gated by PRD §14B: Municipal department marks completion -> transitions to under_review / under_repair to invite resident consensus
          updatedIncidentStatus = "under_review";
          newPublicOpinionStatus = "under_repair";
          transitionMessage =
            "Municipal repair reported. Transitioned to Community Verification stage; awaiting citizen consensus.";
        }
      }
    } else if (status === "in-progress" || status === "in_progress") {
      updatedIncidentStatus = "in_progress";
      if (existing.publicOpinionStatus === "community_resolved") {
        newPublicOpinionStatus = "public_disputed";
      }
    } else if (status === "acknowledged") {
      updatedIncidentStatus = "in_progress";
    }

    const updatedMetadata = {
      ...currentMeta,
      lastOfficialNote: officialNote || currentMeta.lastOfficialNote,
      assignedOfficer: officer || currentMeta.assignedOfficer || "Executive Engineer",
      lastEscalationUpdate: nowIso,
      escalationHistory,
    };

    // 3. Atomically update PostgreSQL incident record
    const [updated] = await db
      .update(incidents)
      .set({
        status: updatedIncidentStatus,
        publicOpinionStatus: newPublicOpinionStatus,
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, incidentId))
      .returning();

    // 4. Record immutable audit entry in moderation_actions
    await db.insert(moderationActions).values({
      incidentId,
      moderatorId: session.userId,
      action: isEmergencyOverride
        ? "emergency_resolution_override"
        : status
          ? `escalation_status_${status}`
          : "escalation_officer_note",
      reason:
        officialNote ||
        (isEmergencyOverride
          ? (body.overrideReason as string)
          : `Escalation status shifted to ${status}`),
      notes: officialNote || transitionMessage,
      metadata: {
        previousStatus: existing.status,
        newStatus: updatedIncidentStatus,
        officer: officer || currentMeta.assignedOfficer,
        transitionMessage,
        updatedAt: nowIso,
      },
    });

    return NextResponse.json({
      success: true,
      incidentId,
      status: updatedIncidentStatus,
      message: transitionMessage,
      updatedAt: nowIso,
      incident: updated,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
