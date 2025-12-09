import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { codeDocumentHandler } from "@/artifacts/code/server";
import { notebookDocumentHandler } from "@/artifacts/notebook/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
import type { ArtifactKind } from "@/components/artifact";
import { saveDocument } from "../db/queries";
import type { Document } from "../db/schema";
import type { ChatMessage } from "../types";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  chatId?: string;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      console.log('[DocumentHandler] onCreateDocument called:', { 
        kind: config.kind, 
        id: args.id, 
        title: args.title 
      });
      
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
        chatId: args.chatId,
      });

      console.log('[DocumentHandler] Draft content generated:', {
        kind: config.kind,
        id: args.id,
        contentLength: draftContent.length,
        isEmpty: !draftContent
      });

      if (args.session?.user?.id) {
        console.log('[DocumentHandler] Saving document to database...');
        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });
        console.log('[DocumentHandler] Document saved successfully');
      } else {
        console.warn('[DocumentHandler] No user ID, skipping database save');
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      console.log('[DocumentHandler] onUpdateDocument called:', {
        kind: config.kind,
        id: args.document.id,
        description: args.description
      });
      
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
      });

      console.log('[DocumentHandler] Updated content generated:', {
        kind: config.kind,
        contentLength: draftContent.length
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });
      }

      return;
    },
  };
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  notebookDocumentHandler,
  sheetDocumentHandler,
];

export const artifactKinds = ["text", "code", "notebook", "sheet"] as const;
