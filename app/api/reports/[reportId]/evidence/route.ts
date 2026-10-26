import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import {
  getReportsCollection,
  uploadEvidencePhotoToGridFS,
  PhotoCaptureRecord,
} from "@/lib/db/mongodb";
import { db, outboxEvents } from "@/lib/db";
import { processReportBackground } from "@/lib/pipeline/background-processor";

/**
 * PRD §16 Report Supplementary Evidence Endpoint
 * POST /api/reports/:reportId/evidence
 *
 * Allows citizens or field staff to attach supplementary photographic evidence to an
 * existing report (especially when flagged as ADDITIONAL_EVIDENCE_REQUIRED).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    const { reportId } = await params;

    const reportsColl = await getReportsCollection();
    const reportDoc = await reportsColl.findOne({ reportId });

    if (!reportDoc) {
      return NextResponse.json(
        { error: `Report with ID '${reportId}' not found.` },
        { status: 404 },
      );
    }

    // Verify ownership or staff permissions
    if (
      reportDoc.userId !== session.userId &&
      session.role !== "moderator" &&
      session.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to attach evidence to this report." },
        { status: 403 },
      );
    }

    const contentType = req.headers.get("content-type") || "";
    const newPhotos: PhotoCaptureRecord[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const files = formData.getAll("photos") as File[];

      if (files.length === 0) {
        return NextResponse.json({ error: "No photo files found in request." }, { status: 400 });
      }

      const defaultLat = reportDoc.submissionLocation?.latitude || 28.4744;
      const defaultLng = reportDoc.submissionLocation?.longitude || 77.504;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file || typeof file.arrayBuffer !== "function") continue;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const upload = await uploadEvidencePhotoToGridFS({
          buffer,
          filename: file.name || `evidence_${Date.now()}_${i + 1}.jpg`,
          reportId,
          photoIndex: (reportDoc.evidencePhotos?.length || 0) + i + 1,
          contentType: file.type || "image/jpeg",
          gps: {
            latitude: defaultLat,
            longitude: defaultLng,
            horizontalAccuracyMeters: 8,
            capturedAt: new Date().toISOString(),
          },
        });

        newPhotos.push({
          fileId: upload.fileId,
          sha256: upload.sha256,
          filename: file.name,
          contentType: file.type || "image/jpeg",
          byteSize: upload.length,
          captureTimestamp: new Date().toISOString(),
          gpsSamples: [
            {
              latitude: defaultLat,
              longitude: defaultLng,
              horizontalAccuracyMeters: 8,
              sampleTimestamp: new Date().toISOString(),
            },
          ],
        });
      }
    } else {
      const body = await req.json().catch(() => ({}));
      const photosInput = body.photos || [];

      if (!Array.isArray(photosInput) || photosInput.length === 0) {
        return NextResponse.json({ error: "No photos provided in payload." }, { status: 400 });
      }

      const defaultLat = reportDoc.submissionLocation?.latitude || 28.4744;
      const defaultLng = reportDoc.submissionLocation?.longitude || 77.504;

      for (let i = 0; i < photosInput.length; i++) {
        const p = photosInput[i];
        const buffer = Buffer.from(p.base64 || "", "base64");
        if (buffer.length === 0) continue;

        const upload = await uploadEvidencePhotoToGridFS({
          buffer,
          filename: p.filename || `evidence_${Date.now()}_${i + 1}.jpg`,
          reportId,
          photoIndex: (reportDoc.evidencePhotos?.length || 0) + i + 1,
          contentType: p.contentType || "image/jpeg",
          gps: {
            latitude: p.latitude || defaultLat,
            longitude: p.longitude || defaultLng,
            horizontalAccuracyMeters: p.accuracyMeters || 8,
            capturedAt: p.capturedAt || new Date().toISOString(),
          },
        });

        newPhotos.push({
          fileId: upload.fileId,
          sha256: upload.sha256,
          filename: p.filename || `photo_${i + 1}.jpg`,
          contentType: p.contentType || "image/jpeg",
          byteSize: upload.length,
          captureTimestamp: p.capturedAt || new Date().toISOString(),
          gpsSamples: [
            {
              latitude: p.latitude || defaultLat,
              longitude: p.longitude || defaultLng,
              horizontalAccuracyMeters: p.accuracyMeters || 8,
              sampleTimestamp: p.capturedAt || new Date().toISOString(),
            },
          ],
        });
      }
    }

    if (newPhotos.length === 0) {
      return NextResponse.json(
        { error: "Failed to process photo evidence files." },
        { status: 400 },
      );
    }

    // Append new photos to report and reset status if it was awaiting evidence or previously failed (PRD §5, §7, §15, §16)
    const nextStatus =
      reportDoc.status === "ADDITIONAL_EVIDENCE_REQUIRED" ||
      reportDoc.status === "REJECTED" ||
      reportDoc.status === "EVIDENCE_VALIDATION_FAILED" ||
      reportDoc.status === "PROCESSING_FAILED" ||
      reportDoc.status === "AI_ANALYSIS_FAILED" ||
      reportDoc.status === "LOCATION_VERIFICATION_FAILED"
        ? "PROCESSING"
        : reportDoc.status;

    await reportsColl.updateOne(
      { reportId },
      {
        $push: { evidencePhotos: { $each: newPhotos } },
        $set: {
          status: nextStatus,
          rejectionReason: null,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    // Write Outbox Event for background processing worker
    try {
      await db.insert(outboxEvents).values({
        eventType: "report.evidence_added",
        aggregateType: "report",
        aggregateId: reportId,
        payload: {
          reportId,
          addedPhotosCount: newPhotos.length,
          newStatus: nextStatus,
          userId: session.userId,
        },
      });
    } catch {
      // Offline fallback: continue
    }

    // Immediately trigger asynchronous background re-verification with force override (PRD §3, §4, §5, §15)
    void processReportBackground(reportId, { force: true }).catch((err) => {
      console.error(
        `[Evidence] Asynchronous background re-verification error for ${reportId}:`,
        err,
      );
    });

    return NextResponse.json({
      success: true,
      reportId,
      status: nextStatus,
      addedPhotosCount: newPhotos.length,
      photos: newPhotos,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
