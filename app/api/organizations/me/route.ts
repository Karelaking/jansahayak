import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getUserOrganization } from "@/lib/organizations";
import { db, organizations, auditLogs } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    const orgData = await getUserOrganization(session.userId);
    if (!orgData) {
      return NextResponse.json({ error: "No organization found for current user." }, { status: 404 });
    }

    return NextResponse.json(orgData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch user organization." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }

    const orgData = await getUserOrganization(session.userId);
    if (!orgData) {
      return NextResponse.json({ error: "No organization found for current user." }, { status: 404 });
    }

    if (orgData.membership.role !== "org_admin") {
      return NextResponse.json({ error: "Forbidden: Only org_admin can update organization details." }, { status: 403 });
    }

    const body = await req.json();
    const [updated] = await db
      .update(organizations)
      .set({
        displayName: body.displayName || orgData.organization.displayName,
        publicDescription: body.publicDescription !== undefined ? body.publicDescription : orgData.organization.publicDescription,
        websiteUrl: body.websiteUrl !== undefined ? body.websiteUrl : orgData.organization.websiteUrl,
        operatingLocations: body.operatingLocations || orgData.organization.operatingLocations,
        focusAreas: body.focusAreas || orgData.organization.focusAreas,
        contactEmail: body.contactEmail || orgData.organization.contactEmail,
        contactPhone: body.contactPhone !== undefined ? body.contactPhone : orgData.organization.contactPhone,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgData.organization.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update organization.");
    }

    await db.insert(auditLogs).values({
      actorUserId: session.userId,
      actorOrganizationId: orgData.organization.id,
      entityType: "organization",
      entityId: orgData.organization.id,
      action: "ORGANIZATION_UPDATED",
      beforeSummary: JSON.stringify({ displayName: orgData.organization.displayName }),
      afterSummary: JSON.stringify({ displayName: updated.displayName }),
      reason: "Updated organization profile",
    });

    return NextResponse.json({ organization: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update organization." }, { status: 400 });
  }
}
