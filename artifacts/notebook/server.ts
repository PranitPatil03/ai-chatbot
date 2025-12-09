import { streamObject } from "ai";
import { z } from "zod";
import { notebookPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { getOrCreateSandbox, executeCode, uploadFileToSandbox } from "@/lib/jupyter/e2b-manager";
import { getFileMetadataByChatId } from "@/lib/db/queries";
import type { NotebookOutput } from "@/lib/types";

/**
 * Notebook Artifact Server Handler
 * 
 * CRITICAL FLOW:
 * 1. AI generates Python code based on user prompt + file metadata
 * 2. Code is executed in E2B sandbox with actual data files
 * 3. Outputs are captured from execution
 * 4. Code + Outputs are saved to database
 * 5. Results streamed to client for display
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
  onCreateDocument: async ({ title, dataStream, session, id, chatId }) => {
    console.log('[Notebook Server] Creating notebook:', { title, id, chatId });
    
    if (!chatId) {
      console.error('[Notebook Server] No chatId provided');
      return JSON.stringify([{ 
        id: 'error', 
        type: 'code', 
        content: '# Error: Unable to determine chat context',
        status: 'error'
      }]);
    }

    // STEP 1: Generate code with AI
    console.log('[Notebook Server] Step 1: Generating code with AI...');
    let generatedCells: any[] = [];

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: notebookPrompt,
      prompt: title,
      schema: notebookSchema,
    });

    for await (const delta of fullStream) {
      if (delta.type === "object" && delta.object.cells) {
        generatedCells = delta.object.cells;
        console.log('[Notebook Server] Generated', generatedCells.length, 'cells');
      }
    }

    if (generatedCells.length === 0) {
      console.error('[Notebook Server] No cells generated');
      return JSON.stringify([]);
    }

    // STEP 2: Get uploaded files from chat
    console.log('[Notebook Server] Step 2: Fetching uploaded files...');
    const fileMetadataList = await getFileMetadataByChatId({ chatId });
    console.log('[Notebook Server] Found', fileMetadataList.length, 'files');

    // STEP 3: Get or create E2B sandbox
    console.log('[Notebook Server] Step 3: Initializing E2B sandbox...');
    const sandbox = await getOrCreateSandbox(chatId);
    console.log('[Notebook Server] Sandbox ready');

    // STEP 4: Upload files to sandbox
    console.log('[Notebook Server] Step 4: Uploading files to sandbox...');
    for (const fileMeta of fileMetadataList) {
      try {
        await uploadFileToSandbox(sandbox, fileMeta.blobUrl, fileMeta.fileName);
        console.log('[Notebook Server] Uploaded:', fileMeta.fileName);
      } catch (error) {
        console.error('[Notebook Server] Failed to upload', fileMeta.fileName, error);
      }
    }

    // STEP 5: Execute each code cell and capture outputs
    console.log('[Notebook Server] Step 5: Executing cells and capturing outputs...');
    const cellsWithOutputs = [];
    
    for (let i = 0; i < generatedCells.length; i++) {
      const cell = generatedCells[i];
      
      if (cell.type !== 'code') {
        cellsWithOutputs.push(cell);
        continue;
      }

      console.log(`[Notebook Server] Executing cell ${i + 1}/${generatedCells.length}...`);
      const startTime = Date.now();

      try {
        const result = await executeCode(sandbox, cell.content);
        const executionTime = Date.now() - startTime;

        // E2B executeCode already returns properly formatted results
        const outputs: NotebookOutput[] = result.results || [];

        cellsWithOutputs.push({
          ...cell,
          status: result.success ? 'success' : 'error',
          outputs: outputs.length > 0 ? outputs : undefined,
          executionCount: i + 1,
          executionTime,
          error: result.error,
        });

        console.log(`[Notebook Server] Cell ${i + 1} executed:`, {
          success: result.success,
          outputCount: outputs.length,
          executionTime
        });

      } catch (error) {
        console.error(`[Notebook Server] Cell ${i + 1} execution failed:`, error);
        cellsWithOutputs.push({
          ...cell,
          status: 'error',
          error: error instanceof Error ? error.message : 'Execution failed',
          executionCount: i + 1,
        });
      }

      // Stream intermediate results
      dataStream.write({
        type: "data-notebookDelta",
        data: JSON.stringify(cellsWithOutputs),
        transient: true,
      });
    }

    // STEP 6: Return final content with all outputs
    const finalContent = JSON.stringify(cellsWithOutputs);
    console.log('[Notebook Server] Execution complete:', {
      totalCells: cellsWithOutputs.length,
      cellsWithOutputs: cellsWithOutputs.filter(c => c.outputs?.length > 0).length,
      contentLength: finalContent.length
    });

    return finalContent;
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
