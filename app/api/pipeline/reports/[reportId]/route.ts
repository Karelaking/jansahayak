import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import {
  getReportsCollection,
  getAILogsCollection,
  getPipelineLogsCollection,
} from "@/lib/db/mongodb";

/**
 * PRD §8, §12, §16 Internal Pipeline Report Details Endpoint
 * GET /api/pipeline/reports/:reportId
 *
 * Restricts access to raw AI structured vision extractions, device metadata,
 * and internal stage execution logs to the report owner or authorized staff (moderator/admin).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const session = await getCurrentUserSession(req);

    if (!session.isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to inspect pipeline report details." },
        { status: 401 },
      );
    }

    const { reportId } = await params;
    const reportsColl = await getReportsCollection();
    const report = await reportsColl.findOne({ reportId });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Role & Ownership Verification (PRD §8 & §16)
    const isOwner = Boolean(session.userId && report.userId && session.userId === report.userId);
    const isStaff = session.role === "moderator" || session.role === "admin";

    if (!isOwner && !isStaff) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to inspect this pipeline report." },
        { status: 403 },
      );
    }

    const aiLogsColl = await getAILogsCollection();
    const aiLog = await aiLogsColl.findOne({ reportId });

    const pipelineLogsColl = await getPipelineLogsCollection();
    const jobLogs = await pipelineLogsColl.find({ reportId }).sort({ stage: 1 }).toArray();

    return NextResponse.json({
      success: true,
      report,
      aiAnalysis: aiLog?.structuredExtraction || null,
      jobLogs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
