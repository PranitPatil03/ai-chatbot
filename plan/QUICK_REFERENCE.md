# Quick Reference Guide - Before Starting Implementation

**Date**: December 9, 2024  
**Purpose**: Fast lookup of key information from codebase analysis

---

## 🔑 Key Files to Modify

### Phase 1: File Processing
```
lib/constants.ts              → Add file type constants
lib/utils.ts                  → Add validateFileType()
lib/types.ts                  → Add notebook types
lib/db/schema.ts              → Add file_metadata, notebook_state tables
lib/db/queries.ts             → Add queries for new tables
lib/jupyter/parsers/csv-parser.ts     → CREATE
lib/jupyter/parsers/excel-parser.ts   → CREATE
app/(chat)/api/files/upload/route.ts  → MODIFY (add processing)
app/(chat)/api/files/process/route.ts → CREATE
```

### Phase 2: E2B Integration
```
lib/jupyter/e2b-client.ts                   → CREATE
app/(chat)/api/jupyter/execute/route.ts     → CREATE
```

### Phase 3: Notebook Artifact
```
artifacts/notebook/server.ts      → CREATE
artifacts/notebook/client.tsx     → CREATE
components/artifact.tsx           → MODIFY (add notebook to definitions)
hooks/use-notebook.ts             → CREATE (Zustand store)
```

### Phase 4: System Prompts & Tools
```
lib/ai/prompts.ts                      → ADD data analysis prompts
lib/ai/tools/create-notebook.ts        → CREATE
lib/ai/tools/update-notebook.ts        → CREATE
app/(chat)/api/chat/route.ts           → MODIFY (add notebook tools)
components/data-stream-handler.tsx     → MODIFY (add notebook delta handler)
```

---

## 📦 Dependencies to Install

```bash
# Required
npm install xlsx @e2b/code-interpreter encoding-japanese iconv-lite zustand

# Optional (for security)
npm install -D sanitize-filename
```

**Already Installed** ✅:
- `papaparse` - CSV parsing
- `@types/papaparse` - TypeScript types
- `codemirror` - Code editor
- `@codemirror/lang-python` - Python syntax
- `redis` - Rate limiting

---

## 🗄️ Database Schema Changes

### Migration Script
```typescript
// lib/db/schema.ts

export const fileMetadata = pgTable('file_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id').notNull().references(() => chat.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  blobUrl: text('blob_url').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // 'csv' | 'excel'
  fileSize: integer('file_size').notNull(),
  headers: jsonb('headers').notNull().$type<string[]>(),
  rowCount: integer('row_count').notNull(),
  sheetNames: jsonb('sheet_names').$type<string[]>(),
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'ready' | 'error'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
  errorMessage: text('error_message'),
});

export const notebookState = pgTable('notebook_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id').notNull().references(() => chat.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  notebookId: text('notebook_id').notNull().unique(),
  cells: jsonb('cells').notNull().$type<NotebookCell[]>(),
  metadata: jsonb('metadata').notNull().$type<NotebookMetadata>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

## 🎯 Artifact Pattern (Copy This!)

### Server Handler Template
```typescript
// artifacts/notebook/server.ts
import { streamText } from 'ai';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { dataAnalysisSystemPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';

export const notebookDocumentHandler = createDocumentHandler<'notebook'>({
  kind: 'notebook',
  onCreateDocument: async ({ title, dataStream, session }) => {
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: dataAnalysisSystemPrompt,
      prompt: title,
    });

    for await (const delta of fullStream) {
      if (delta.type === 'text-delta') {
        draftContent += delta.text;
        
        dataStream.write({
          type: 'data-notebookDelta',
          data: { code: draftContent },
          transient: true,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, session }) => {
    // Similar pattern
  },
});
```

### Client Artifact Template
```typescript
// artifacts/notebook/client.tsx
import { Artifact } from '@/components/create-artifact';

export const notebookArtifact = new Artifact<'notebook', NotebookMetadata>({
  kind: 'notebook',
  description: 'Jupyter-style notebook for data analysis',
  initialize: ({ setMetadata }) => {
    setMetadata({
      cells: [],
      kernelState: 'idle',
    });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'data-notebookDelta') {
      setArtifact((draft) => ({
        ...draft,
        content: streamPart.data.code,
        status: 'streaming',
      }));
    }
  },
  content: ({ metadata, setMetadata, ...props }) => {
    return <NotebookViewer {...props} metadata={metadata} />;
  },
  actions: [
    {
      icon: <PlayIcon />,
      label: 'Run All',
      onClick: async ({ content, metadata }) => {
        // Execute cells
      },
    },
  ],
});
```

---

## 🔐 Environment Variables

Add to `.env.local`:
```env
# E2B Configuration
E2B_API_KEY=your_e2b_api_key_here
E2B_SANDBOX_TIMEOUT=60000
E2B_SESSION_TIMEOUT=1800000
MAX_SANDBOXES_PER_USER=1

# Redis (if not already set)
UPSTASH_REDIS_URL=your_redis_url
UPSTASH_REDIS_TOKEN=your_redis_token
```

Get E2B API key: https://e2b.dev

---

## 📝 Type Definitions to Add

```typescript
// lib/types.ts

// Add to CustomUIDataTypes
export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  notebookDelta: NotebookDelta; // NEW
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
};

// Notebook types
export interface NotebookCell {
  id: string;
  type: 'code' | 'markdown';
  content: string;
  output?: NotebookOutput[];
  executionCount?: number;
  status?: 'idle' | 'running' | 'success' | 'error';
  errorMessage?: string;
}

export interface NotebookOutput {
  type: 'stream' | 'execute_result' | 'display_data' | 'error';
  data: {
    'text/plain'?: string;
    'text/html'?: string;
    'image/png'?: string;
    'image/svg+xml'?: string;
    'application/json'?: any;
  };
  executionCount?: number;
}

export interface NotebookMetadata {
  id: string;
  title: string;
  fileId: string;
  fileName: string;
  kernelState: 'starting' | 'idle' | 'busy' | 'dead';
  sessionId?: string;
  variables?: Record<string, any>;
}

export interface NotebookDelta {
  type: 'init' | 'add-cell' | 'update-cell' | 'delete-cell' | 'update-metadata';
  notebookId?: string;
  cell?: NotebookCell;
  cellId?: string;
  metadata?: Partial<NotebookMetadata>;
}

export interface FileMetadata {
  id: string;
  chatId: string;
  userId: string;
  blobUrl: string;
  fileName: string;
  fileType: 'csv' | 'excel';
  fileSize: number;
  headers: string[];
  rowCount: number;
  sheetNames?: string[];
  status: 'pending' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
  createdAt: Date;
  processedAt?: Date;
}
```

---

## 🚀 Execution API Pattern

```typescript
// app/(chat)/api/jupyter/execute/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { E2BSessionManager } from '@/lib/jupyter/e2b-client';
import { getFileMetadataById } from '@/lib/db/queries';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request
    const { code, fileMetadataId, cellId } = await request.json();

    // 3. Get or create E2B sandbox
    const sandbox = await E2BSessionManager.getOrCreateSandbox(session.user.id);

    // 4. Upload file if needed
    const fileMetadata = await getFileMetadataById(fileMetadataId);
    await E2BSessionManager.uploadFile(
      sandbox,
      fileMetadata.blobUrl,
      fileMetadata.fileName
    );

    // 5. Execute code
    const result = await E2BSessionManager.executeCode(sandbox, code);

    // 6. Get variables
    const variables = await E2BSessionManager.getVariables(sandbox);

    // 7. Return results
    return NextResponse.json({
      ...result,
      variables,
      cellId,
    });
  } catch (error: any) {
    console.error('Execution error:', error);
    return NextResponse.json(
      { error: error.message || 'Execution failed' },
      { status: 500 }
    );
  }
}
```

---

## 🧪 Testing Commands

```bash
# Run tests
pnpm test

# Run specific test
pnpm exec playwright test tests/e2e/data-analysis.test.ts

# Run in UI mode
pnpm exec playwright test --ui

# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Drizzle Studio
pnpm db:studio
```

---

## 📊 Current vs Target State

### Current (Code Artifact with Pyodide)
```
User → Upload file → Stored in Blob
User → Ask for code → Claude generates code
Code → Run in browser (Pyodide) → Output
```

**Limitations**:
- ❌ Can't access uploaded files
- ❌ Limited packages
- ❌ Slow performance
- ❌ No persistent state

### Target (Notebook Artifact with E2B)
```
User → Upload CSV/Excel → Extract headers → Store in DB
User → Ask for analysis → Claude sees headers
Claude → Generates Python code → Streams to frontend
User → Clicks "Run" → Server executes in E2B
E2B → Loads full file → Runs code → Returns output
Output → Displayed in notebook → Variables tracked
User → Asks follow-up → Claude uses previous context
```

**Benefits**:
- ✅ Access to full dataset
- ✅ All Python packages
- ✅ Fast execution
- ✅ Persistent Jupyter kernel
- ✅ Multi-turn analysis

---

## 🎨 UI Components Hierarchy

```
Chat Page
└── Chat Component
    ├── ChatHeader
    ├── Messages
    │   └── Message
    │       ├── MessageContent
    │       └── MessageActions
    ├── Artifact (right panel)
    │   ├── ArtifactHeader
    │   ├── ArtifactContent
    │   │   └── NotebookViewer
    │   │       ├── NotebookCell (multiple)
    │   │       │   ├── CodeEditor
    │   │       │   └── CellOutput
    │   │       └── VariablesPanel
    │   ├── ArtifactActions
    │   └── VersionFooter
    └── MultimodalInput
        ├── FileUploadStatus
        └── PromptInput
```

---

## 🔄 Data Flow

### File Upload Flow
```
1. User selects file in MultimodalInput
2. POST /api/files/upload
   - Validate file type (CSV/Excel)
   - Upload to Vercel Blob
   - Trigger POST /api/files/process
3. File processing API
   - Download from Blob
   - Parse with csv-parser or xlsx
   - Extract headers only
   - Store in file_metadata table
4. Return metadata to frontend
5. Display in FileUploadStatus component
```

### Code Generation Flow
```
1. User types "analyze sales data"
2. Frontend sends message with file attachment
3. Chat API loads file metadata from DB
4. Builds system prompt with file context
5. Claude generates Python code
6. Streams notebook deltas to frontend
7. Frontend renders in NotebookViewer
```

### Code Execution Flow
```
1. User clicks "Run Cell"
2. POST /api/jupyter/execute
   - Authenticate user
   - Get/create E2B sandbox
   - Upload file to sandbox (cached)
   - Execute code
   - Get variables
3. Return results to frontend
4. Display output in CellOutput
5. Update VariablesPanel
```

---

## 📚 Key Patterns from Codebase

### 1. Server Actions (use 'server-only')
```typescript
import 'server-only';

export async function myServerAction() {
  // Can access DB, call APIs, etc.
}
```

### 2. Database Queries
```typescript
export async function getMyData(id: string) {
  try {
    return await db.select().from(myTable).where(eq(myTable.id, id));
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get data');
  }
}
```

### 3. Streaming
```typescript
const stream = createUIMessageStream({
  execute: ({ writer: dataStream }) => {
    // Write custom data
    dataStream.write({
      type: 'data-myCustomType',
      data: myData,
      transient: true,
    });
  },
});

return stream.toDataStreamResponse();
```

### 4. Error Handling
```typescript
try {
  // Do work
} catch (error: any) {
  console.error('Error:', error);
  return NextResponse.json(
    { error: error.message },
    { status: 500 }
  );
}
```

---

## ⚠️ Common Pitfalls to Avoid

1. **Don't modify code artifact** - Keep Pyodide, create separate notebook artifact
2. **Don't send full dataset to Claude** - Only headers for token efficiency
3. **Don't forget to cache files in E2B** - Avoid re-uploads
4. **Don't skip rate limiting** - E2B costs can add up
5. **Don't forget error recovery** - Python errors are common
6. **Don't skip file validation** - Only CSV/Excel allowed
7. **Don't forget to close E2B sessions** - Cleanup after timeout
8. **Don't hardcode file paths** - Use `/data/` in E2B
9. **Don't skip sanitization** - Validate Python code
10. **Don't forget backward compatibility** - Existing chats must work

---

## 🎯 Success Criteria

### Phase 1 Success
- [ ] CSV parser extracts headers correctly
- [ ] Excel parser handles multiple sheets
- [ ] File metadata stored in database
- [ ] Processing API returns metadata <2s
- [ ] Upload route triggers processing
- [ ] All types compile without errors

### Phase 2 Success
- [ ] E2B sandbox creates successfully
- [ ] File uploads to E2B
- [ ] Code executes and returns results
- [ ] Variables extracted from session
- [ ] Session cleanup works

### Phase 3 Success
- [ ] Notebook artifact renders
- [ ] Streaming notebook deltas works
- [ ] Cell output displays correctly
- [ ] State management works
- [ ] Artifact actions functional

### Phase 4 Success
- [ ] Claude generates correct Python code
- [ ] File context included in prompts
- [ ] Notebook tools callable
- [ ] Multi-turn conversations work
- [ ] Error recovery functions

### Phase 5 Success
- [ ] File upload shows status
- [ ] Errors display clearly
- [ ] Rate limiting prevents abuse
- [ ] Logs track all operations
- [ ] Security validated

---

## 🚀 Ready to Start?

1. **Review CODEBASE_ANALYSIS.md** (26 pages, comprehensive)
2. **Follow IMPLEMENTATION_CHECKLIST.md** (phase by phase)
3. **Refer to IMPLEMENTATION_PLAN.md** (complete specifications)
4. **Use this guide** for quick lookups

**Start with Phase 1, Step 1**: Add file type constants to `lib/constants.ts`

Good luck! 🎉

