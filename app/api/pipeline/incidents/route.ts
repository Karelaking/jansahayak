import { NextRequest, NextResponse } from "next/server";
import { db, incidents } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { SAMPLE_HAZARDS } from "@/lib/data";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publishedOnly = searchParams.get("published") === "true";
    const status = searchParams.get("status");

    try {
      let query = db.select().from(incidents).orderBy(desc(incidents.createdAt)).$dynamic();

      if (publishedOnly) {
        query = query.where(eq(incidents.isPublished, true));
      } else if (status) {
        query = query.where(eq(incidents.status, status));
      }

      const rows = await query.limit(50);

      return NextResponse.json({
        success: true,
        count: rows.length,
        incidents: rows,
      });
    } catch {
      // Fallback to sample hazards when database is offline
      const filtered = status ? SAMPLE_HAZARDS.filter((h) => h.status === status) : SAMPLE_HAZARDS;

      return NextResponse.json({
        success: true,
        isOfflineFallback: true,
        count: filtered.length,
        incidents: filtered,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
