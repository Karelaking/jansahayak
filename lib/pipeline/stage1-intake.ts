import { ReportSubmissionPayload, StageExecutionResult } from "./types";
import {
  getReportsCollection,
  uploadEvidencePhotoToGridFS,
  RawReportDocument,
  PhotoCaptureRecord,
} from "@/lib/db/mongodb";
import { randomUUID } from "crypto";

/**
 * Stage 1: Report Submission & Intake Worker
 * Enforces authenticated submission, min 4 camera captures, capture-time GPS telemetry,
 * MongoDB document persistence, and GridFS image streaming.
 */
export async function executeStage1Intake(
  payload: ReportSubmissionPayload,
): Promise<StageExecutionResult<{ reportId: string; document: RawReportDocument }>> {
  const stageName = "Report Intake & Evidence Staging";

  try {
    // 1. Authenticated User Check
    if (!payload.userId || payload.userId.trim() === "") {
      return {
        stage: 1,
        stageName,
        success: false,
        error: "Unauthenticated submission: A valid user ID is required.",
        isRetryable: false,
      };
    }

    // 2. Validate Category & Description
    if (!payload.category || payload.category.trim() === "") {
      return {
        stage: 1,
        stageName,
        success: false,
        error: "Missing problem category. A valid hazard category must be selected.",
        isRetryable: false,
      };
    }

    if (!payload.description || payload.description.trim().length < 5) {
      return {
        stage: 1,
        stageName,
        success: false,
        error: "Report description is too short. Please provide clear details about the hazard.",
        isRetryable: false,
      };
    }

    // 3. Enforce Minimum 4 Evidence Photos
    if (!payload.photos || payload.photos.length < 4) {
      return {
        stage: 1,
        stageName,
        success: false,
        error: `Insufficient evidence: Minimum 4 in-app camera photographs required. Received ${payload.photos ? payload.photos.length : 0}.`,
        isRetryable: false,
      };
    }

    // 4. Reject Gallery / File Picker Uploads
    for (let i = 0; i < payload.photos.length; i++) {
      const photo = payload.photos[i];
      if (!photo) continue;
      if (!photo.isCameraCapture) {
        return {
          stage: 1,
          stageName,
          success: false,
          error: `Photo ${i + 1} was not captured using the in-app camera. Gallery/file-picker uploads are disallowed.`,
          isRetryable: false,
        };
      }

      // Check capture-time GPS samples
      if (!photo.gpsSamples || photo.gpsSamples.length === 0) {
        return {
          stage: 1,
          stageName,
          success: false,
          error: `Photo ${i + 1} is missing capture-time GPS telemetry. Device location must be sampled during capture.`,
          isRetryable: false,
        };
      }
    }

    const reportsColl = await getReportsCollection();

    // 5. Check Idempotency Key (prevent duplicate submission on retried requests)
    if (payload.idempotencyKey) {
      const existing = await reportsColl.findOne({
        idempotencyKey: payload.idempotencyKey,
      });
      if (existing) {
        return {
          stage: 1,
          stageName,
          success: true,
          data: {
            reportId: existing.reportId,
            document: existing,
          },
        };
      }
    }

    const reportId =
      payload.reportId || `REP-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    // 6. Stream Photos to MongoDB GridFS & Record Metadata
    const evidencePhotos: PhotoCaptureRecord[] = [];

    for (let i = 0; i < payload.photos.length; i++) {
      const photo = payload.photos[i];
      if (!photo) continue;
      const primaryGps = photo.gpsSamples[0] || {
        latitude: payload.submissionLocation.latitude,
        longitude: payload.submissionLocation.longitude,
        horizontalAccuracyMeters: payload.submissionLocation.accuracyMeters,
        sampleTimestamp: payload.submissionLocation.capturedAt,
      };

      const gridFsUpload = await uploadEvidencePhotoToGridFS({
        buffer: photo.buffer,
        filename: photo.filename || `report_${reportId}_photo_${i + 1}.jpg`,
        reportId,
        photoIndex: i + 1,
        contentType: photo.contentType || "image/jpeg",
        gps: {
          latitude: primaryGps.latitude,
          longitude: primaryGps.longitude,
          horizontalAccuracyMeters: primaryGps.horizontalAccuracyMeters || 10,
          capturedAt: photo.capturedAt || primaryGps.sampleTimestamp || new Date().toISOString(),
        },
      });

      evidencePhotos.push({
        fileId: gridFsUpload.fileId,
        sha256: gridFsUpload.sha256,
        filename: photo.filename,
        contentType: photo.contentType,
        byteSize: gridFsUpload.length,
        captureTimestamp: photo.capturedAt || new Date().toISOString(),
        gpsSamples: photo.gpsSamples,
      });
    }

    // 7. Construct & Persist MongoDB Raw Report Document
    const document: RawReportDocument = {
      reportId,
      userId: payload.userId,
      category: payload.category,
      description: payload.description,
      idempotencyKey: payload.idempotencyKey,
      status: "SUBMITTED",
      evidencePhotos,
      submissionLocation: payload.submissionLocation,
      deviceMetadata: payload.deviceMetadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await reportsColl.insertOne(document);

    return {
      stage: 1,
      stageName,
      success: true,
      data: {
        reportId,
        document,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 1,
      stageName,
      success: false,
      error: `Stage 1 execution error: ${msg}`,
      isRetryable: true,
    };
  }
}
