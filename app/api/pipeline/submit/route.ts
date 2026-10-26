import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { runReportPipeline } from "@/lib/pipeline/orchestrator";
import { executeStage1Intake } from "@/lib/pipeline/intake";
import { processReportBackground } from "@/lib/pipeline/background-processor";
import { db, outboxEvents } from "@/lib/db";
import { IngestedEvidencePhoto, ReportSubmissionPayload } from "@/lib/pipeline/types";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateCheck = checkRateLimit(`submit_${clientIp}`, { limit: 15, windowMs: 60 * 1000 });
    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil(rateCheck.resetMs / 1000);
      return NextResponse.json(
        {
          success: false,
          error: "Too many submission attempts. Please wait before submitting another report.",
          retryAfterSeconds: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(rateCheck.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil((Date.now() + rateCheck.resetMs) / 1000)),
          },
        },
      );
    }

    const session = await getCurrentUserSession(req);
    const contentType = req.headers.get("content-type") || "";
    const isSync = req.nextUrl.searchParams.get("sync") === "true";

    let payload: ReportSubmissionPayload;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const category = (formData.get("category") as string) || "";
      const description = (formData.get("description") as string) || "";
      const idempotencyKey = (formData.get("idempotencyKey") as string) || undefined;

      const subLat = parseFloat((formData.get("submissionLatitude") as string) || "28.4744");
      const subLng = parseFloat((formData.get("submissionLongitude") as string) || "77.5040");

      const photos: IngestedEvidencePhoto[] = [];
      const photoFiles = formData.getAll("photos") as File[];
      const gpsRaw = formData.get("gpsSamples") as string;
      const parsedGps = gpsRaw ? JSON.parse(gpsRaw) : [];

      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i];
        if (!file || typeof file.arrayBuffer !== "function") continue;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const photoGps = parsedGps[i] || [
          {
            latitude: subLat,
            longitude: subLng,
            horizontalAccuracyMeters: 8.5,
            sampleTimestamp: new Date().toISOString(),
          },
        ];

        photos.push({
          buffer,
          filename: file.name,
          contentType: file.type || "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: photoGps,
        });
      }

      payload = {
        userId: session.userId || (formData.get("userId") as string) || "citizen_dev",
        category,
        description,
        idempotencyKey,
        photos,
        submissionLocation: {
          latitude: subLat,
          longitude: subLng,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
        },
        deviceMetadata: {
          userAgent: req.headers.get("user-agent") || undefined,
        },
      };
    } else {
      // JSON body with base64 encoded photo buffers
      const json = await req.json();
      const photos: IngestedEvidencePhoto[] = (json.photos || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any, idx: number) => ({
          buffer: Buffer.from(p.base64 || "", "base64"),
          filename: p.filename || `photo_${idx + 1}.jpg`,
          contentType: p.contentType || "image/jpeg",
          capturedAt: p.capturedAt || new Date().toISOString(),
          isCameraCapture: p.isCameraCapture ?? true,
          gpsSamples: p.gpsSamples || [
            {
              latitude: json.submissionLocation?.latitude || 28.4744,
              longitude: json.submissionLocation?.longitude || 77.504,
              horizontalAccuracyMeters: 8,
              sampleTimestamp: new Date().toISOString(),
            },
          ],
        }),
      );

      payload = {
        userId: session.userId || json.userId || "citizen_dev",
        category: json.category,
        description: json.description,
        idempotencyKey: json.idempotencyKey,
        photos,
        submissionLocation: json.submissionLocation || {
          latitude: 28.4744,
          longitude: 77.504,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
        },
        deviceMetadata: json.deviceMetadata,
      };
    }

    // PRD §3, §4: Synchronous override for internal diagnostic benchmarking (?sync=true)
    if (isSync) {
      const summary = await runReportPipeline(payload);
      return NextResponse.json({
        success: summary.stagesCompleted >= 6,
        summary,
      });
    }

    // PRD §3, §4: Default Fast Intake Gateway (<500ms SLA)
    // Persists raw report in MongoDB GridFS, creates PostgreSQL outbox event,
    // and returns immediately to ensure an instant, responsive citizen UX.
    const s1 = await executeStage1Intake(payload);
    if (!s1.success || !s1.data) {
      return NextResponse.json(
        {
          success: false,
          error: s1.error || "Intake validation failed.",
        },
        { status: 400 },
      );
    }

    const { reportId } = s1.data;

    // Record transactional outbox event in PostgreSQL
    try {
      await db.insert(outboxEvents).values({
        eventType: "report.submitted",
        aggregateType: "report",
        aggregateId: reportId,
        payload: {
          reportId,
          category: payload.category,
          idempotencyKey: payload.idempotencyKey,
        },
      });
    } catch (outboxErr) {
      console.warn("[Submit] Non-blocking outbox insertion warning:", outboxErr);
    }

    // Trigger dedicated background analysis worker asynchronously
    void processReportBackground(reportId).catch((err) => {
      console.error(`[Submit] Asynchronous background analysis error for ${reportId}:`, err);
    });

    return NextResponse.json({
      success: true,
      reportId,
      status: "SUBMITTED",
      summary: {
        reportId,
        status: "SUBMITTED",
        stagesCompleted: 1,
        message: "Report accepted and queued for background analysis",
        durationMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isConnRefused = msg.includes("ECONNREFUSED") || msg.includes("connect");
    return NextResponse.json(
      {
        success: false,
        error: isConnRefused
          ? "Database service is temporarily unavailable. Please verify database connectivity."
          : msg,
        isRetryable: isConnRefused,
      },
      { status: isConnRefused ? 503 : 500 },
    );
  }
}
