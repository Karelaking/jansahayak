import { EvidenceValidationResult, ProcessingStatus } from "./types";
import { RawReportDocument, getReportsCollection } from "@/lib/db/mongodb";
import {
  detectRedundantEvidence,
  inspectEvidenceBuffer,
  normalizeMimeType,
  RedundancyInput,
  SupportedImageType,
} from "./media-inspection";

/**
 * PRD §7 Evidence Validation policy. All limits are configurable and validated
 * server-side; the client's declared MIME type, sizes and timestamps are never trusted.
 */
export interface EvidenceValidationPolicy {
  minPhotoCount: number;
  maxPhotoBytes: number;
  minPhotoBytes: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  maxAgeHours: number;
  maxFutureSkewMinutes: number;
  supportedTypes: SupportedImageType[];
}

export const DEFAULT_EVIDENCE_POLICY: EvidenceValidationPolicy = {
  minPhotoCount: 4,
  maxPhotoBytes: Number(process.env.EVIDENCE_MAX_PHOTO_BYTES) || 15 * 1024 * 1024,
  minPhotoBytes: 1024,
  minWidth: Number(process.env.EVIDENCE_MIN_WIDTH) || 320,
  minHeight: Number(process.env.EVIDENCE_MIN_HEIGHT) || 240,
  maxWidth: 12_000,
  maxHeight: 12_000,
  maxAgeHours: Number(process.env.EVIDENCE_MAX_AGE_HOURS) || 24,
  maxFutureSkewMinutes: 5,
  supportedTypes: ["image/jpeg", "image/png", "image/webp"],
};

export interface EvidenceValidationInput {
  photos: RawReportDocument["evidencePhotos"];
  /** Buffers indexed in the same order as `photos`. */
  photoBuffers?: Array<Buffer | undefined>;
  /** SHA-256 hashes of evidence already submitted by other reports (replay detection). */
  previouslySeenHashes?: ReadonlySet<string>;
  policy?: Partial<EvidenceValidationPolicy>;
  now?: Date;
}

/**
 * Pure evidence validator. Performs no I/O so every PRD rule can be unit-tested
 * deterministically. `executeStage2EvidenceValidation` persists the outcome.
 */
export function validateEvidence(input: EvidenceValidationInput): EvidenceValidationResult {
  const policy: EvidenceValidationPolicy = { ...DEFAULT_EVIDENCE_POLICY, ...input.policy };
  const issues: string[] = [];
  const warnings: string[] = [];
  const sha256Hashes: string[] = [];
  const gridFsFileIds: string[] = [];
  const detectedContentTypes: string[] = [];
  const photos = input.photos || [];

  if (photos.length < policy.minPhotoCount) {
    issues.push(
      `Minimum ${policy.minPhotoCount} evidence photographs required, received ${photos.length}.`,
    );
  }

  const now = (input.now || new Date()).getTime();
  const maxFutureSkewMs = policy.maxFutureSkewMinutes * 60 * 1000;
  const maxAgeMs = policy.maxAgeHours * 60 * 60 * 1000;
  const redundancyInputs: RedundancyInput[] = [];
  let captureLocationFallbackUsed = false;
  let replaySuspected = false;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    if (!photo) continue;

    if (photo.fileId) {
      gridFsFileIds.push(photo.fileId);
    } else {
      issues.push(`Photo ${i + 1} has no protected evidence object reference.`);
    }

    // ── Check declared file size against 15MB limit ──
    if (photo.byteSize > policy.maxPhotoBytes) {
      issues.push(
        `Photo ${i + 1} exceeding 15MB limit (${(photo.byteSize / (1024 * 1024)).toFixed(1)}MB).`,
      );
    }

    // ── Server-side bitstream inspection (never trust declared MIME/dimensions) ──
    const buffer = input.photoBuffers?.[i];
    let width: number | undefined;
    let height: number | undefined;

    // Byte size is persisted by the server at intake, so it is trustworthy even
    // when the bitstream is not re-read. Check it independently of the buffer.
    if (Number.isFinite(photo.byteSize) && photo.byteSize > policy.maxPhotoBytes) {
      issues.push(
        `Photo ${i + 1} file size (${(photo.byteSize / (1024 * 1024)).toFixed(1)}MB) is exceeding ${Math.round(
          policy.maxPhotoBytes / (1024 * 1024),
        )}MB limit.`,
      );
    } else if (Number.isFinite(photo.byteSize) && photo.byteSize < policy.minPhotoBytes) {
      issues.push(`Photo ${i + 1} file is empty or corrupted.`);
    }

    if (buffer !== undefined) {
      const inspection = inspectEvidenceBuffer(buffer);
      detectedContentTypes.push(inspection.detectedType || "unknown");

      if (inspection.byteSize < policy.minPhotoBytes) {
        issues.push(`Photo ${i + 1} file is empty or corrupted.`);
      }
      if (inspection.byteSize > policy.maxPhotoBytes) {
        issues.push(
          `Photo ${i + 1} exceeds maximum allowable file size of ${Math.round(
            policy.maxPhotoBytes / (1024 * 1024),
          )}MB (${(inspection.byteSize / (1024 * 1024)).toFixed(1)}MB).`,
        );
      }
      if (!inspection.detectedType) {
        issues.push(`Photo ${i + 1} has an invalid or corrupted image header.`);
      } else {
        if (!policy.supportedTypes.includes(inspection.detectedType)) {
          issues.push(`Photo ${i + 1} uses an unsupported image format.`);
        }
        const declared = normalizeMimeType(photo.contentType);
        if (declared && declared !== inspection.detectedType) {
          issues.push(
            `Photo ${i + 1} declares content type '${declared}' but the file is '${inspection.detectedType}'.`,
          );
        }
        if (!inspection.isStructurallyComplete) {
          issues.push(`Photo ${i + 1} image stream is truncated or structurally incomplete.`);
        }
        if (!inspection.dimensions) {
          issues.push(`Photo ${i + 1} dimensions could not be decoded from the image.`);
        } else {
          width = inspection.dimensions.width;
          height = inspection.dimensions.height;
          if (width < policy.minWidth || height < policy.minHeight) {
            issues.push(
              `Photo ${i + 1} resolution ${width}x${height} is below the minimum ${policy.minWidth}x${policy.minHeight}.`,
            );
          }
          if (width > policy.maxWidth || height > policy.maxHeight) {
            issues.push(
              `Photo ${i + 1} resolution ${width}x${height} exceeds the maximum ${policy.maxWidth}x${policy.maxHeight}.`,
            );
          }
        }
      }
    } else if (photo.fileId) {
      // Verification is impossible without bytes; this must never be treated as success.
      issues.push(`Photo ${i + 1} bitstream could not be retrieved for server-side verification.`);
    }

    // ── Capture-record association and provenance ──
    if (photo.isCameraCapture !== true) {
      issues.push(
        photo.isCameraCapture === false
          ? `Photo ${i + 1} was not captured via in-app camera viewfinder. Gallery uploads are prohibited.`
          : `Photo ${i + 1} has no verifiable in-app camera provenance.`,
      );
    }

    const captureTime = new Date(photo.captureTimestamp).getTime();
    if (!Number.isFinite(captureTime)) {
      issues.push(`Photo ${i + 1} has an unparseable capture timestamp.`);
    } else {
      if (captureTime > now + maxFutureSkewMs) {
        issues.push(`Photo ${i + 1} timestamp is in the future.`);
      }
      if (now - captureTime > maxAgeMs) {
        issues.push(`Photo ${i + 1} was captured more than ${policy.maxAgeHours} hours ago.`);
      }
    }

    // ── GPS validity and capture-time provenance ──
    const samples = photo.gpsSamples || [];
    if (samples.length === 0) {
      issues.push(`Photo ${i + 1} has no associated GPS coordinates.`);
    } else {
      const captureSamples = samples.filter((sample) => sample.source !== "submission_fallback");
      if (captureSamples.length === 0) {
        captureLocationFallbackUsed = true;
        warnings.push(
          `Photo ${i + 1} has no capture-time GPS sample; submission-time device location was retained only as a fallback and cannot verify location.`,
        );
      }

      for (const sample of samples) {
        if (!Number.isFinite(sample.latitude) || sample.latitude < -90 || sample.latitude > 90) {
          issues.push(`Photo ${i + 1} contains invalid latitude.`);
        }
        if (
          !Number.isFinite(sample.longitude) ||
          sample.longitude < -180 ||
          sample.longitude > 180
        ) {
          issues.push(`Photo ${i + 1} contains invalid longitude.`);
        }
        // Missing accuracy is distinct from high accuracy (PRD §9).
        if (!Number.isFinite(sample.horizontalAccuracyMeters)) {
          issues.push(`Photo ${i + 1} is missing a horizontal accuracy value.`);
        } else if (sample.horizontalAccuracyMeters <= 0) {
          issues.push(`Photo ${i + 1} has a non-positive horizontal accuracy value.`);
        } else if (sample.horizontalAccuracyMeters > 500) {
          warnings.push(
            `Photo ${i + 1} reports very poor GPS accuracy (${sample.horizontalAccuracyMeters}m) and requires location review.`,
          );
        }

        const sampleTime = new Date(sample.sampleTimestamp).getTime();
        if (!Number.isFinite(sampleTime)) {
          issues.push(`Photo ${i + 1} has an unparseable GPS sample timestamp.`);
        } else if (sampleTime > now + maxFutureSkewMs) {
          issues.push(`Photo ${i + 1} GPS sample timestamp is in the future.`);
        }
      }
    }

    // ── Suspicious replay of previously submitted evidence ──
    if (photo.sha256 && input.previouslySeenHashes?.has(photo.sha256)) {
      replaySuspected = true;
      issues.push(
        `Photo ${i + 1} reuses evidence already submitted in another report (possible replay).`,
      );
    }

    sha256Hashes.push(photo.sha256);
    redundancyInputs.push({
      sha256: photo.sha256,
      byteSize: photo.byteSize,
      width,
      height,
      captureTimestamp: photo.captureTimestamp,
      gpsSamples: (photo.gpsSamples || []).map((sample) => ({
        latitude: sample.latitude,
        longitude: sample.longitude,
      })),
    });
  }

  const redundancyFindings = detectRedundantEvidence(redundancyInputs);
  for (const finding of redundancyFindings) {
    if (finding.type === "exact_duplicate") {
      issues.push(finding.reason);
    } else {
      warnings.push(finding.reason);
    }
  }

  const redundantPairsDetected = redundancyFindings.length;

  return {
    isValid: issues.length === 0,
    photoCount: photos.length,
    sha256Hashes,
    warnings,
    issues,
    gridFsFileIds,
    detectedContentTypes,
    redundantPairsDetected,
    replaySuspected,
    captureLocationFallbackUsed,
  };
}

async function findReplayedHashes(
  report: RawReportDocument,
  hashes: string[],
): Promise<ReadonlySet<string>> {
  if (hashes.length === 0) return new Set();
  try {
    const reportsColl = await getReportsCollection();
    const existing = await reportsColl
      .find(
        {
          reportId: { $ne: report.reportId },
          "evidencePhotos.sha256": { $in: hashes },
        },
        { projection: { "evidencePhotos.sha256": 1 } },
      )
      .limit(25)
      .toArray();

    const seen = new Set<string>();
    for (const doc of existing) {
      for (const photo of doc.evidencePhotos || []) {
        if (photo.sha256 && hashes.includes(photo.sha256)) {
          seen.add(photo.sha256);
        }
      }
    }
    return seen;
  } catch {
    // Read failure is not grounds to reject evidence; replay checking degrades open
    // while the bitstream checks still run.
    return new Set();
  }
}

/**
 * Stage 2: Server-side Evidence Validation Worker.
 * Persists the validation result and blocks dependent stages on failure.
 */
export async function executeStage2EvidenceValidation(
  report: RawReportDocument,
  photoBuffers?: Buffer[],
): Promise<
  | {
      stage: 2;
      stageName: string;
      success: false;
      data?: EvidenceValidationResult;
      error: string;
      isRetryable: boolean;
    }
  | {
      stage: 2;
      stageName: string;
      success: true;
      data: EvidenceValidationResult;
      error?: undefined;
      isRetryable?: false;
    }
> {
  const stageName = "Evidence Validation";

  try {
    const previouslySeenHashes = await findReplayedHashes(
      report,
      (report.evidencePhotos || []).map((photo) => photo.sha256),
    );

    const result = validateEvidence({
      photos: report.evidencePhotos,
      photoBuffers,
      previouslySeenHashes,
    });

    const reportsColl = await getReportsCollection();
    const nextStatus: ProcessingStatus = result.isValid
      ? "EVIDENCE_VALIDATED"
      : "EVIDENCE_VALIDATION_FAILED";
    await reportsColl.updateOne(
      { reportId: report.reportId },
      { $set: { status: nextStatus, updatedAt: new Date().toISOString() } },
    );

    if (!result.isValid) {
      return {
        stage: 2,
        stageName,
        success: false,
        error: `Evidence validation failed: ${result.issues.join("; ")}`,
        data: result,
        isRetryable: false,
      };
    }

    return { stage: 2, stageName, success: true, data: result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 2,
      stageName,
      success: false,
      error: `Stage 2 evidence validation error: ${msg}`,
      isRetryable: true,
    };
  }
}
