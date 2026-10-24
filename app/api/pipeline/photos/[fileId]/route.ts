import { NextRequest, NextResponse } from "next/server";
import { getGridFSBucket } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await params;
    const bucket = await getGridFSBucket();
    const objectId = new ObjectId(fileId);

    const files = await bucket.find({ _id: objectId }).toArray();
    const file = files[0];

    if (!file) {
      return new NextResponse("Photo not found in GridFS", { status: 404 });
    }

    const downloadStream = bucket.openDownloadStream(objectId);
    const chunks: Buffer[] = [];

    for await (const chunk of downloadStream) {
      chunks.push(chunk as Buffer);
    }

    const buffer = Buffer.concat(chunks);
    const contentType =
      ((file.metadata as Record<string, unknown>)?.contentType as string) || "image/jpeg";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new NextResponse(`Error streaming photo: ${msg}`, { status: 500 });
  }
}
