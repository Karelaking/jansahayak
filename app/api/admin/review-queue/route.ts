import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { db, incidents, isDatabaseReachable } from "@/lib/db";
import { getReportsCollection } from "@/lib/db/mongodb";
import { eq, or, desc } from "drizzle-orm";

/**
 * PRD §12 & §16 Admin Review Queue Endpoint
 * GET /api/admin/review-queue: Fetch incidents and citizen submissions awaiting staff verification or review.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);

    if (session.role !== "moderator" && session.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only designated moderators or administrators can access the review queue.",
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const items: Record<string, unknown>[] = [];
    const seenIncidentIds = new Set<string>();

    // 1. Fetch raw citizen reports from MongoDB needing staff adjudication / moderation
    try {
      const reportsColl = await getReportsCollection();
      const rawReports = await reportsColl
        .find({
          status: {
            $in: [
              "MODERATION_PENDING",
              "LOCATION_VERIFICATION_FAILED",
              "AI_ANALYSIS_FAILED",
              "PROCESSING_FAILED",
              "UNDER_REVIEW",
              "SUBMITTED",
            ],
          },
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      for (const r of rawReports) {
        if (r.associatedIncidentId) {
          seenIncidentIds.add(r.associatedIncidentId);
        }

        const isLocationFlagged = r.status === "LOCATION_VERIFICATION_FAILED";
        const isAIFlagged = r.status === "AI_ANALYSIS_FAILED";
        const isModerationPending = r.status === "MODERATION_PENDING";

        const type: "duplicate" | "location" | "scope" = isLocationFlagged ? "location" : "scope";
        const flagLabel = isLocationFlagged
          ? "Location Spatial Flag"
          : isAIFlagged
            ? "AI Usability Flag"
            : isModerationPending
              ? "Staff Gate Pending"
              : "Awaiting Processing";

        const firstPhotoId = r.evidencePhotos?.[0]?.fileId;
        const photoUrl = firstPhotoId ? `/api/pipeline/photos/${firstPhotoId}` : undefined;
        const photos = (r.evidencePhotos || []).map((p: Record<string, unknown>) => ({
          filename: p.filename,
          downloadUrl: p.fileId ? `/api/pipeline/photos/${p.fileId}` : undefined,
        }));

        items.push({
          id: r.reportId,
          title: r.description
            ? r.description.length > 60
              ? r.description.slice(0, 57) + "..."
              : r.description
            : `${r.category || "Road Hazard"} Report`,
          type,
          flagLabel,
          detail:
            r.rejectionReason ||
            r.description ||
            "Citizen submitted hazard awaiting municipal staff verification.",
          reporter: r.userId || "Citizen (anonymous)",
          time: r.createdAt
            ? new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Recently",
          badgeVariant: isLocationFlagged ? "destructive" : "secondary",
          iconName: isLocationFlagged ? "map-off" : "alert",
          status: "pending",
          category: r.category,
          createdAt: r.createdAt,
          metadata: {
            reportId: r.reportId,
            isRawReport: true,
            status: r.status,
            rejectionReason: r.rejectionReason,
            location: r.submissionLocation,
            photoCount: r.evidencePhotos?.length || 0,
            photoUrl,
            photos,
            associatedIncidentId: r.associatedIncidentId,
          },
        });
      }
    } catch (mongoErr) {
      console.warn("[Review-Queue] MongoDB fetch note:", mongoErr);
    }

    // 2. Fetch canonical incidents awaiting staff verification from PostgreSQL
    try {
      if (await isDatabaseReachable()) {
        const rows = await db
          .select()
          .from(incidents)
          .where(or(eq(incidents.status, "under_review"), eq(incidents.status, "open")))
          .orderBy(desc(incidents.createdAt))
          .limit(limit);

        for (const row of rows) {
          // Avoid duplicate entry if this incident was already linked to a raw report above
          if (seenIncidentIds.has(row.id)) continue;

          const meta = (row.metadata as Record<string, unknown>) || {};
          const isLocation = row.category === "lighting" || row.category === "crossing";

          items.push({
            id: String(row.id),
            title: String(row.title || "Hazard Incident"),
            type: isLocation ? "location" : "duplicate",
            flagLabel: row.status === "under_review" ? "Awaiting Review" : "Unverified Incident",
            detail: String(
              row.summary || "Citizen submitted hazard awaiting municipal verification.",
            ),
            reporter: String(meta.reporter || "Anonymous reporter"),
            time: row.createdAt
              ? new Date(String(row.createdAt)).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Recently",
            badgeVariant: "secondary",
            iconName: "alert",
            status: "pending",
            category: row.category,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
            metadata: meta,
          });
        }
      }
    } catch (pgErr) {
      console.warn("[Review-Queue] PostgreSQL fetch note:", pgErr);
    }

    // Sort all review items by creation date descending (newest first)
    items.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
