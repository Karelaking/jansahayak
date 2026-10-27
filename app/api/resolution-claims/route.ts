import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization, submitResolutionClaim } from "@/lib/organizations";
import { db, isDatabaseReachable, resolutionClaims, incidents } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    const orgData = await getUserOrganization(session.userId);
    if (!orgData) {
      return NextResponse.json({ error: "Forbidden: You must belong to an organization to submit claims." }, { status: 403 });
    }

    const body = await req.json();
    if (!body.incidentId || !body.claimDescription) {
      return NextResponse.json({ error: "incidentId and claimDescription are required." }, { status: 400 });
    }

    const result = await submitResolutionClaim({
      incidentId: body.incidentId,
      problemAdoptionId: body.problemAdoptionId,
      organizationId: orgData.organization.id,
      submittedByUserId: session.userId,
      claimDescription: body.claimDescription,
      evidenceItems: body.evidenceItems,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    const status = error.message.includes("Only verified organizations") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to submit resolution claim." }, { status });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isDatabaseReachable())) {
      return NextResponse.json({ claims: [] });
    }

    const { searchParams } = new URL(req.url);
    const incidentId = searchParams.get("incidentId") || undefined;
    const organizationId = searchParams.get("organizationId") || undefined;

    const query = db
      .select({
        claim: resolutionClaims,
        incident: incidents,
      })
      .from(resolutionClaims)
      .innerJoin(incidents, eq(resolutionClaims.incidentId, incidents.id));

    if (incidentId) {
      const rows = await query.where(eq(resolutionClaims.incidentId, incidentId)).orderBy(desc(resolutionClaims.createdAt));
      return NextResponse.json({ claims: rows });
    }

    if (organizationId) {
      const rows = await query.where(eq(resolutionClaims.organizationId, organizationId)).orderBy(desc(resolutionClaims.createdAt));
      return NextResponse.json({ claims: rows });
    }

    const rows = await query.orderBy(desc(resolutionClaims.createdAt)).limit(50);
    return NextResponse.json({ claims: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list resolution claims." }, { status: 500 });
  }
}
