import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  messages?: ChatMessage[]; // Sanitized messages with file URLs
};

export const createDocument = ({ session, dataStream, messages }: CreateDocumentProps) =>
  tool({
    description:
      "Create a document for writing, code generation, data analysis, or content creation. For notebooks: generates and executes Python code, returning actual results. For other kinds: generates the document content. The execution results are streamed to the user in real-time.",
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
    }),
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      console.log("\n📦 createDocument tool:");
      console.log("  - title:", title);
      console.log("  - kind:", kind);
      console.log("  - messages passed?", !!messages);
      console.log("  - messages count:", messages?.length || 0);
      if (messages && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        console.log("  - last message role:", lastMsg.role);
        console.log("  - last message parts:", lastMsg.parts.length);
        lastMsg.parts.forEach((part, i) => {
          if (part.type === 'text') {
            console.log(`    - Part ${i} (text): ${(part as any).text.substring(0, 100)}...`);
          } else {
            console.log(`    - Part ${i} (${part.type})`);
          }
        });
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
        messages, // Pass sanitized messages to access file URLs
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      // Return appropriate message based on document kind
      let resultMessage = "A document was created and is now visible to the user.";
      
      if (kind === "notebook") {
        resultMessage = "A Python notebook was created. The code has been executed in a secure sandbox, and the results (output, visualizations, data) are being streamed to the artifact panel on the right. Check the output section to see the actual results.";
      } else if (kind === "code") {
        resultMessage = "A code snippet was created and is now visible in the artifact panel.";
      }

      return {
        id,
        title,
        kind,
        content: resultMessage,
      };
    },
  });
