import { NextRequest, NextResponse } from "next/server";
import { getOrganizationById } from "@/lib/organizations";
import { db, impactAttributions, incidents, problemAdoptions } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const org = await getOrganizationById(id);
    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    const [resolvedCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(impactAttributions)
      .innerJoin(incidents, eq(impactAttributions.incidentId, incidents.id))
      .where(
        and(
          eq(impactAttributions.organizationId, id),
          eq(impactAttributions.status, "verified"),
          eq(incidents.status, "resolved"),
        ),
      );

    const [spendRow] = await db
      .select({ totalSpend: sql<number>`coalesce(sum(estimated_cost::numeric), 0)::float` })
      .from(problemAdoptions)
      .where(
        and(
          eq(problemAdoptions.organizationId, id),
          sql`${problemAdoptions.status} in ('approved', 'in_progress', 'completed')`,
        ),
      );

    const [activeAdoptionsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(problemAdoptions)
      .where(
        and(
          eq(problemAdoptions.organizationId, id),
          sql`${problemAdoptions.status} in ('approved', 'in_progress')`,
        ),
      );

    return NextResponse.json({
      organizationId: id,
      organizationName: org.displayName,
      verifiedResolutionsCount: Number(resolvedCountRow?.count || 0),
      totalEstimatedInvestmentInr: Number(spendRow?.totalSpend || 0),
      activeAdoptionsCount: Number(activeAdoptionsRow?.count || 0),
      verificationStatus: org.verificationStatus,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch organization impact." }, { status: 500 });
  }
}
