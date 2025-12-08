/**
 * Helper function to sanitize messages for AI SDK compatibility
 * Converts non-image file parts to text descriptions since Claude doesn't support arbitrary file uploads
 */

import type { ChatMessage } from "@/lib/types";

export function sanitizeMessagesForAI(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.role !== "user" || !message.parts) {
      return message;
    }

    // Separate file parts and text parts
    const fileParts: any[] = [];
    const textParts: any[] = [];
    const imageParts: any[] = [];

    for (const part of message.parts) {
      if (part.type === "text") {
        textParts.push(part);
      } else if (part.type === "file" && part.mediaType?.startsWith("image/")) {
        imageParts.push(part);
      } else if (part.type === "file") {
        fileParts.push(part);
      }
    }

    // Convert data file parts to text descriptions
    const fileDescriptions = fileParts.map((part) => {
      const fileName = part.name || "file";
      const mediaType = part.mediaType || "application/octet-stream";
      return `[Data file attached: ${fileName} (${mediaType})]\nFile URL: ${part.url}`;
    }).join("\n\n");

    // Combine text parts with file descriptions
    const userText = textParts.map(p => p.text).join("\n");
    const combinedText = fileDescriptions 
      ? `${fileDescriptions}\n\n${userText}`
      : userText;

    // Build sanitized parts: images first, then combined text
    const sanitizedParts = [
      ...imageParts,
      {
        type: "text" as const,
        text: combinedText,
      },
    ];

    // Log sanitized message for debugging
    if (fileParts.length > 0) {
      console.log("\n📧 Message Sanitizer:");
      console.log(`  - Original file parts: ${fileParts.length}`);
      console.log(`  - Sanitized text includes file URLs: ${combinedText.includes("File URL:")}`);
      console.log(`  - Combined text preview: ${combinedText.substring(0, 200)}...`);
    }

    return {
      ...message,
      parts: sanitizedParts,
    };
  });
}

/**
 * Extract file attachments from message parts
 */
export function extractFileAttachments(message: ChatMessage) {
  const files: Array<{ name: string; url: string; mediaType: string }> = [];

  if (message.role === "user" && message.parts) {
    for (const part of message.parts) {
      if (part.type === "file") {
        const partWithMeta = part as any;
        const mediaType = partWithMeta.mediaType || "";
        
        if (!mediaType.startsWith("image/")) {
          files.push({
            name: partWithMeta.name || "file",
            url: part.url,
            mediaType,
          });
        }
      }
    }
  }

  return files;
}
