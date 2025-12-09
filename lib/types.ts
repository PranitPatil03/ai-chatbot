import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  notebookDelta: string; // Added for notebook artifact
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

// File metadata types for data analysis
export type FileMetadata = {
  id: string;
  chatId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  blobUrl: string;
  headers: string[]; // Column names extracted from CSV/Excel
  rowCount: number;
  sheetNames?: string[]; // For Excel files with multiple sheets
  encoding?: string; // Detected encoding for CSV files
  uploadedAt: Date;
  processedAt: Date;
};

// Notebook cell types
export type NotebookCellType = 'code' | 'markdown' | 'output';

export type NotebookOutput = {
  type: 'text' | 'image' | 'error' | 'table';
  content: string;
  mimeType?: string;
};

export type NotebookCell = {
  id: string;
  type: NotebookCellType;
  content: string;
  outputs?: NotebookOutput[];
  executionCount?: number;
  executionTime?: number; // in milliseconds
  status?: 'idle' | 'running' | 'success' | 'error';
  error?: string;
};

// Notebook metadata
export type NotebookMetadata = {
  id: string;
  chatId: string;
  title: string;
  cells: NotebookCell[];
  fileReferences: string[]; // Array of file metadata IDs
  createdAt: Date;
  updatedAt: Date;
  e2bSessionId?: string; // E2B sandbox session ID
};

// Notebook state for frontend
export type NotebookState = {
  isExecuting: boolean;
  currentCellId?: string;
  errorMessage?: string;
  sessionStatus: 'idle' | 'initializing' | 'ready' | 'error';
};
