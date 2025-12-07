import { streamObject } from "ai";
import { z } from "zod";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { myProvider } from "@/lib/ai/providers";

/**
 * Notebook artifact handler
 * 
 * This creates and updates Jupyter notebook artifacts in the chat.
 */
export const notebookDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    // Generate Python code based on the title/description
    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: `You are a Python code generator for Jupyter notebooks. Generate clean, well-commented Python code for data analysis, visualization, or machine learning tasks.

Include:
- Import necessary libraries (pandas, numpy, matplotlib, etc.)
- Clear variable names and comments
- Error handling where appropriate
- Output/print statements to show results

The code should be executable and production-ready.`,
      prompt: title,
      schema: z.object({
        code: z.string().describe("Python code for the notebook"),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: "data-codeDelta",
            data: code,
            transient: true,
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },

  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: `You are updating existing Python code in a Jupyter notebook. 

Current code:
\`\`\`python
${document.content}
\`\`\`

Modify the code according to the user's request. Maintain existing functionality unless explicitly asked to change it.`,
      prompt: description,
      schema: z.object({
        code: z.string().describe("Updated Python code"),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: "data-codeDelta",
            data: code,
            transient: true,
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
});
