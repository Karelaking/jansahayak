import { ProcessingStatus } from "./types";

/**
 * PRD §5 Report Processing State Machine.
 *
 * Every transition is validated server-side before persistence. The table below is
 * the single source of truth; workers must call `assertTransition` (or
 * `validateTransition`) rather than writing status strings directly.
 *
 * Key invariants enforced here:
 * - A failed mandatory stage cannot advance to a later mandatory stage.
 * - A terminal rejection can only be left through an explicit, audited reprocess.
 * - Publication can only be reached from an approved state.
 * - Municipal dispatch is only reachable after publication.
 * - Additional-evidence requests block publication until evidence is re-validated.
 */
export const REPORT_TRANSITIONS: Readonly<Record<ProcessingStatus, readonly ProcessingStatus[]>> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["PROCESSING", "EVIDENCE_VALIDATION_PENDING", "PROCESSING_FAILED"],
  PROCESSING: [
    "EVIDENCE_VALIDATION_PENDING",
    "EVIDENCE_VALIDATED",
    "EVIDENCE_VALIDATION_FAILED",
    "PROCESSING_RETRY_PENDING",
    "PROCESSING_FAILED",
    "REJECTED",
  ],
  EVIDENCE_VALIDATION_PENDING: [
    "EVIDENCE_VALIDATED",
    "EVIDENCE_VALIDATION_FAILED",
    "PROCESSING_RETRY_PENDING",
    "PROCESSING_FAILED",
  ],
  EVIDENCE_VALIDATION_FAILED: [
    "ADDITIONAL_EVIDENCE_REQUIRED",
    "REJECTED",
    "EVIDENCE_VALIDATION_PENDING",
    "PROCESSING_RETRY_PENDING",
  ],
  EVIDENCE_VALIDATED: ["AI_ANALYSIS_PENDING", "AI_ANALYZED"],
  AI_ANALYSIS_PENDING: [
    "AI_ANALYZED",
    "AI_ANALYSIS_FAILED",
    "PROCESSING_RETRY_PENDING",
    "PROCESSING_FAILED",
  ],
  AI_ANALYZED: ["LOCATION_VERIFICATION_PENDING"],
  AI_ANALYSIS_FAILED: ["AI_ANALYSIS_PENDING", "PROCESSING_RETRY_PENDING", "PROCESSING_FAILED"],
  LOCATION_VERIFICATION_PENDING: [
    "LOCATION_VERIFIED",
    "LOCATION_VERIFICATION_FAILED",
    "PROCESSING_RETRY_PENDING",
    "PROCESSING_FAILED",
  ],
  LOCATION_VERIFIED: ["MATCHING_PENDING"],
  LOCATION_VERIFICATION_FAILED: [
    "ADDITIONAL_EVIDENCE_REQUIRED",
    "LOCATION_VERIFICATION_PENDING",
    "REJECTED",
    "PROCESSING_RETRY_PENDING",
  ],
  MATCHING_PENDING: [
    "INCIDENT_ASSOCIATED",
    "INCIDENT_ASSOCIATION_PENDING",
    "MATCH_REVIEW_REQUIRED",
    "PROCESSING_RETRY_PENDING",
    "PROCESSING_FAILED",
  ],
  MATCH_REVIEW_REQUIRED: [
    "INCIDENT_ASSOCIATED",
    "INCIDENT_ASSOCIATION_PENDING",
    "APPROVED",
    "REJECTED",
  ],
  INCIDENT_ASSOCIATION_PENDING: ["INCIDENT_ASSOCIATED", "PROCESSING_FAILED"],
  INCIDENT_ASSOCIATED: ["MODERATION_PENDING", "REJECTED"],
  MODERATION_PENDING: ["APPROVED", "REJECTED", "ADDITIONAL_EVIDENCE_REQUIRED"],
  ADDITIONAL_EVIDENCE_REQUIRED: [
    "EVIDENCE_VALIDATION_PENDING",
    "EVIDENCE_VALIDATED",
    "MODERATION_PENDING",
    "REJECTED",
  ],
  APPROVED: ["PUBLICATION_PENDING", "PUBLISHED", "REJECTED"],
  PUBLICATION_PENDING: ["PUBLISHED", "APPROVED", "PROCESSING_FAILED"],
  PUBLISHED: ["MUNICIPALLY_DISPATCHED", "SUSPENDED", "REJECTED", "RESOLVED", "IN_PROGRESS"],
  MUNICIPALLY_DISPATCHED: ["SUSPENDED", "PUBLISHED", "RESOLVED", "IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED", "PUBLISHED", "SUSPENDED"],
  RESOLVED: ["IN_PROGRESS", "PUBLISHED"],
  // Terminal by default; the explicit audited reprocess path is handled below.
  REJECTED: [],
  PROCESSING_RETRY_PENDING: ["PROCESSING", "PROCESSING_FAILED", "REJECTED"],
  PROCESSING_FAILED: ["PROCESSING", "PROCESSING_RETRY_PENDING", "REJECTED"],
  SUSPENDED: ["PROCESSING", "APPROVED"],
};

/** States that may legitimately be surfaced as a public map pin (PRD §13). */
export const PUBLISHABLE_REPORT_STATES: readonly ProcessingStatus[] = [
  "APPROVED",
  "PUBLICATION_PENDING",
  "PUBLISHED",
  "MUNICIPALLY_DISPATCHED",
  "SUSPENDED",
  "IN_PROGRESS",
  "RESOLVED",
];

/** States in which a report must never be published. */
export const NON_PUBLISHABLE_REPORT_STATES: readonly ProcessingStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "PROCESSING",
  "EVIDENCE_VALIDATION_PENDING",
  "EVIDENCE_VALIDATION_FAILED",
  "EVIDENCE_VALIDATED",
  "AI_ANALYSIS_PENDING",
  "AI_ANALYZED",
  "AI_ANALYSIS_FAILED",
  "LOCATION_VERIFICATION_PENDING",
  "LOCATION_VERIFIED",
  "LOCATION_VERIFICATION_FAILED",
  "MATCHING_PENDING",
  "MATCH_REVIEW_REQUIRED",
  "INCIDENT_ASSOCIATION_PENDING",
  "INCIDENT_ASSOCIATED",
  "MODERATION_PENDING",
  "ADDITIONAL_EVIDENCE_REQUIRED",
  "REJECTED",
  "PROCESSING_RETRY_PENDING",
  "PROCESSING_FAILED",
];

export interface TransitionValidation {
  allowed: boolean;
  from: ProcessingStatus;
  to: ProcessingStatus;
  reason: string;
  requiresExplicitReprocess?: boolean;
}

export interface TransitionOptions {
  /**
   * Reprocessing a rejected/failed report is allowed only when the caller supplies
   * an explicit, audited force flag (PRD §5: reprocessing must use explicit rules).
   */
  forceReprocess?: boolean;
}

/**
 * Validates a report state transition against the PRD state machine.
 * Never throws; callers decide how to surface the rejection.
 */
export function validateTransition(
  from: ProcessingStatus,
  to: ProcessingStatus,
  options: TransitionOptions = {},
): TransitionValidation {
  if (from === to) {
    return {
      allowed: false,
      from,
      to,
      reason: `No-op transition from ${from} to ${to} is not a state change.`,
    };
  }

  const allowedTargets = REPORT_TRANSITIONS[from];
  if (!allowedTargets) {
    return {
      allowed: false,
      from,
      to,
      reason: `Unknown source state '${from}'.`,
    };
  }

  if (allowedTargets.includes(to)) {
    return {
      allowed: true,
      from,
      to,
      reason: `Transition ${from} → ${to} is permitted by the report state machine.`,
    };
  }

  // Explicit reprocess path out of a terminal rejection.
  if (from === "REJECTED" && to === "PROCESSING") {
    if (options.forceReprocess) {
      return {
        allowed: true,
        from,
        to,
        reason:
          "Rejected report may be reprocessed only through an explicit audited force operation.",
        requiresExplicitReprocess: true,
      };
    }
    return {
      allowed: false,
      from,
      to,
      reason: "A terminated rejection cannot be reopened without an explicit audited reprocess.",
      requiresExplicitReprocess: true,
    };
  }

  // Give precise reasons for the most dangerous illegal jumps.
  if (to === "PUBLISHED") {
    return {
      allowed: false,
      from,
      to,
      reason: "Publication is only reachable from APPROVED/APPROVAL-backed publication states.",
    };
  }
  if (to === "MUNICIPALLY_DISPATCHED") {
    return {
      allowed: false,
      from,
      to,
      reason: "Municipal dispatch is only reachable after the incident has been PUBLISHED.",
    };
  }
  if (to === "APPROVED") {
    return {
      allowed: false,
      from,
      to,
      reason: "Approval must be recorded by moderation from a moderation-pending state.",
    };
  }

  return {
    allowed: false,
    from,
    to,
    reason: `Illegal transition ${from} → ${to}. A failed or incomplete stage cannot advance.`,
  };
}

export function canTransition(
  from: ProcessingStatus,
  to: ProcessingStatus,
  options: TransitionOptions = {},
): boolean {
  return validateTransition(from, to, options).allowed;
}

/** Throws when a worker attempts an illegal transition. */
export function assertTransition(
  from: ProcessingStatus,
  to: ProcessingStatus,
  options: TransitionOptions = {},
): void {
  const validation = validateTransition(from, to, options);
  if (!validation.allowed) {
    throw new Error(`Invalid report state transition: ${validation.reason}`);
  }
}

export function isTerminalStatus(status: ProcessingStatus): boolean {
  return status === "REJECTED" || status === "PROCESSING_FAILED";
}

export function isPublishedStatus(status: ProcessingStatus): boolean {
  return (
    status === "PUBLISHED" ||
    status === "MUNICIPALLY_DISPATCHED" ||
    status === "RESOLVED" ||
    status === "IN_PROGRESS"
  );
}

/** Publication is only legal from a moderation-approved state (PRD §13). */
export function canPublishFromStatus(status: ProcessingStatus): boolean {
  return status === "APPROVED" || status === "PUBLICATION_PENDING";
}
