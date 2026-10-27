import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { POST as submitReport } from "@/app/api/pipeline/submit/route";
import { getReportsCollection } from "@/lib/db/mongodb";
import { reverseGeocode } from "@/lib/geo/reverse-geocode";

/**
 * PRD §16 Reports Endpoint
 * POST /api/reports: Standard intake for citizen hazard reports.
 * GET /api/reports: Fetch citizen submissions (user-scoped or recent public).
 */
export async function POST(req: NextRequest) {
  return submitReport(req);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const rawIds = searchParams.get("ids");
    const requestedIds = rawIds ? rawIds.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const reportsColl = await getReportsCollection();
    const query: Record<string, unknown> = {};

    const isStaff = session.role === "moderator" || session.role === "admin";
    const scope = searchParams.get("scope");

    // PRD §2 & §16 Privacy Isolation & Staff Scope:
    // Non-staff citizens can strictly ONLY view reports they submitted.
    // Authorized municipal staff can inspect all reports across Greater Noida unless scope=mine is specified.
    if (!isStaff) {
      const orClauses: Record<string, unknown>[] = [];
      if (session.isAuthenticated && session.userId) {
        orClauses.push({ userId: session.userId });
      }
      if (requestedIds.length > 0) {
        orClauses.push({ reportId: { $in: requestedIds } });
      }

      // If a non-staff caller has neither an authenticated session nor local report IDs, return empty immediately.
      if (orClauses.length === 0) {
        return NextResponse.json({
          success: true,
          count: 0,
          reports: [],
        });
      }

      query.$or = orClauses;
    } else if (scope === "mine") {
      const orClauses: Record<string, unknown>[] = [];
      if (session.isAuthenticated && session.userId) {
        orClauses.push({ userId: session.userId });
      }
      if (requestedIds.length > 0) {
        orClauses.push({ reportId: { $in: requestedIds } });
      }

      if (orClauses.length === 0) {
        return NextResponse.json({
          success: true,
          count: 0,
          reports: [],
        });
      }

      query.$or = orClauses;
    }

    const reports = await reportsColl
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .project({
        _id: 1,
        reportId: 1,
        userId: 1,
        category: 1,
        description: 1,
        status: 1,
        createdAt: 1,
        submissionLocation: 1,
        evidencePhotos: 1,
        associatedIncidentId: 1,
        deviceMetadata: 1,
      })
      .toArray();

    const formattedReports = await Promise.all(
      reports.map(async (r: Record<string, any>) => {
        const photos = (r.evidencePhotos || []).map(
          (p: { filename?: string; byteSize?: number; fileId?: string }) => ({
            filename: p.filename || "evidence.jpg",
            byteSize: p.byteSize || 0,
            downloadUrl: p.fileId ? `/api/pipeline/photos/${p.fileId}` : undefined,
          }),
        );

        // PRD §12 & §13: Mask/omit citizen userId for unauthenticated or unauthorized public callers
        const isOwner = (session.isAuthenticated && session.userId === r.userId) || requestedIds.includes(r.reportId);
        const canViewUserId = isStaff || isOwner;
        const safeUserId = canViewUserId ? r.userId : undefined;

        const rawLoc = (r.submissionLocation || {}) as Record<string, unknown>;
        let landmark =
          (rawLoc.landmark as string) ||
          (rawLoc.address as string) ||
          ((r.deviceMetadata as Record<string, unknown> | undefined)?.landmark as string) ||
          undefined;

        if (!landmark && typeof rawLoc.latitude === "number" && typeof rawLoc.longitude === "number") {
          landmark = await reverseGeocode(rawLoc.latitude, rawLoc.longitude);
        }

        return {
          ...r,
          userId: safeUserId,
          submissionLocation: {
            ...rawLoc,
            landmark,
            address: landmark,
          },
          location: {
            ...rawLoc,
            landmark,
            address: landmark,
          },
          photoCount: photos.length,
          photos,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      count: formattedReports.length,
      reports: formattedReports,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isConnRefused = msg.includes("ECONNREFUSED") || msg.includes("connect");
    return NextResponse.json(
      {
        error: isConnRefused ? "Database connection unavailable" : msg,
        isRetryable: isConnRefused,
      },
      { status: isConnRefused ? 503 : 500 },
    );
  }
}
