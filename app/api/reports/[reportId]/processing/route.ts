import { NextRequest, NextResponse } from "next/server";
import { getReportsCollection, getPipelineLogsCollection } from "@/lib/db/mongodb";
import { db, incidents } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * PRD §3 & §16 Report Processing Progress Endpoint
 * GET /api/reports/:reportId/processing
 *
 * Provides real-time, sanitized pipeline processing state for polling clients:
 * report existence check, current status, rejectionReason, computed currentStage,
 * and sanitized stage progression logs.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;
    const reportsColl = await getReportsCollection();

    // 1. Verify report existence in MongoDB
    let reportDoc = await reportsColl.findOne(
      { reportId },
      { projection: { reportId: 1, status: 1, rejectionReason: 1, updatedAt: 1, createdAt: 1 } },
    );

    // Fallback: Check by associatedIncidentId in MongoDB
    if (!reportDoc) {
      reportDoc = await reportsColl.findOne(
        { associatedIncidentId: reportId },
        { projection: { reportId: 1, status: 1, rejectionReason: 1, updatedAt: 1, createdAt: 1 } },
      );
    }

    // Fallback: Check if reportId is an incident in PostgreSQL
    if (!reportDoc) {
      try {
        const [inc] = await db.select().from(incidents).where(eq(incidents.id, reportId)).limit(1);

        if (inc) {
          return NextResponse.json({
            success: true,
            reportId: inc.incidentNumber,
            status: inc.isPublished ? "PUBLISHED" : inc.status.toUpperCase(),
            rejectionReason: inc.rejectionReason || null,
            currentStage: inc.isPublished ? 8 : 7,
            stages: [
              {
                stage: 8,
                stageName: "Map Publication",
                status: inc.isPublished ? "SUCCESS" : "PENDING",
                timestamp: inc.updatedAt.toISOString(),
              },
            ],
            updatedAt: inc.updatedAt.toISOString(),
          });
        }
      } catch {
        // Fallback continues
      }

      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 2. Fetch and sanitize stage execution logs from MongoDB
    const logsColl = await getPipelineLogsCollection();
    const jobLogs = await logsColl
      .find({ reportId: reportDoc.reportId })
      .project({ stage: 1, stageName: 1, status: 1, details: 1, timestamp: 1 })
      .sort({ stage: 1 })
      .toArray();

    const sanitizedStages = jobLogs.map((l: Record<string, unknown>) => ({
      stage: l.stage,
      stageName: l.stageName,
      status: l.status,
      timestamp: l.timestamp,
      details: l.details,
    }));

    // 3. Compute current active or completed stage
    const lastExecutedStage =
      sanitizedStages.length > 0 ? sanitizedStages[sanitizedStages.length - 1]?.stage || 1 : 1;

    return NextResponse.json({
      success: true,
      reportId: reportDoc.reportId,
      status: reportDoc.status,
      rejectionReason: reportDoc.rejectionReason || null,
      currentStage: lastExecutedStage,
      stages: sanitizedStages,
      updatedAt: reportDoc.updatedAt || reportDoc.createdAt || new Date().toISOString(),
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
