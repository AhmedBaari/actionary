import { NextResponse } from "next/server";
import { GridFSBucket } from "mongodb";
import { getDb } from "@/lib/db/client";
import { requireCurrentUser } from "@/lib/auth/session";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await requireCurrentUser();
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Images must be 10 MB or smaller." }, { status: 413 });
    }
    const db = await getDb();
    const bucket = new GridFSBucket(db, { bucketName: "taskImages" });
    const upload = bucket.openUploadStream(file.name || "screenshot.png", {
      metadata: { contentType: file.type, uploadedAt: new Date() },
    });
    const content = Buffer.from(await file.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      upload.on("error", reject).on("finish", resolve);
      upload.end(content);
    });
    return NextResponse.json({ url: `/api/uploads/${upload.id.toString()}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image upload failed." }, { status: 500 });
  }
}
