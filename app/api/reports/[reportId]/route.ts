import { NextRequest, NextResponse } from "next/server";
import { getReportsCollection, getPipelineLogsCollection } from "@/lib/db/mongodb";
import { db, incidents, incidentReports } from "@/lib/db";
import { getCurrentUserSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

/**
 * PRD §16 Public-Safe Report Progress Endpoint
 * Returns sanitized report tracking state without leaking private notes, raw EXIF, or model prompts.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;
    const reportsColl = await getReportsCollection();
    const projection = {
      reportId: 1,
      category: 1,
      description: 1,
      status: 1,
      rejectionReason: 1,
      createdAt: 1,
      submissionLocation: 1,
      evidencePhotos: 1,
      associatedIncidentId: 1,
    };

    // 1. Try finding by raw reportId
    let report = await reportsColl.findOne({ reportId }, { projection });

    // 2. Fallback: Check if reportId is an associated canonical incident ID
    if (!report) {
      report = await reportsColl.findOne({ associatedIncidentId: reportId }, { projection });
    }

    // 3. Fallback: Check if reportId is a canonical incident in PostgreSQL
    if (!report) {
      try {
        const [inc] = await db.select().from(incidents).where(eq(incidents.id, reportId)).limit(1);

        if (inc) {
          const meta = (inc.metadata || {}) as Record<string, unknown>;
          return NextResponse.json({
            success: true,
            reportId: inc.incidentNumber,
            category: inc.category,
            description: inc.summary || inc.title,
            status: inc.isPublished ? "PUBLISHED" : inc.status.toUpperCase(),
            rejectionReason: inc.rejectionReason,
            createdAt: inc.createdAt.toISOString(),
            location: {
              latitude: Number(inc.latitude),
              longitude: Number(inc.longitude),
              accuracyMeters: Number(inc.spatialUncertaintyMeters) || 10,
            },
            photoCount: 0,
            photos: [],
            associatedIncidentId: inc.id,
            canonicalIncident: {
              id: inc.id,
              incidentNumber: inc.incidentNumber,
              isPublished: inc.isPublished,
              status: inc.status,
              moderationStatus: inc.moderationStatus,
              reportCount: inc.reportCount,
              publishedAt: inc.publishedAt,
              municipalDocketNumber: (meta.municipalDocketNumber as string) || null,
              municipalDispatchedAt: (meta.municipalDispatchedAt as string) || null,
              municipalRecipient: (meta.municipalRecipient as string) || null,
              verificationVotesCount: Number(inc.verificationVotesCount) || 1,
              resolutionVotesCount: Number(inc.resolutionVotesCount) || 0,
              unresolvedVotesCount: Number(inc.unresolvedVotesCount) || 0,
              publicOpinionStatus: inc.publicOpinionStatus || "verified_hazard",
            },
            stages: [],
          });
        }
      } catch {
        // Non-blocking fallback
      }

      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Fetch public-safe stage progress
    const logsColl = await getPipelineLogsCollection();
    const stageLogs = await logsColl
      .find({ reportId: report.reportId })
      .project({ stage: 1, stageName: 1, status: 1, details: 1, timestamp: 1 })
      .sort({ stage: 1 })
      .toArray();

    const formattedPhotos = (report.evidencePhotos || []).map((p, idx) => ({
      index: idx + 1,
      fileId: p.fileId,
      filename: p.filename,
      contentType: p.contentType,
      byteSize: p.byteSize,
      captureTimestamp: p.captureTimestamp,
      downloadUrl: p.fileId ? `/api/pipeline/photos/${p.fileId}` : undefined,
    }));

    let canonicalIncident: {
      id: string;
      incidentNumber: string;
      isPublished: boolean;
      status: string;
      moderationStatus: string;
      reportCount: number;
      publishedAt: Date | null;
      municipalDocketNumber?: string | null;
      municipalDispatchedAt?: string | null;
      municipalRecipient?: string | null;
      verificationVotesCount?: number;
      resolutionVotesCount?: number;
      unresolvedVotesCount?: number;
      publicOpinionStatus?: string;
    } | null = null;

    if (report.associatedIncidentId) {
      try {
        const [inc] = await db
          .select({
            id: incidents.id,
            incidentNumber: incidents.incidentNumber,
            isPublished: incidents.isPublished,
            status: incidents.status,
            moderationStatus: incidents.moderationStatus,
            reportCount: incidents.reportCount,
            publishedAt: incidents.publishedAt,
            metadata: incidents.metadata,
            verificationVotesCount: incidents.verificationVotesCount,
            resolutionVotesCount: incidents.resolutionVotesCount,
            unresolvedVotesCount: incidents.unresolvedVotesCount,
            publicOpinionStatus: incidents.publicOpinionStatus,
          })
          .from(incidents)
          .where(eq(incidents.id, report.associatedIncidentId))
          .limit(1);

        if (inc) {
          const meta = (inc.metadata || {}) as Record<string, unknown>;
          canonicalIncident = {
            id: inc.id,
            incidentNumber: inc.incidentNumber,
            isPublished: inc.isPublished,
            status: inc.status,
            moderationStatus: inc.moderationStatus,
            reportCount: inc.reportCount,
            publishedAt: inc.publishedAt,
            municipalDocketNumber: (meta.municipalDocketNumber as string) || null,
            municipalDispatchedAt: (meta.municipalDispatchedAt as string) || null,
            municipalRecipient: (meta.municipalRecipient as string) || null,
            verificationVotesCount: Number(inc.verificationVotesCount) || 1,
            resolutionVotesCount: Number(inc.resolutionVotesCount) || 0,
            unresolvedVotesCount: Number(inc.unresolvedVotesCount) || 0,
            publicOpinionStatus: inc.publicOpinionStatus || "verified_hazard",
          };
        }
      } catch {
        // Non-blocking fallback
      }
    }

    return NextResponse.json({
      success: true,
      reportId: report.reportId,
      category: report.category,
      description: report.description,
      status: report.status,
      rejectionReason: (report as unknown as { rejectionReason?: string }).rejectionReason || null,
      createdAt: report.createdAt,
      location: report.submissionLocation,
      photoCount: formattedPhotos.length,
      photos: formattedPhotos,
      associatedIncidentId: report.associatedIncidentId,
      canonicalIncident,
      stages: stageLogs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isConnRefused = msg.includes("ECONNREFUSED") || msg.includes("connect");
    return NextResponse.json(
      {
        error: isConnRefused ? "Database connection unavailable" : msg,
        isRetryable: isConnRefused,
      },
      { status: isConnRefused ? 503 : 500 },
    );
  }
}

/**
 * PRD §2 & §16 Update Submitted Report Endpoint
 * PATCH /api/reports/:reportId
 *
 * Allows a citizen to update details of their submitted report (description, category, landmark)
 * or authorized staff (moderator/admin) to edit any report.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required to update reports." },
        { status: 401 },
      );
    }

    const { reportId } = await params;
    const reportsColl = await getReportsCollection();
    const report = await reportsColl.findOne({
      $or: [{ reportId }, { _id: reportId as unknown as import("mongodb").ObjectId }],
    });

    if (!report) {
      return NextResponse.json({ error: `Report '${reportId}' not found.` }, { status: 404 });
    }

    const isStaff = session.role === "moderator" || session.role === "admin";
    const reportUserId = (report as unknown as { userId?: string }).userId;
    const reportEmail = (report as unknown as { reporterEmail?: string }).reporterEmail;
    const isOwner =
      Boolean(session.userId && reportUserId === session.userId) ||
      Boolean(session.email && reportEmail === session.email);

    if (!isStaff && !isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You are only permitted to update your own submitted reports." },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.description !== undefined) {
      updateFields.description = String(body.description).trim();
    }
    if (body.category !== undefined) {
      updateFields.category = String(body.category).trim();
    }
    if (body.landmark !== undefined) {
      updateFields["submissionLocation.landmark"] = String(body.landmark).trim();
    }
    if (body.severity !== undefined && isStaff) {
      updateFields.severity = String(body.severity).trim();
    }

    await reportsColl.updateOne({ _id: report._id }, { $set: updateFields });

    // If linked to PostgreSQL incident, update summary/category if primary
    if (report.associatedIncidentId) {
      try {
        const incUpdates: Record<string, unknown> = { updatedAt: new Date() };
        if (body.description) incUpdates.summary = String(body.description).trim();
        if (body.category) incUpdates.category = String(body.category).trim();

        await db
          .update(incidents)
          .set(incUpdates)
          .where(eq(incidents.id, report.associatedIncidentId));
      } catch {
        // non-blocking
      }
    }

    return NextResponse.json({
      success: true,
      message: "Report updated successfully.",
      reportId: report.reportId,
      updatedFields: updateFields,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PRD §2 & §16 Delete / Retract Submitted Report Endpoint
 * DELETE /api/reports/:reportId
 *
 * Allows a citizen to retract and delete their submitted report, or authorized
 * staff to delete any report from the registry.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);
    if (!session.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required to delete reports." },
        { status: 401 },
      );
    }

    const { reportId } = await params;
    const reportsColl = await getReportsCollection();
    const report = await reportsColl.findOne({
      $or: [{ reportId }, { _id: reportId as unknown as import("mongodb").ObjectId }],
    });

    if (!report) {
      return NextResponse.json({ error: `Report '${reportId}' not found.` }, { status: 404 });
    }

    const isStaff = session.role === "moderator" || session.role === "admin";
    const reportUserId = (report as unknown as { userId?: string }).userId;
    const reportEmail = (report as unknown as { reporterEmail?: string }).reporterEmail;
    const isOwner =
      Boolean(session.userId && reportUserId === session.userId) ||
      Boolean(session.email && reportEmail === session.email);

    if (!isStaff && !isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You are only permitted to delete your own submitted reports." },
        { status: 403 },
      );
    }

    // 1. Delete from MongoDB
    await reportsColl.deleteOne({ _id: report._id });

    // 2. Clean up incident_reports junction if present
    try {
      await db.delete(incidentReports).where(eq(incidentReports.reportId, report.reportId));
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "Report deleted successfully.",
      deletedReportId: report.reportId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
