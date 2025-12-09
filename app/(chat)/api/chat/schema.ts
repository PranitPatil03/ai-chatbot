import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Excel
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    // CSV
    "text/csv",
    // PDF
    "application/pdf",
    // Word
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    // PowerPoint
    "application/vnd.ms-powerpoint", // .ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    // Text
    "text/plain",
    // Outlook
    "application/vnd.ms-outlook",
    // Generic fallback for other allowed types
    "application/octet-stream",
  ]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum(["chat-model", "chat-model-reasoning"]),
  selectedVisibilityType: z.enum(["public", "private"]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
