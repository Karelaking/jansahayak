import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { db, incidents, incidentVotes, outboxEvents } from "@/lib/db";
import { calculateGeodesicDistanceMeters } from "@/lib/pipeline/location-verification";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { eq, and, sql } from "drizzle-orm";

/**
 * PRD §14B Community Hazard Verification & Resolution Voting Endpoint
 * POST /api/incidents/:incidentId/vote
 *
 * Allows neighborhood residents and the original reporter to:
 * 1. Verify hazard existence ('verify_hazard')
 * 2. Confirm physical repair completion ('confirm_resolved')
 * 3. Report persistent defects or failed contractor patches ('still_unresolved')
 * 4. Subscribe to automated project progress notifications ('wantsUpdates')
 *
 * Evaluates public community consensus to gate official incident resolution status.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ incidentId: string }> },
) {
  try {
    const { incidentId } = await params;
    const session = await getCurrentUserSession(req);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    // PRD §17 Rate Limiting for Community Voting Gateway (Anti-ballot stuffing)
    const rateLimit = checkRateLimit(`vote_${clientIp}`, { limit: 30, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Too many community votes submitted from this network. Please try again later.",
          remaining: rateLimit.remaining,
          resetMs: rateLimit.resetMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateLimit.resetMs / 1000).toString(),
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          },
        },
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const voteType = body.voteType as string;
    if (
      !voteType ||
      !["verify_hazard", "confirm_resolved", "still_unresolved"].includes(voteType)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid voteType. Permitted values: 'verify_hazard', 'confirm_resolved', 'still_unresolved'.",
        },
        { status: 400 },
      );
    }

    // 1. Verify target incident exists
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      incidentId,
    );

    const [incident] = await db
      .select()
      .from(incidents)
      .where(isUuid ? eq(incidents.id, incidentId) : eq(incidents.incidentNumber, incidentId))
      .limit(1);

    if (!incident) {
      return NextResponse.json({ error: `Incident '${incidentId}' not found.` }, { status: 404 });
    }

    const resolvedIncidentId = incident.id;

    // 2. Resolve voter identity
    const voterEmail = (body.voterEmail as string) || session.email || undefined;
    const voterName = (body.voterName as string) || session.fullName || undefined;
    const voterIdentifier = session.isAuthenticated
      ? session.userId
      : voterEmail || `ip_${clientIp}`;

    const voterRole =
      (body.voterRole as "reporter" | "local_resident" | "commuter") || "local_resident";
    const comment = (body.comment as string)?.trim() || null;
    const sectorName = (body.sectorName as string)?.trim() || null;
    const wantsUpdates = Boolean(body.wantsUpdates);
    const latitude = body.latitude ? String(body.latitude) : null;
    const longitude = body.longitude ? String(body.longitude) : null;

    // PRD §14B Geodesic Proximity Qualification (500m radius):
    let isLocalResident = true;
    if (body.isLocalResident !== undefined) {
      isLocalResident = Boolean(body.isLocalResident);
    }

    if (latitude && longitude && incident.latitude && incident.longitude) {
      const vLat = parseFloat(latitude);
      const vLng = parseFloat(longitude);
      const incLat = parseFloat(String(incident.latitude));
      const incLng = parseFloat(String(incident.longitude));

      if (
        Number.isFinite(vLat) &&
        Number.isFinite(vLng) &&
        Number.isFinite(incLat) &&
        Number.isFinite(incLng)
      ) {
        const distanceMeters = calculateGeodesicDistanceMeters(vLat, vLng, incLat, incLng);
        // Residents and commuters within 500m of the centroid qualify for local consensus quorum
        isLocalResident = distanceMeters <= 500;
      }
    }

    // 3. Idempotency Check: Prevent duplicate votes of the same type by the same voter
    const [existingVote] = await db
      .select()
      .from(incidentVotes)
      .where(
        and(
          eq(incidentVotes.incidentId, resolvedIncidentId),
          eq(incidentVotes.voterIdentifier, voterIdentifier),
          eq(incidentVotes.voteType, voteType),
        ),
      )
      .limit(1);

    if (existingVote) {
      return NextResponse.json({
        success: true,
        message: "You have already cast this community vote for this hazard.",
        alreadyVoted: true,
        vote: existingVote,
        incident: {
          id: incident.id,
          status: incident.status,
          verificationVotesCount: incident.verificationVotesCount,
          resolutionVotesCount: incident.resolutionVotesCount,
          unresolvedVotesCount: incident.unresolvedVotesCount,
          publicOpinionStatus: incident.publicOpinionStatus,
        },
      });
    }

    // 4. Insert vote record
    const [insertedVote] = await db
      .insert(incidentVotes)
      .values({
        incidentId: resolvedIncidentId,
        voterIdentifier,
        voterName,
        voterRole,
        voteType,
        comment,
        sectorName,
        latitude,
        longitude,
        isLocalResident,
        wantsUpdates,
        voterEmail: voterEmail || null,
      })
      .returning();

    // 5. Update incident counters atomically
    let countFieldUpdate: Record<string, ReturnType<typeof sql>>;
    if (voteType === "verify_hazard") {
      countFieldUpdate = { verificationVotesCount: sql`${incidents.verificationVotesCount} + 1` };
    } else if (voteType === "confirm_resolved") {
      countFieldUpdate = { resolutionVotesCount: sql`${incidents.resolutionVotesCount} + 1` };
    } else {
      countFieldUpdate = { unresolvedVotesCount: sql`${incidents.unresolvedVotesCount} + 1` };
    }

    const [updatedIncident] = await db
      .update(incidents)
      .set({
        ...countFieldUpdate,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, resolvedIncidentId))
      .returning();

    if (!updatedIncident) {
      return NextResponse.json({ error: "Failed to update incident counters" }, { status: 500 });
    }

    // 6. Public Community Consensus Evaluation (PRD §14B)
    const resCount = Number(updatedIncident.resolutionVotesCount) || 0;
    const unresCount = Number(updatedIncident.unresolvedVotesCount) || 0;
    const totalResolutionVotes = resCount + unresCount;
    const positiveRatio = totalResolutionVotes > 0 ? resCount / totalResolutionVotes : 0;

    let newStatus = updatedIncident.status;
    let newPublicOpinionStatus = updatedIncident.publicOpinionStatus;

    // Consensus Rule A: 3+ local resident confirmation votes with >= 75% positive ratio marks incident resolved
    if (resCount >= 3 && positiveRatio >= 0.75) {
      newStatus = "resolved";
      newPublicOpinionStatus = "community_resolved";

      await db
        .update(incidents)
        .set({
          status: newStatus,
          publicOpinionStatus: newPublicOpinionStatus,
          updatedAt: new Date(),
        })
        .where(eq(incidents.id, resolvedIncidentId));

      await db.insert(outboxEvents).values({
        eventType: "incident.community_resolved",
        aggregateType: "incident",
        aggregateId: resolvedIncidentId,
        payload: {
          incidentId: resolvedIncidentId,
          resolutionVotesCount: resCount,
          positiveRatio,
          message: "Hazard marked resolved by community consensus",
        },
      });
    }
    // Consensus Rule B: 2+ community dispute votes while previously resolved/in-progress reopens hazard
    else if (unresCount >= 2 && positiveRatio < 0.6) {
      if (updatedIncident.status === "resolved" || updatedIncident.status === "under_review") {
        newStatus = "in_progress";
        newPublicOpinionStatus = "reopened_by_community";

        await db
          .update(incidents)
          .set({
            status: newStatus,
            publicOpinionStatus: newPublicOpinionStatus,
            updatedAt: new Date(),
          })
          .where(eq(incidents.id, resolvedIncidentId));

        await db.insert(outboxEvents).values({
          eventType: "incident.reopened_by_community",
          aggregateType: "incident",
          aggregateId: resolvedIncidentId,
          payload: {
            incidentId: resolvedIncidentId,
            unresolvedVotesCount: unresCount,
            message: "Hazard reopened due to local community dispute votes",
          },
        });
      }
    }

    // 7. If voter opted into progress updates, record outbox subscription
    if (wantsUpdates && (voterEmail || session.email)) {
      await db.insert(outboxEvents).values({
        eventType: "voter.subscribed_to_updates",
        aggregateType: "incident",
        aggregateId: resolvedIncidentId,
        payload: {
          incidentId: resolvedIncidentId,
          voterEmail: voterEmail || session.email,
          voterName,
          voteType,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Community verification vote recorded successfully.",
      vote: insertedVote,
      incident: {
        id: incidentId,
        incidentNumber: updatedIncident.incidentNumber,
        status: newStatus,
        verificationVotesCount: updatedIncident.verificationVotesCount,
        resolutionVotesCount: resCount,
        unresolvedVotesCount: unresCount,
        publicOpinionStatus: newPublicOpinionStatus,
        publicConsensusRatio: positiveRatio,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
