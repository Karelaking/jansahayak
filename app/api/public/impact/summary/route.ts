import { NextRequest, NextResponse } from "next/server";
import { getPublicImpactSummary } from "@/lib/organizations";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "public_client";
    const rate = checkRateLimit(`impact_summary_${ip}`, { limit: 60, windowMs: 60 * 1000 });
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again in a minute." }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam) {
      const d = new Date(startDateParam);
      if (!isNaN(d.getTime())) startDate = d;
    }

    if (endDateParam) {
      const d = new Date(endDateParam);
      if (!isNaN(d.getTime())) endDate = d;
    }

    const summary = await getPublicImpactSummary({
      category,
      startDate,
      endDate,
    });

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load public impact summary." }, { status: 500 });
  }
}
