import { NextRequest, NextResponse } from "next/server";
import { db, isDatabaseReachable, verificationCases, citizenVerificationVotes, resolutionClaims, incidents } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isDatabaseReachable())) {
      return NextResponse.json({ error: "Database temporarily unavailable." }, { status: 503 });
    }

    const { id } = await context.params;

    const [vCase] = await db
      .select()
      .from(verificationCases)
      .where(eq(verificationCases.id, id))
      .limit(1);

    if (!vCase) {
      return NextResponse.json({ error: "Verification case not found." }, { status: 404 });
    }

    const [claim] = await db
      .select()
      .from(resolutionClaims)
      .where(eq(resolutionClaims.id, vCase.resolutionClaimId))
      .limit(1);

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, vCase.incidentId))
      .limit(1);

    const votes = await db
      .select({
        id: citizenVerificationVotes.id,
        vote: citizenVerificationVotes.vote,
        explanation: citizenVerificationVotes.explanation,
        evidenceUrl: citizenVerificationVotes.evidenceUrl,
        isLocalResident: citizenVerificationVotes.isLocalResident,
        createdAt: citizenVerificationVotes.createdAt,
      })
      .from(citizenVerificationVotes)
      .where(eq(citizenVerificationVotes.verificationCaseId, id));

    let resolvedCount = 0;
    let notResolvedCount = 0;
    let cannotVerifyCount = 0;

    for (const v of votes) {
      if (v.vote === "RESOLVED") resolvedCount++;
      else if (v.vote === "NOT_RESOLVED") notResolvedCount++;
      else if (v.vote === "CANNOT_VERIFY") cannotVerifyCount++;
    }

    const decisiveCount = resolvedCount + notResolvedCount;
    const consensusPct = decisiveCount > 0 ? (resolvedCount / decisiveCount) * 100 : 0;

    return NextResponse.json({
      verificationCase: vCase,
      claim,
      incident,
      stats: {
        totalVotes: votes.length,
        resolvedCount,
        notResolvedCount,
        cannotVerifyCount,
        decisiveCount,
        consensusPct: Math.round(consensusPct * 10) / 10,
        meetsMinimumParticipation: decisiveCount >= vCase.minimumParticipation,
        meetsConsensusThreshold: consensusPct >= parseFloat(vCase.consensusThresholdPct),
      },
      votes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch verification case." }, { status: 500 });
  }
}
