import {
  getReportsCollection,
  getPipelineLogsCollection,
  downloadEvidencePhotoFromGridFS,
} from "@/lib/db/mongodb";
import { db, outboxEvents } from "@/lib/db";
import { executeStage2EvidenceValidation } from "./evidence-validation";
import { executeStage3AIAnalysis } from "./ai-analysis";
import { executeStage4LocationVerification } from "./location-verification";
import { executeStage5DuplicateMatching } from "./duplicate-matching";
import { executeStage6CanonicalIncident } from "./canonical-incident";
import { executeStage8Publication } from "./publication";
import { dispatchMunicipalReportEmail } from "@/lib/email/municipal-dispatcher";
import { StageExecutionResult } from "./types";

export interface BackgroundProcessingResult {
  success: boolean;
  reportId: string;
  status: string;
  incidentId?: string;
  incidentNumber?: string;
  isPublished?: boolean;
  municipalDispatched?: boolean;
  rejectionReason?: string;
  error?: string;
  durationMs: number;
}

/**
 * Stage logger helper to record stage telemetry in MongoDB pipeline_job_logs.
 */
async function logStage(res: StageExecutionResult<unknown>, reportId: string) {
  try {
    const pipelineLogsColl = await getPipelineLogsCollection();
    await pipelineLogsColl.insertOne({
      reportId,
      stage: res.stage,
      stageName: res.stageName,
      status: res.success ? "SUCCESS" : "FAILED",
      details: { data: res.data, error: res.error },
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-blocking log persistence
  }
}

/**
 * Dedicated Background Report Analysis Worker (PRD §3, §4)
 * Asynchronously processes a queued SUBMITTED report through evidence validation,
 * AI vision extraction, location verification, deduplication, and canonical incident synthesis.
 * If invalid, marks report REJECTED; if approved, publishes to public map and dispatches
 * the civic dossier to the local municipality via email.
 */
export async function processReportBackground(
  reportId: string,
  options: { force?: boolean } = {},
): Promise<BackgroundProcessingResult> {
  const startTime = Date.now();
  console.log(
    `[Background-Worker] Starting asynchronous processing for report: ${reportId}${options.force ? " (force=true)" : ""}`,
  );

  try {
    const reportsColl = await getReportsCollection();
    const report = await reportsColl.findOne({ reportId });

    if (!report) {
      console.error(`[Background-Worker] Report ${reportId} not found in MongoDB.`);
      return {
        success: false,
        reportId,
        status: "NOT_FOUND",
        error: `Report ${reportId} not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    // Short-circuit if already processed or terminated, unless force reprocessing is requested (PRD §5, §15)
    if (
      !options.force &&
      (report.status === "PUBLISHED" ||
        report.status === "REJECTED" ||
        report.status === "MUNICIPALLY_DISPATCHED")
    ) {
      console.log(
        `[Background-Worker] Report ${reportId} already in terminal state: ${report.status}`,
      );
      return {
        success: true,
        reportId,
        status: report.status,
        incidentId: report.associatedIncidentId,
        durationMs: Date.now() - startTime,
      };
    }

    // Transition to PROCESSING and clear prior rejection reason if force-reprocessing
    await reportsColl.updateOne(
      { reportId },
      {
        $set: {
          status: "PROCESSING",
          rejectionReason: null,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    // Download photo buffers from GridFS
    const photoBuffers: Buffer[] = [];
    for (const photo of report.evidencePhotos) {
      if (photo.fileId) {
        try {
          const buf = await downloadEvidencePhotoFromGridFS(photo.fileId);
          photoBuffers.push(buf);
        } catch {
          // Fallback if GridFS buffer read fails
        }
      }
    }

    // ── STAGE 2: Server-side Evidence Validation ──
    const s2 = await executeStage2EvidenceValidation(report, photoBuffers);
    await logStage(s2, reportId);

    if (!s2.success || !s2.data?.isValid) {
      const rejectionReason =
        s2.error ||
        "Evidence photographs failed integrity validation or minimum camera requirements.";
      console.warn(
        `[Background-Worker] Report ${reportId} REJECTED at Stage 2: ${rejectionReason}`,
      );

      await reportsColl.updateOne(
        { reportId },
        {
          $set: {
            status: "REJECTED",
            rejectionReason,
            updatedAt: new Date().toISOString(),
          },
        },
      );

      // Record rejection outbox event
      await db.insert(outboxEvents).values({
        eventType: "report.rejected",
        aggregateType: "report",
        aggregateId: reportId,
        payload: { reportId, rejectionReason },
      });

      return {
        success: false,
        reportId,
        status: "REJECTED",
        rejectionReason,
        durationMs: Date.now() - startTime,
      };
    }

    // ── STAGE 3: AI Evidence Analysis (OpenRouter Multimodal) ──
    const s3 = await executeStage3AIAnalysis(report, photoBuffers);
    await logStage(s3, reportId);

    if (!s3.success || !s3.data) {
      const err = s3.error || "AI evidence vision analysis failed.";
      await reportsColl.updateOne(
        { reportId },
        {
          $set: {
            status: "AI_ANALYSIS_FAILED",
            updatedAt: new Date().toISOString(),
          },
        },
      );
      return {
        success: false,
        reportId,
        status: "AI_ANALYSIS_FAILED",
        error: err,
        durationMs: Date.now() - startTime,
      };
    }
    const aiAnalysis = s3.data;

    // ── STAGE 4: Location Verification & Clustering ──
    const s4 = await executeStage4LocationVerification(report);
    await logStage(s4, reportId);

    if (!s4.success || !s4.data || !s4.data.isVerified) {
      const err = s4.error || "Location verification failed geodesic thresholds.";
      await reportsColl.updateOne(
        { reportId },
        {
          $set: {
            status: "LOCATION_VERIFICATION_FAILED",
            updatedAt: new Date().toISOString(),
          },
        },
      );
      return {
        success: false,
        reportId,
        status: "LOCATION_VERIFICATION_FAILED",
        error: err,
        durationMs: Date.now() - startTime,
      };
    }
    const location = s4.data;

    // ── STAGE 5: Candidate Discovery & Duplicate Matching ──
    const s5 = await executeStage5DuplicateMatching(report, location, aiAnalysis);
    await logStage(s5, reportId);

    if (!s5.success || !s5.data) {
      const err = s5.error || "Candidate duplicate matching failed.";
      return {
        success: false,
        reportId,
        status: "MATCHING_FAILED",
        error: err,
        durationMs: Date.now() - startTime,
      };
    }
    const matching = s5.data;

    // ── STAGE 6: Canonical Incident & Location Synthesis ──
    const s6 = await executeStage6CanonicalIncident(report, location, aiAnalysis, matching);
    await logStage(s6, reportId);

    if (!s6.success || !s6.data) {
      const err = s6.error || "Canonical incident synthesis failed.";
      return {
        success: false,
        reportId,
        status: "INCIDENT_SYNTHESIS_FAILED",
        error: err,
        durationMs: Date.now() - startTime,
      };
    }

    const { incidentId, incident } = s6.data;

    let isPublished = incident.isPublished;
    let municipalDispatched = false;

    // If auto-approved or already approved, trigger Stage 8 publication & Stage 9 municipal dispatch
    if (incident.status === "approved" || incident.moderationStatus === "approved") {
      const s8 = await executeStage8Publication({
        incidentId,
        publishedBy: "system_background_worker",
      });
      await logStage(s8, reportId);

      if (s8.success) {
        isPublished = true;
        // Dispatch municipal civic report dossier via email
        const dispatchResult = await dispatchMunicipalReportEmail(incidentId);
        if (dispatchResult.success) {
          municipalDispatched = true;
          console.log(
            `[Background-Worker] Municipal dossier ${dispatchResult.docketNumber} dispatched to ${dispatchResult.recipient}`,
          );
        }
      }
    }

    console.log(
      `[Background-Worker] Finished processing report ${reportId} -> Incident ${incident.incidentNumber} (${incident.status}) in ${Date.now() - startTime}ms`,
    );

    return {
      success: true,
      reportId,
      status: isPublished ? "PUBLISHED" : incident.status,
      incidentId,
      incidentNumber: incident.incidentNumber,
      isPublished,
      municipalDispatched,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Background-Worker] Unhandled error processing report ${reportId}:`, msg);
    return {
      success: false,
      reportId,
      status: "PROCESSING_FAILED",
      error: msg,
      durationMs: Date.now() - startTime,
    };
  }
}
