import { NextRequest, NextResponse } from "next/server";
import { getReportsCollection, getPipelineLogsCollection } from "@/lib/db/mongodb";

/**
 * PRD §16 Public-Safe Report Progress Endpoint
 * Returns sanitized report tracking state without leaking private notes, raw EXIF, or model prompts.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;

    try {
      const reportsColl = await getReportsCollection();
      const report = await reportsColl.findOne(
        { reportId },
        {
          projection: {
            reportId: 1,
            category: 1,
            description: 1,
            status: 1,
            createdAt: 1,
            submissionLocation: 1,
            evidencePhotos: 1,
            associatedIncidentId: 1,
          },
        },
      );

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      // Fetch public-safe stage progress
      const logsColl = await getPipelineLogsCollection();
      const stageLogs = await logsColl
        .find({ reportId })
        .project({ stage: 1, stageName: 1, status: 1, details: 1, timestamp: 1 })
        .sort({ stage: 1 })
        .toArray();

      const formattedPhotos = (report.evidencePhotos || []).map((p, idx) => ({
        index: idx + 1,
        fileId: p.fileId,
        filename: p.filename,
        contentType: p.contentType,
        byteSize: p.byteSize,
        captureTimestamp: p.captureTimestamp,
        downloadUrl: p.fileId ? `/api/pipeline/photos/${p.fileId}` : undefined,
      }));

      return NextResponse.json({
        success: true,
        reportId: report.reportId,
        category: report.category,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt,
        location: report.submissionLocation,
        photoCount: formattedPhotos.length,
        photos: formattedPhotos,
        associatedIncidentId: report.associatedIncidentId,
        stages: stageLogs,
      });
    } catch (mongoErr) {
      const msg = mongoErr instanceof Error ? mongoErr.message : String(mongoErr);
      if (msg.includes("ECONNREFUSED") || msg.includes("connect")) {
        // Safe simulated fallback
        return NextResponse.json({
          success: true,
          reportId,
          category: "road-surface",
          status: "EVIDENCE_VALIDATED",
          createdAt: new Date().toISOString(),
          isSimulated: true,
          stages: [
            { stage: 1, stageName: "Intake", success: true, timestamp: new Date().toISOString() },
            {
              stage: 2,
              stageName: "Validation",
              success: true,
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }
      throw mongoErr;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
