import { StageExecutionResult } from "./types";
import { db, incidents, moderationActions, outboxEvents, Incident } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getReportsCollection } from "@/lib/db/mongodb";

export type ModerationDecision = "approve" | "reject" | "request_evidence" | "correct_location";

export interface ModerationActionParams {
  incidentId: string;
  moderatorId: string;
  decision: ModerationDecision;
  reason?: string;
  notes?: string;
  correctedLocation?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Stage 7: Moderation & Human-in-the-Loop Review Worker
 * Records immutable audit logs in PostgreSQL and transitions canonical incident states.
 */
export async function executeStage7Moderation(
  params: ModerationActionParams,
): Promise<StageExecutionResult<{ incident: Incident; decision: ModerationDecision }>> {
  const stageName = "Moderation Review & Audit";

  try {
    const { incidentId, moderatorId, decision, reason, notes, correctedLocation } = params;

    // 1. Mandatory Input Validation (PRD §12)
    if (decision === "reject" && (!reason || reason.trim().length === 0)) {
      return {
        stage: 7,
        stageName,
        success: false,
        error: "Rejection requires a documented reason for civic auditability.",
        isRetryable: false,
      };
    }

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    if (!incident) {
      return {
        stage: 7,
        stageName,
        success: false,
        error: `Incident with ID ${incidentId} not found in PostgreSQL.`,
        isRetryable: false,
      };
    }

    let nextStatus = incident.status;
    let moderationStatus = incident.moderationStatus;

    if (decision === "approve") {
      nextStatus = "approved";
      moderationStatus = "approved";
    } else if (decision === "reject") {
      if (!reason || reason.trim().length === 0) {
        return {
          stage: 7,
          stageName,
          success: false,
          error: "Rejection requires a documented reason for civic auditability.",
          isRetryable: false,
        };
      }
      nextStatus = "rejected";
      moderationStatus = "rejected";
    } else if (decision === "request_evidence") {
      nextStatus = "under_review";
      moderationStatus = "needs_evidence";
    }

    // Atomic update of incident moderation state
    const updatePayload: Partial<typeof incidents.$inferInsert> = {
      status: nextStatus,
      moderationStatus,
      moderatedBy: moderatorId,
      moderatedAt: new Date(),
      rejectionReason: decision === "reject" ? reason : undefined,
      updatedAt: new Date(),
    };

    if (correctedLocation && decision === "correct_location") {
      updatePayload.latitude = correctedLocation.latitude.toString();
      updatePayload.longitude = correctedLocation.longitude.toString();
      updatePayload.canonicalGeom = `SRID=4326;POINT(${correctedLocation.longitude} ${correctedLocation.latitude})`;
      updatePayload.spatialUncertaintyMeters = "5.00"; // Manual verification tightens uncertainty
    }

    const [updated] = await db
      .update(incidents)
      .set(updatePayload)
      .where(eq(incidents.id, incidentId))
      .returning();

    if (!updated) {
      throw new Error(`Incident ${incidentId} could not be updated.`);
    }

    // Immutable audit record in moderation_actions
    await db.insert(moderationActions).values({
      incidentId,
      moderatorId,
      action: decision,
      reason,
      notes,
      metadata: {
        previousStatus: incident.status,
        newStatus: nextStatus,
        correctedLocation: correctedLocation || null,
      },
    });

    // Write Outbox Event for post-commit notification dispatch
    await db.insert(outboxEvents).values({
      eventType: `incident.moderation_${decision}`,
      aggregateType: "incident",
      aggregateId: incidentId,
      payload: {
        incidentId,
        decision,
        moderatorId,
        newStatus: nextStatus,
        reason,
      },
    });

    // Update associated reports in MongoDB
    const reportsColl = await getReportsCollection();
    await reportsColl.updateMany(
      { associatedIncidentId: incidentId },
      {
        $set: {
          status:
            decision === "approve"
              ? "APPROVED"
              : decision === "reject"
                ? "REJECTED"
                : "ADDITIONAL_EVIDENCE_REQUIRED",
          updatedAt: new Date().toISOString(),
        },
      },
    );

    return {
      stage: 7,
      stageName,
      success: true,
      data: {
        incident: updated,
        decision,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 7,
      stageName,
      success: false,
      error: `Stage 7 moderation failed: ${msg}`,
      isRetryable: false,
    };
  }
}
