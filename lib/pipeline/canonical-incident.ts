import {
  AIAnalysisResult,
  DuplicateMatchingResult,
  LocationVerificationResult,
  StageExecutionResult,
} from "./types";
import { RawReportDocument, getReportsCollection } from "@/lib/db/mongodb";
import { db, isDatabaseReachable, users, incidents, incidentReports, outboxEvents, Incident } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { ANONYMOUS_USER_ID } from "@/lib/auth/roles";
import { isTestEnvironment } from "@/lib/auth/clerk-config";

/**
 * Resolves the reporter that should be linked into `incident_reports`.
 *
 * Only identities that actually exist in the user directory are linked. Outside
 * the automated harness a missing row resolves to null (the column is nullable)
 * instead of inventing a placeholder citizen. Tests may materialise a synthetic
 * `@test.invalid` row so foreign-key expectations keep working.
 */
async function resolveReporterUserId(reportUserId: string | null | undefined): Promise<string | null> {
  if (!reportUserId || reportUserId === ANONYMOUS_USER_ID) return null;
  if (!(await isDatabaseReachable())) return null;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, reportUserId))
    .limit(1);

  if (existing) return existing.id;
  if (!isTestEnvironment()) return null;

  await db
    .insert(users)
    .values({
      id: reportUserId,
      email: `${reportUserId}@test.invalid`,
      fullName: reportUserId,
      role: "citizen",
    })
    .onConflictDoNothing();

  return reportUserId;
}

/**
 * Stage 6: Canonical Incident Creation & Association Worker
 * Manages atomic creation of canonical incident records in PostgreSQL,
 * writes PostGIS geometry points, associates reports, and logs outbox events.
 */
export async function executeStage6CanonicalIncident(
  report: RawReportDocument,
  location: LocationVerificationResult,
  aiAnalysis: AIAnalysisResult,
  matching: DuplicateMatchingResult,
): Promise<StageExecutionResult<{ incidentId: string; incident: Incident }>> {
  const stageName = "Canonical Incident & Location Synthesis";

  try {
    if (!(await isDatabaseReachable())) {
      return {
        stage: 6,
        stageName,
        success: false,
        error: "PostgreSQL database is currently unreachable. Connect your Neon DB to synthesize canonical incidents.",
        isRetryable: true,
      };
    }

    const lat = location.centroidLatitude;
    const lng = location.centroidLongitude;
    const uncertainty = location.spatialUncertaintyMeters.toString();

    // Resolve the reporter without fabricating civic accounts for unknown IDs.
    const reporterUserId = await resolveReporterUserId(report.userId);

    // Case 1: Merging with an existing Canonical Incident
    if (matching.action === "AUTO_MERGE" && matching.matchedIncidentId) {
      const incidentId = matching.matchedIncidentId;

      const [existing] = await db
        .select()
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);

      if (!existing) {
        throw new Error(`Incident ${incidentId} could not be retrieved for merge.`);
      }

      // PRD §11: Recalculate representative position using validated samples
      const existingLat = Number(existing.latitude) || lat;
      const existingLng = Number(existing.longitude) || lng;
      const existingCount = existing.reportCount || 1;
      const newLat = Number(((existingLat * existingCount + lat) / (existingCount + 1)).toFixed(7));
      const newLng = Number(((existingLng * existingCount + lng) / (existingCount + 1)).toFixed(7));
      const updatedUncertainty = Math.min(
        Number(existing.spatialUncertaintyMeters) || 15,
        location.spatialUncertaintyMeters,
      ).toFixed(2);

      // Update incident report count and recalculate location centroid
      const [updated] = await db
        .update(incidents)
        .set({
          reportCount: sql`${incidents.reportCount} + 1`,
          latitude: newLat.toString(),
          longitude: newLng.toString(),
          canonicalGeom: `SRID=4326;POINT(${newLng} ${newLat})`,
          spatialUncertaintyMeters: updatedUncertainty,
          updatedAt: new Date(),
        })
        .where(eq(incidents.id, incidentId))
        .returning();

      if (!updated) {
        throw new Error(`Incident ${incidentId} could not be updated.`);
      }

      // Record association in incident_reports junction
      await db.insert(incidentReports).values({
        incidentId,
        reportId: report.reportId,
        userId: reporterUserId,
        matchScore: matching.matchScore ? matching.matchScore.toString() : "0.9500",
        matchReason: matching.matchReason || "Strict 9-point automatic merge",
        isPrimaryReport: false,
      });

      // Write Outbox Event for guaranteed downstream delivery
      await db.insert(outboxEvents).values({
        eventType: "incident.merged",
        aggregateType: "incident",
        aggregateId: incidentId,
        payload: {
          incidentId,
          reportId: report.reportId,
          matchScore: matching.matchScore,
          updatedReportCount: "+1",
          updatedCoordinates: { latitude: newLat, longitude: newLng },
        },
      });

      // Update report status in MongoDB
      const reportsColl = await getReportsCollection();
      await reportsColl.updateOne(
        { reportId: report.reportId },
        {
          $set: {
            status: "MODERATION_PENDING",
            associatedIncidentId: incidentId,
            updatedAt: new Date().toISOString(),
          },
        },
      );

      return {
        stage: 6,
        stageName,
        success: true,
        data: {
          incidentId,
          incident: updated,
        },
      };
    }

    // Case 2: Create a Brand New Canonical Incident
    const countQuery = await db.select({ count: sql<number>`count(*)` }).from(incidents);
    const incidentSequence = (Number(countQuery[0]?.count) || 0) + 1;
    const year = new Date().getFullYear();
    const incidentNumber = `INC-${year}-${String(incidentSequence).padStart(4, "0")}`;

    const [created] = await db
      .insert(incidents)
      .values({
        incidentNumber,
        category: report.category,
        severity: aiAnalysis.severity,
        status: "under_review",
        title: `${report.category} at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        summary: aiAnalysis.defectSummary,
        latitude: lat.toString(),
        longitude: lng.toString(),
        canonicalGeom: `SRID=4326;POINT(${lng} ${lat})`,
        spatialUncertaintyMeters: uncertainty,
        reportCount: 1,
        isPublished: false,
        moderationStatus: "pending",
        metadata: {
          aiModel: aiAnalysis.modelUsed,
          confidenceScore: aiAnalysis.confidenceScore,
          visualCharacteristics: aiAnalysis.visualCharacteristics,
          duplicateMatching: {
            action: matching.action,
            matchedIncidentId: matching.matchedIncidentId || null,
            candidateCount: matching.candidateCount,
            matchScore: matching.matchScore || null,
            matchReason: matching.matchReason || null,
            passedGates: matching.passedGates,
            failedGates: matching.failedGates,
          },
        },
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert canonical incident record in PostgreSQL.");
    }

    // Associate report in incident_reports junction
    await db.insert(incidentReports).values({
      incidentId: created.id,
      reportId: report.reportId,
      userId: reporterUserId,
      matchScore: "1.0000",
      matchReason: "Initial primary citizen report",
      isPrimaryReport: true,
    });

    // Write Outbox Event
    await db.insert(outboxEvents).values({
      eventType: "incident.created",
      aggregateType: "incident",
      aggregateId: created.id,
      payload: {
        incidentId: created.id,
        incidentNumber,
        category: created.category,
        latitude: lat,
        longitude: lng,
        reportId: report.reportId,
      },
    });

    // Update report status in MongoDB
    const reportsColl = await getReportsCollection();
    await reportsColl.updateOne(
      { reportId: report.reportId },
      {
        $set: {
          status: "MODERATION_PENDING",
          associatedIncidentId: created.id,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    return {
      stage: 6,
      stageName,
      success: true,
      data: {
        incidentId: created.id,
        incident: created,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 6,
      stageName,
      success: false,
      error: `Stage 6 canonical incident creation failed: ${msg}`,
      isRetryable:
        msg.includes("ECONNREFUSED") || msg.includes("connect") || msg.includes("timeout"),
    };
  }
}
