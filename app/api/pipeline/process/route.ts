import { NextRequest, NextResponse } from "next/server";
import { processReportBackground } from "@/lib/pipeline/background-processor";
import { processOutboxBatch } from "@/lib/pipeline/worker";

/**
 * PRD §16 Pipeline Processing Endpoint
 * POST /api/pipeline/process
 *
 * Triggers asynchronous background analysis for a single report or processes
 * the queued transactional outbox batch.
 */
export async function POST(req: NextRequest) {
  try {
    let body: { reportId?: string; batchSize?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // 1. Single report targeted background processing
    if (body.reportId) {
      const result = await processReportBackground(body.reportId);
      return NextResponse.json({
        success: result.success,
        mode: "single_report",
        result,
      });
    }

    // 2. Batch processing of pending outbox events
    const batchSize = body.batchSize || 20;
    const summary = await processOutboxBatch(batchSize);

    return NextResponse.json({
      success: true,
      mode: "outbox_batch",
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
