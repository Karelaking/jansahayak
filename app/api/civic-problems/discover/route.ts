import { NextRequest, NextResponse } from "next/server";
import { discoverCivicProblems } from "@/lib/organizations";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await discoverCivicProblems({
      category,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to discover civic problems." }, { status: 500 });
  }
}
