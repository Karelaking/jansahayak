import { NextRequest, NextResponse } from "next/server";
import { getPublicResolutionDossier } from "@/lib/organizations";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const dossier = await getPublicResolutionDossier(id);
    if (!dossier) {
      return NextResponse.json({ error: "Resolution dossier not found." }, { status: 404 });
    }

    return NextResponse.json(dossier);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load resolution dossier." }, { status: 500 });
  }
}
