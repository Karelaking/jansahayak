/**
 * JanSahayak Processing Pipeline Types & Domain Definitions
 * Adheres strictly to PRD: Automated Citizen Report Processing, Evidence Analysis,
 * Geolocation, Map Publication, Municipal Dispatch and Community Verification.
 */

export type PipelineStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Complete report-processing lifecycle (PRD §5).
 * A single bounded enum is acceptable for the report aggregate because every state
 * is validated by `lib/pipeline/state-machine.ts`; processing jobs, moderation
 * decisions and publication records keep their own explicit state.
 */
export type ProcessingStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PROCESSING"
  | "EVIDENCE_VALIDATION_PENDING"
  | "EVIDENCE_VALIDATION_FAILED"
  | "EVIDENCE_VALIDATED"
  | "AI_ANALYSIS_PENDING"
  | "AI_ANALYZED"
  | "AI_ANALYSIS_FAILED"
  | "LOCATION_VERIFICATION_PENDING"
  | "LOCATION_VERIFIED"
  | "LOCATION_VERIFICATION_FAILED"
  | "MATCHING_PENDING"
  | "MATCH_REVIEW_REQUIRED"
  | "INCIDENT_ASSOCIATION_PENDING"
  | "INCIDENT_ASSOCIATED"
  | "MODERATION_PENDING"
  | "ADDITIONAL_EVIDENCE_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "PUBLICATION_PENDING"
  | "PUBLISHED"
  | "MUNICIPALLY_DISPATCHED"
  | "PROCESSING_RETRY_PENDING"
  | "PROCESSING_FAILED"
  | "SUSPENDED"
  | "IN_PROGRESS"
  | "RESOLVED";

export type LocationQualityBand = "HIGH" | "MEDIUM" | "LOW" | "REJECTED";

/**
 * Where a GPS sample came from. Capture-time samples are the only samples that may
 * satisfy location verification (PRD §6, §9). Submission-time coordinates are kept
 * for context but never silently promoted to capture-time evidence.
 */
export type GPSLocationSource = "capture" | "submission_fallback";

export interface GPSSample {
  latitude: number;
  longitude: number;
  horizontalAccuracyMeters: number;
  sampleTimestamp: string;
  source?: GPSLocationSource;
  altitudeMeters?: number;
  headingDegrees?: number;
}

export interface IngestedEvidencePhoto {
  buffer: Buffer;
  filename: string;
  contentType: string;
  capturedAt: string;
  isCameraCapture: boolean; // Must be explicitly true; gallery uploads rejected
  gpsSamples: GPSSample[];
}

export interface ReportSubmissionPayload {
  reportId?: string;
  userId: string;
  category: string;
  description: string;
  idempotencyKey?: string;
  photos: IngestedEvidencePhoto[];
  submissionLocation: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt: string;
  };
  deviceMetadata?: {
    platform?: string;
    userAgent?: string;
    appVersion?: string;
  };
}

export interface EvidenceValidationResult {
  isValid: boolean;
  photoCount: number;
  sha256Hashes: string[];
  /** Non-blocking findings that must be surfaced to reviewers (PRD §7). */
  warnings: string[];
  issues: string[];
  gridFsFileIds: string[];
  detectedContentTypes: string[];
  redundantPairsDetected: number;
  replaySuspected: boolean;
  captureLocationFallbackUsed: boolean;
}

export interface AIAnalysisResult {
  predictedCategory: string;
  severity: "low" | "medium" | "high" | "critical";
  confidenceScore: number; // 0.00 to 1.00
  defectSummary: string;
  visualCharacteristics: string[];
  usabilityAssessment: {
    isUsable: boolean;
    issuesDetected: string[];
  };
  embeddingVector: number[];
  contradictionsDetected: boolean;
  recommendedNextAction: "auto_merge" | "review_required" | "create_new";
  modelUsed: string;
  /** Model identifier/version required by PRD §8 to reconstruct decisions. */
  modelVersion: string;
  /** Version of the structured-output schema (PRD §8). */
  schemaVersion: string;
  /** Prompt/configuration version (PRD §8). */
  promptVersion: string;
  /** ISO timestamp of analysis completion (PRD §8). */
  processedAt: string;
  /** Image-only location inference is a supporting signal, never canonical (PRD §8). */
  imageLocationInference?: {
    latitude: number;
    longitude: number;
    confidence: number;
    isCanonical: false;
  };
}

export interface LocationSampleAssessment {
  latitude: number;
  longitude: number;
  horizontalAccuracyMeters: number;
  source: GPSLocationSource;
  distanceFromCentroidMeters: number;
  includedInCentroid: boolean;
  exclusionReason?: string;
}

export interface LocationVerificationResult {
  isVerified: boolean;
  centroidLatitude: number;
  centroidLongitude: number;
  spatialUncertaintyMeters: number;
  qualityBand: LocationQualityBand;
  outlierCount: number;
  samplesEvaluated: number;
  sampleAssessments: LocationSampleAssessment[];
  clustersDetected: number;
  requiresLocationReview: boolean;
  algorithmVersion: string;
  usedFallbackSamples: boolean;
  isWithinPilotBounds?: boolean;
  issues: string[];
}

export type MergeGateId =
  | "evidence_validated"
  | "location_compatible"
  | "same_physical_defect"
  | "no_unresolved_contradiction"
  | "candidate_eligible"
  | "unambiguous_candidate"
  | "calibrated_confidence"
  | "approved_model_version"
  | "transactional_consistency";

export interface MergeGateResult {
  gate: MergeGateId;
  passed: boolean;
  reason: string;
}

export interface DuplicateCandidate {
  id: string;
  incidentNumber?: string;
  category: string;
  status: string;
  moderationStatus?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  spatialUncertaintyMeters?: number;
  createdAt?: string;
  metadata?: Record<string, unknown> | null;
  visualEmbedding?: number[];
}

export interface DuplicateMatchingResult {
  action: "AUTO_MERGE" | "MANUAL_REVIEW" | "CREATE_NEW";
  matchedIncidentId?: string;
  candidateCount: number;
  eligibleCandidateCount: number;
  matchScore?: number;
  matchReason?: string;
  gates: MergeGateResult[];
  passedGates: string[];
  failedGates: string[];
}

export interface StageExecutionResult<T> {
  stage: PipelineStage;
  stageName: string;
  success: boolean;
  data?: T;
  error?: string;
  isRetryable?: boolean;
}
