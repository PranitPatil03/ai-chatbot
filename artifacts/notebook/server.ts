import { streamObject } from "ai";
import { z } from "zod";
import { notebookPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

/**
 * Notebook Artifact Server Handler
 * 
 * Handles creation and updates of data analysis notebooks
 * Uses AI SDK streamObject to generate structured notebook cells
 */

const notebookCellSchema = z.object({
  id: z.string(),
  type: z.enum(['code', 'markdown']),
  content: z.string(),
  status: z.enum(['idle', 'running', 'success', 'error']).default('idle'),
  outputs: z.array(z.object({
    type: z.enum(['text', 'image', 'error', 'table']),
    content: z.string(),
    mimeType: z.string().optional(),
  })).optional(),
  executionCount: z.number().optional(),
  executionTime: z.number().optional(),
  error: z.string().optional(),
});

const notebookSchema = z.object({
  cells: z.array(notebookCellSchema),
  title: z.string().optional(),
  description: z.string().optional(),
});



export const notebookDocumentHandler = createDocumentHandler<"notebook">({
  kind: "notebook",
  onCreateDocument: async ({ title, dataStream }) => {
    console.log('[Notebook Server] Creating notebook, title:', title);
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: notebookPrompt,
      prompt: title,
      schema: notebookSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { cells } = object;

        if (cells) {
          const content = JSON.stringify(cells);
          console.log('[Notebook Server] onCreate streaming cells:', {
            cellCount: cells.length,
            contentLength: content.length,
            preview: content.substring(0, 100)
          });
          
          dataStream.write({
            type: "data-notebookDelta",
            data: content,
            transient: true,
          });

          draftContent = content;
        }
      }
    }

    console.log('[Notebook Server] onCreate final content:', {
      length: draftContent.length,
      isEmpty: !draftContent
    });
    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    console.log('[Notebook Server] Updating notebook');
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: updateDocumentPrompt(document.content, "notebook"),
      prompt: description,
      schema: notebookSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { cells } = object;

        if (cells) {
          const content = JSON.stringify(cells);
          console.log('[Notebook Server] onUpdate streaming cells:', {
            cellCount: cells.length,
            contentLength: content.length
          });
          
          dataStream.write({
            type: "data-notebookDelta",
            data: content,
            transient: true,
          });

          draftContent = content;
        }
      }
    }

    console.log('[Notebook Server] onUpdate final content:', {
      length: draftContent.length,
      isEmpty: !draftContent
    });
    return draftContent;
  },
});
