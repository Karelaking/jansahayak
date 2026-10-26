import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { POST as submitReport } from "@/app/api/pipeline/submit/route";
import { getReportsCollection } from "@/lib/db/mongodb";

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

    const reportsColl = await getReportsCollection();
    const query: Record<string, unknown> = {};

    const isStaff = session.role === "moderator" || session.role === "admin";
    const scope = searchParams.get("scope");

    // PRD §2 & §16 Privacy Isolation & Staff Scope:
    // Regular citizens are strictly isolated to their own filed reports.
    // Authorized municipal staff can inspect all reports across Greater Noida unless scope=mine is specified.
    if (!isStaff || scope === "mine") {
      if (session.isAuthenticated && session.userId) {
        query.userId = session.userId;
      }
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
      })
      .toArray();

    const formattedReports = reports.map((r) => {
      const photos = (r.evidencePhotos || []).map(
        (p: { filename?: string; byteSize?: number; fileId?: string }) => ({
          filename: p.filename || "evidence.jpg",
          byteSize: p.byteSize || 0,
          downloadUrl: p.fileId ? `/api/pipeline/photos/${p.fileId}` : undefined,
        }),
      );

      // PRD §12 & §13: Mask/omit citizen userId for unauthenticated or unauthorized public callers
      const canViewUserId = isStaff || (session.isAuthenticated && session.userId === r.userId);
      const safeUserId = canViewUserId ? r.userId : undefined;

      return {
        ...r,
        userId: safeUserId,
        photoCount: photos.length,
        photos,
      };
    });

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
