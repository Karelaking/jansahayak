import { NextRequest, NextResponse } from "next/server";
import { db, incidents } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { SAMPLE_HAZARDS } from "@/lib/data";

/**
 * PRD §16 Public Map Incidents Endpoint
 * Returns sanitized, privacy-safe canonical incidents for public map display.
 * Fallbacks gracefully to baseline verified seed hazards when database is offline.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    let rows: (typeof incidents.$inferSelect)[] = [];

    try {
      let query = db
        .select()
        .from(incidents)
        .where(eq(incidents.isPublished, true))
        .orderBy(desc(incidents.createdAt))
        .$dynamic();

      if (category && category !== "all") {
        query = query.where(eq(incidents.category, category));
      }

      rows = await query.limit(100);
    } catch {
      // Fallback to baseline verified seed hazards when database is offline/initializing
      const filteredSeed =
        category && category !== "all"
          ? SAMPLE_HAZARDS.filter((h) => h.category === category)
          : SAMPLE_HAZARDS;

      return NextResponse.json({
        success: true,
        isOfflineFallback: true,
        count: filteredSeed.length,
        incidents: filteredSeed,
      });
    }

    // Convert rows to sanitized map hazard format
    const publicIncidents = rows.map((inc) => ({
      id: inc.id,
      title: inc.title,
      summary: inc.summary,
      description: inc.summary || inc.title,
      category: inc.category,
      categoryLabel: inc.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      severity:
        (inc.severity as "critical" | "high" | "medium" | "moderate" | "low" | "minor") || "medium",
      status:
        (inc.status as
          | "open"
          | "in-progress"
          | "escalated"
          | "resolved"
          | "under-review"
          | "assigned"
          | "community-verified") || "open",
      statusLabel: (inc.status || "open")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      latitude: Number(inc.latitude),
      longitude: Number(inc.longitude),
      coordinates: `${Number(inc.latitude).toFixed(4)}° N, ${Number(inc.longitude).toFixed(4)}° E`,
      spatialUncertaintyMeters: Number(inc.spatialUncertaintyMeters) || 10,
      verificationsCount: inc.reportCount || 1,
      votes: inc.reportCount || 1,
      reportedAt:
        inc.publishedAt?.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }) || "Recently",
      time: "Verified",
      location: ((inc.metadata as Record<string, unknown>)?.landmark as string) || "Greater Noida",
      landmark: ((inc.metadata as Record<string, unknown>)?.landmark as string) || "Greater Noida",
    }));

    // If database has incidents, combine with baseline seed hazards so map is populated
    const seedIds = new Set(publicIncidents.map((i) => i.id));
    const combined = [...publicIncidents, ...SAMPLE_HAZARDS.filter((s) => !seedIds.has(s.id))];

    return NextResponse.json({
      success: true,
      count: combined.length,
      liveCount: publicIncidents.length,
      incidents: combined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
