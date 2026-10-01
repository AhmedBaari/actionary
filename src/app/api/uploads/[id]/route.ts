import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import { requireCurrentUser } from "@/lib/auth/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
    const { id } = await params;
    if (!ObjectId.isValid(id)) return new NextResponse("Not found", { status: 404 });
    const bucket = new GridFSBucket(await getDb(), { bucketName: "taskImages" });
    const file = await bucket.find({ _id: new ObjectId(id) }).next();
    if (!file) return new NextResponse("Not found", { status: 404 });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      bucket.openDownloadStream(file._id).on("data", (chunk: Buffer) => chunks.push(chunk)).on("error", reject).on("end", resolve);
    });
    return new NextResponse(Buffer.concat(chunks), {
      headers: {
        "Content-Type":
          typeof file.metadata?.contentType === "string"
            ? file.metadata.contentType
            : "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
