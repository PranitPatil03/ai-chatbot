import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-outlook",
  "text/plain",
]);

const isAllowedFileType = (type: string) => {
  if (!type) {
    return false;
  }

  if (type.startsWith("image/")) {
    return true;
  }

  return ALLOWED_MIME_TYPES.has(type);
};

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, {
      message: "File size should be less than 20MB",
    })
    .refine((file) => isAllowedFileType(file.type), {
      message:
        "File type should be an image, PDF, Word, PowerPoint, or Excel document",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const fileFromForm = formData.get("file") as File;
    const originalFilename = fileFromForm.name || "upload";
    const extension = originalFilename.includes(".")
      ? originalFilename.split(".").pop()
      : undefined;

    const objectName = [
      session.user.id,
      crypto.randomUUID(),
      extension ? `.${extension}` : "",
    ].join("");

    const fileBuffer = await file.arrayBuffer();

    try {
      const data = await put(objectName, fileBuffer, {
        access: "public",
        contentType: file.type || undefined,
      });

      return NextResponse.json({
        ...data,
        contentType: file.type || data.contentType,
        originalFilename,
      });
    } catch (_error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
