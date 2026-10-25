import { NextRequest, NextResponse } from "next/server";
import { getPipelineLogsCollection } from "@/lib/db/mongodb";

/**
 * PRD §16 Report Processing Logs Endpoint
 * GET /api/reports/:reportId/processing: Audit trail of pipeline stages executed for this report.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;

    try {
      const logsColl = await getPipelineLogsCollection();
      const jobLogs = await logsColl.find({ reportId }).sort({ stage: 1 }).toArray();

      return NextResponse.json({
        success: true,
        reportId,
        stages: jobLogs,
      });
    } catch (mongoErr) {
      const msg = mongoErr instanceof Error ? mongoErr.message : String(mongoErr);
      if (msg.includes("ECONNREFUSED") || msg.includes("connect")) {
        return NextResponse.json({
          success: true,
          reportId,
          isOfflineFallback: true,
          stages: [],
        });
      }
      throw mongoErr;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
