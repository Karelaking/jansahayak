import { NextRequest, NextResponse } from "next/server";
import { db, incidents, incidentVotes } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

/**
 * PRD §14B Community Votes & Public Opinion Endpoint
 * GET /api/incidents/:incidentId/votes
 *
 * Returns live community verification counts, public resolution consensus ratio,
 * and recent neighborhood voter comments.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ incidentId: string }> },
) {
  try {
    const { incidentId } = await params;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      incidentId,
    );

    const [incident] = await db
      .select({
        id: incidents.id,
        incidentNumber: incidents.incidentNumber,
        status: incidents.status,
        verificationVotesCount: incidents.verificationVotesCount,
        resolutionVotesCount: incidents.resolutionVotesCount,
        unresolvedVotesCount: incidents.unresolvedVotesCount,
        publicOpinionStatus: incidents.publicOpinionStatus,
      })
      .from(incidents)
      .where(isUuid ? eq(incidents.id, incidentId) : eq(incidents.incidentNumber, incidentId))
      .limit(1);

    if (!incident) {
      return NextResponse.json({ error: `Incident '${incidentId}' not found.` }, { status: 404 });
    }

    const recentVotes = await db
      .select({
        id: incidentVotes.id,
        voterName: incidentVotes.voterName,
        voterRole: incidentVotes.voterRole,
        voteType: incidentVotes.voteType,
        sectorName: incidentVotes.sectorName,
        comment: incidentVotes.comment,
        createdAt: incidentVotes.createdAt,
      })
      .from(incidentVotes)
      .where(eq(incidentVotes.incidentId, incident.id))
      .orderBy(desc(incidentVotes.createdAt))
      .limit(15);

    const resCount = Number(incident.resolutionVotesCount) || 0;
    const unresCount = Number(incident.unresolvedVotesCount) || 0;
    const totalRes = resCount + unresCount;
    const publicConsensusPct = totalRes > 0 ? Math.round((resCount / totalRes) * 100) : 100;

    return NextResponse.json({
      success: true,
      incidentId: incident.id,
      incidentNumber: incident.incidentNumber,
      status: incident.status,
      verificationVotesCount: Number(incident.verificationVotesCount) || 1,
      resolutionVotesCount: resCount,
      unresolvedVotesCount: unresCount,
      publicOpinionStatus: incident.publicOpinionStatus || "verified_hazard",
      publicConsensusPct,
      recentVotes,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
