# Codebase Analysis Report - AI Chatbot with Data Analysis Feature

**Analysis Date**: December 9, 2024  
**Purpose**: Deep dive into existing codebase before implementing data analysis + Jupyter execution feature

---

## Executive Summary

This is a **production-ready Next.js AI chatbot** using:
- **Framework**: Next.js 16 (App Router)
- **AI SDK**: Vercel AI SDK 5.0 with Claude (Anthropic)
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Vercel Blob for file uploads
- **Auth**: NextAuth 5.0
- **Current Execution**: Pyodide (client-side Python, browser-based)
- **Artifacts System**: Text, Code, Sheet, Image artifacts

**Goal**: Add data analysis capabilities with E2B server-side Jupyter execution while maintaining existing architecture patterns.

---

## 1. Project Structure & Architecture

### Tech Stack
```
Next.js 16.0.7 (App Router, React 19 RC)
TypeScript (strict mode)
AI SDK 5.0.26
Claude (Anthropic) via @ai-sdk/anthropic 2.0.53
Drizzle ORM 0.34 + PostgreSQL
Vercel Blob storage
NextAuth 5.0 (beta)
Redis (for resumable streams)
Tailwind CSS + shadcn/ui
Biome (linter/formatter)
Playwright (e2e testing)
```

### Directory Structure
```
app/
├── (auth)/          → Authentication routes (login, register)
│   ├── auth.ts      → NextAuth configuration
│   ├── actions.ts   → Auth server actions
│   └── api/         → Auth API routes
│
├── (chat)/          → Main chat interface
│   ├── layout.tsx   → Loads Pyodide script
│   ├── page.tsx     → Chat list page
│   ├── actions.ts   → Chat server actions
│   ├── chat/[id]/page.tsx → Individual chat
│   └── api/
│       ├── chat/route.ts      → Main chat streaming endpoint
│       ├── files/upload/      → File upload handler
│       ├── document/          → Document CRUD
│       ├── history/           → Chat history
│       ├── suggestions/       → Suggestion system
│       └── vote/              → Vote system
│
artifacts/
├── code/            → Code artifact (client + server)
├── text/            → Text artifact
├── sheet/           → Spreadsheet artifact
├── image/           → Image artifact
└── actions.ts       → Common artifact actions

components/
├── artifact.tsx     → Main artifact container
├── code-editor.tsx  → CodeMirror Python editor
├── console.tsx      → Execution output display
├── multimodal-input.tsx → File upload + text input
├── data-stream-handler.tsx → Handles streaming data
├── elements/        → Reusable UI elements
└── ui/              → shadcn/ui components

lib/
├── ai/
│   ├── models.ts    → Model configuration
│   ├── prompts.ts   → System prompts
│   ├── providers.ts → AI provider setup
│   ├── tools/       → Claude tools (createDocument, updateDocument, etc.)
│   └── entitlements.ts → User limits
├── db/
│   ├── schema.ts    → Database schema
│   ├── queries.ts   → Database queries
│   └── migrate.ts   → Migration runner
├── artifacts/
│   └── server.ts    → Artifact handler factory
├── types.ts         → TypeScript type definitions
├── utils.ts         → Utility functions
├── errors.ts        → Custom error classes
├── usage.ts         → Token usage tracking
└── constants.ts     → App constants
```

---

## 2. Current File Upload System

### Upload Flow
**File**: `app/(chat)/api/files/upload/route.ts`

```typescript
// Current allowed types (broader than our CSV/Excel requirement)
ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", // ✅ Excel
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // ✅ Excel
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-outlook",
  "text/plain",
  "image/*", // All images
];
```

**Process**:
1. User selects file in `multimodal-input.tsx`
2. File uploaded to Vercel Blob via `/api/files/upload`
3. Returns: `{ url, contentType, originalFilename }`
4. Added to message attachments
5. **NO PROCESSING** - file just stored, URL sent to Claude

**Key Finding**: ❗ **No metadata extraction currently exists**
- Files are uploaded but not analyzed
- Claude receives only the blob URL
- No headers, no row counts, no file processing

---

## 3. Current Code Execution System (Pyodide)

### Architecture
**File**: `artifacts/code/client.tsx`

```typescript
// Pyodide loaded in layout
<Script
  src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
  strategy="beforeInteractive"
/>

// Execution happens client-side
const currentPyodideInstance = await globalThis.loadPyodide({
  indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
});
```

**Features**:
- Client-side Python execution in browser
- Matplotlib output captured as base64 images
- Package loading from imports
- Custom stdout capturing
- No file access (browser sandboxed)

**Limitations**:
1. ❌ Can't access uploaded files (different origin)
2. ❌ Limited packages (only what Pyodide supports)
3. ❌ Performance constraints (browser limitations)
4. ❌ No persistent state between executions
5. ❌ Large data files won't work (memory limits)

**Why E2B is Needed**:
- Access to uploaded files via Vercel Blob
- Full Python package ecosystem
- Better performance (server-side)
- Persistent Jupyter kernel state
- Support for large datasets

---

## 4. Artifact System (Critical to Understand)

### Artifact Factory Pattern
**File**: `lib/artifacts/server.ts`

```typescript
export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params) => Promise<string>;
  onUpdateDocument: (params) => Promise<string>;
}): DocumentHandler<T>
```

**How It Works**:
1. **Server-side handler** (`artifacts/code/server.ts`):
   - Receives title from Claude tool call
   - Uses `streamObject` to generate code
   - Streams deltas to frontend via `data-codeDelta`
   - Returns final content string

2. **Client-side artifact** (`artifacts/code/client.tsx`):
   - Extends `Artifact` class
   - Handles `data-codeDelta` stream parts
   - Renders CodeEditor component
   - Provides actions (Run, Copy, etc.)

3. **Registration** (`components/artifact.tsx`):
   ```typescript
   export const artifactDefinitions = [
     textArtifact,
     codeArtifact,
     imageArtifact,
     sheetArtifact,
   ];
   ```

**For Notebook Artifact**:
- Need to create `artifacts/notebook/server.ts` (like code/server.ts)
- Need to create `artifacts/notebook/client.tsx` (like code/client.tsx)
- Register in `artifactDefinitions`
- Add `'notebook'` to `CustomUIDataTypes` in `lib/types.ts`

---

## 5. Streaming Architecture

### Data Stream System
**File**: `components/data-stream-handler.tsx`

```typescript
export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { artifact, setArtifact, setMetadata } = useArtifact();

  // Process streaming deltas
  for (const delta of newDeltas) {
    const artifactDefinition = artifactDefinitions.find(
      (def) => def.kind === artifact.kind
    );

    if (artifactDefinition?.onStreamPart) {
      artifactDefinition.onStreamPart({
        streamPart: delta,
        setArtifact,
        setMetadata,
      });
    }
  }
}
```

**Stream Part Types** (from `lib/types.ts`):
```typescript
export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  // Need to add: notebookDelta
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
};
```

**For Notebook**:
- Add `notebookDelta: NotebookDelta` to CustomUIDataTypes
- Handle in DataStreamHandler
- Stream notebook structure (cells, outputs)

---

## 6. Database Schema (Current)

**File**: `lib/db/schema.ts`

### Existing Tables
```typescript
// Users
user {
  id: uuid
  email: varchar
  password: varchar
}

// Chats
chat {
  id: uuid
  createdAt: timestamp
  title: text
  userId: uuid → user.id
  visibility: 'public' | 'private'
  lastContext: jsonb (AppUsage)
}

// Messages (v2)
message {
  id: uuid
  chatId: uuid → chat.id
  role: varchar
  parts: json
  attachments: json // ← File attachments here!
  createdAt: timestamp
}

// Documents (artifacts)
document {
  id: uuid
  createdAt: timestamp
  title: text
  content: text
  kind: 'text' | 'code' | 'image' | 'sheet' // ← Need to add 'notebook'
  userId: uuid → user.id
}

// Suggestions (for document editing)
suggestion {
  id: uuid
  documentId: uuid
  documentCreatedAt: timestamp
  originalText: text
  suggestedText: text
  description: text
  isResolved: boolean
  userId: uuid
  createdAt: timestamp
}

// Votes
vote {
  chatId: uuid
  messageId: uuid
  isUpvoted: boolean
}

// Streams (for resumable streams)
stream {
  id: uuid
  chatId: uuid
  createdAt: timestamp
}
```

### Missing Tables (Need to Add)
```typescript
// 1. File metadata
file_metadata {
  id: uuid
  chatId: uuid → chat.id
  userId: uuid → user.id
  blobUrl: text
  fileName: text
  fileType: 'csv' | 'excel'
  fileSize: integer
  headers: jsonb (string[])
  rowCount: integer
  sheetNames: jsonb (string[]) // Excel only
  status: 'pending' | 'processing' | 'ready' | 'error'
  createdAt: timestamp
  processedAt: timestamp
  errorMessage: text
}

// 2. Notebook state (for persistence)
notebook_state {
  id: uuid
  chatId: uuid → chat.id
  userId: uuid → user.id
  notebookId: text
  cells: jsonb (NotebookCell[])
  metadata: jsonb (NotebookMetadata)
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## 7. AI Tools System

### Current Tools
**File**: `lib/ai/tools/`

1. **createDocument** (`create-document.ts`):
   - Input: `{ title, kind }`
   - Calls appropriate handler from `documentHandlersByArtifactKind`
   - Streams artifact to frontend
   - Saves to database

2. **updateDocument** (`update-document.ts`):
   - Input: `{ documentId, description }`
   - Loads existing document
   - Streams updates
   - Saves new version

3. **requestSuggestions** (`request-suggestions.ts`):
   - For document editing suggestions

4. **getWeather** (`get-weather.ts`):
   - Example tool

### Tool Registration
**File**: `app/(chat)/api/chat/route.ts`

```typescript
const result = streamText({
  model: myProvider.languageModel(selectedChatModel),
  system: systemPrompt({ selectedChatModel, requestHints }),
  messages: convertToModelMessages(uiMessages),
  stopWhen: stepCountIs(5),
  experimental_activeTools: [
    "getWeather",
    "createDocument",
    "updateDocument",
    "requestSuggestions",
  ],
  tools: {
    getWeather: getWeather(),
    createDocument: createDocument({ session, dataStream }),
    updateDocument: updateDocument({ session, dataStream }),
    requestSuggestions: requestSuggestions({ session, dataStream }),
  },
});
```

**For Notebook**:
- Create `lib/ai/tools/create-notebook.ts`
- Create `lib/ai/tools/update-notebook.ts`
- Add to experimental_activeTools
- Add to tools object

---

## 8. System Prompts

### Current Prompts
**File**: `lib/ai/prompts.ts`

```typescript
// Main system prompt (includes artifacts instructions)
export const systemPrompt = ({ selectedChatModel, requestHints }) => {
  if (selectedChatModel === "chat-model-reasoning") {
    return `${regularPrompt}\n\n${requestPrompt}`;
  }
  return `${regularPrompt}\n\n${requestPrompt}\n\n${artifactsPrompt}`;
};

// Code generation prompt (for code artifact)
export const codePrompt = `
You are a Python code generator that creates self-contained, executable code snippets.
1. Each snippet should be complete and runnable on its own
2. Prefer using print() statements to display outputs
3. Include helpful comments
4. Keep snippets concise (generally under 15 lines)
5. Avoid external dependencies - use Python standard library
6. Handle potential errors gracefully
...
`;
```

**Issues with Current Code Prompt**:
- ❌ Designed for **standalone snippets** (not data analysis)
- ❌ "Avoid external dependencies" (we NEED pandas, numpy, etc.)
- ❌ "Keep snippets concise under 15 lines" (data analysis needs more)
- ❌ No file loading instructions
- ❌ No data analysis patterns

**Need to Add**:
- `dataAnalysisSystemPrompt` (200+ lines, comprehensive)
- `fileContextPrompt(fileMetadata)` (dynamic, file-specific)
- `updateNotebookPrompt` (for iterations)
- `errorRecoveryPrompt` (for auto-fix)

---

## 9. State Management

### Current State
1. **Chat State** (AI SDK useChat hook):
   ```typescript
   const { messages, setMessages, input, setInput, sendMessage, stop } = useChat();
   ```

2. **Artifact State** (SWR-based):
   ```typescript
   // File: hooks/use-artifact.ts
   const { data: localArtifact, mutate: setLocalArtifact } = useSWR<UIArtifact>(
     "artifact",
     null,
     { fallbackData: initialArtifactData }
   );
   ```

3. **Artifact Metadata** (SWR-based):
   ```typescript
   const { data: localArtifactMetadata, mutate: setLocalArtifactMetadata } = 
     useSWR<any>(`artifact-metadata-${artifact.documentId}`, null);
   ```

**Key Pattern**: Using SWR as global state (not Redux/Zustand)

**For Notebook**:
- Could extend existing artifact state
- OR create dedicated notebook state (Zustand recommended in plan)
- Metadata will hold: cells, outputs, variables, kernelState

---

## 10. CodeMirror Integration

### Current Implementation
**File**: `components/code-editor.tsx`

```typescript
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";

// Creates Python editor with:
// - Syntax highlighting
// - Dark theme
// - Auto-save on changes
// - Remote updates support (for streaming)
```

**Features**:
- ✅ Python syntax highlighting
- ✅ Debounced save
- ✅ Streaming support
- ✅ Undo/redo
- ✅ Read-only modes

**For Notebook**:
- Can reuse CodeEditor component
- Need cell wrapper component
- Need execution count display
- Need cell output rendering

---

## 11. Console Output System

### Current Implementation
**File**: `components/console.tsx`

```typescript
export type ConsoleOutput = {
  id: string;
  contents: ConsoleOutputContent[];
  status: "in_progress" | "loading_packages" | "completed" | "failed";
};

export type ConsoleOutputContent = {
  type: "text" | "image";
  value: string;
};
```

**Features**:
- Text output display
- Image output (base64)
- Status indicators
- Clear outputs action

**For Notebook**:
- Extend to support more output types:
  - HTML (tables, rich display)
  - JSON
  - Error tracebacks
  - Matplotlib/Plotly charts
  - DataFrames

---

## 12. Multimodal Input Component

### Current Implementation
**File**: `components/multimodal-input.tsx`

```typescript
// File upload handling
const handleFile Upload = async (file: File) => {
  // 1. Upload to /api/files/upload
  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
  });

  // 2. Get blob URL
  const { url, contentType, originalFilename } = await response.json();

  // 3. Add to attachments
  setAttachments(prev => [...prev, {
    name: originalFilename,
    url,
    contentType,
  }]);
};
```

**Observations**:
- ✅ File upload works
- ❌ No processing status display
- ❌ No metadata extraction
- ❌ No file preview
- ❌ No validation for CSV/Excel only

**Need to Add**:
- File type validation (CSV/Excel only)
- Processing status indicator
- Metadata display after processing
- Error handling UI

---

## 13. API Route Patterns

### Main Chat Route
**File**: `app/(chat)/api/chat/route.ts`

```typescript
export async function POST(request: Request) {
  // 1. Parse request
  const { id, message, selectedChatModel, selectedVisibilityType } = 
    await request.json();

  // 2. Authenticate
  const session = await auth();
  if (!session?.user) return error;

  // 3. Rate limiting check
  const messageCount = await getMessageCountByUserId({
    id: session.user.id,
    differenceInHours: 24,
  });
  if (messageCount > limit) return error;

  // 4. Load or create chat
  const chat = await getChatById({ id });
  if (!chat) {
    await saveChat({ id, userId, title, visibility });
  }

  // 5. Load messages
  const messagesFromDb = await getMessagesByChatId({ id });
  const uiMessages = [...convertToUIMessages(messagesFromDb), message];

  // 6. Save user message
  await saveMessages({ messages: [newMessage] });

  // 7. Stream AI response
  const stream = createUIMessageStream({
    execute: ({ writer: dataStream }) => {
      const result = streamText({
        model,
        system: systemPrompt,
        messages: convertToModelMessages(uiMessages),
        tools: { ... },
      });
      
      // Stream deltas to frontend
      result.onStream((delta) => {
        dataStream.write({ type: 'data-textDelta', data: delta.text });
      });
      
      // Save assistant message on finish
      result.onFinish(async ({ response }) => {
        await saveMessages({ messages: [assistantMessage] });
      });
    }
  });

  return stream.toDataStreamResponse();
}
```

**Key Pattern**:
- Request → Auth → Rate Limit → DB Operations → Stream Response
- Save messages before and after streaming
- Use `createUIMessageStream` for custom data types

**For Jupyter Execution API**:
- Follow same pattern
- Add `/api/jupyter/execute` route
- Authenticate, execute in E2B, return results
- Could stream execution updates

---

## 14. Error Handling

### Current Error System
**File**: `lib/errors.ts`

```typescript
export class ChatSDKError extends Error {
  constructor(
    public code: ErrorCode,
    public cause?: string,
  ) {
    super(code);
    this.name = 'ChatSDKError';
  }

  toResponse() {
    return new Response(
      JSON.stringify({ code: this.code, cause: this.cause }),
      { status: getStatusCode(this.code) }
    );
  }
}
```

**Error Codes**:
- `bad_request:*` → 400
- `unauthorized:*` → 401
- `forbidden:*` → 403
- `rate_limit:*` → 429
- `offline:*` → 503

**For Data Analysis**:
- Add execution error types
- File processing errors
- E2B connection errors
- Parser errors

---

## 15. Authentication & Authorization

### NextAuth Setup
**File**: `app/(auth)/auth.ts`

```typescript
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [Credentials({ ... })],
  callbacks: {
    authorized({ auth, request }) {
      // Check if user is authenticated
      return !!auth?.user;
    },
  },
});
```

**User Type System**:
```typescript
export type UserType = "free" | "paid";

export const entitlementsByUserType = {
  free: {
    maxMessagesPerDay: 10,
  },
  paid: {
    maxMessagesPerDay: 1000,
  },
};
```

**For E2B**:
- Could add `maxExecutionsPerDay`
- Could add `maxE2BSessions`
- Rate limiting per user type

---

## 16. Key Dependencies Already Installed

```json
{
  "ai": "5.0.26", // ✅ Vercel AI SDK
  "papaparse": "^5.5.2", // ✅ CSV parser (already installed!)
  "@types/papaparse": "^5.3.15", // ✅ Types
  "codemirror": "^6.0.1", // ✅ Code editor
  "@codemirror/lang-python": "^6.1.6", // ✅ Python syntax
  "postgres": "^3.4.4", // ✅ Database
  "drizzle-orm": "^0.34.0", // ✅ ORM
  "redis": "^5.0.0", // ✅ For rate limiting
  "zod": "^3.25.76", // ✅ Schema validation
  "@vercel/blob": "^0.24.1", // ✅ File storage
}
```

**Need to Install**:
```bash
npm install xlsx @e2b/code-interpreter encoding-japanese iconv-lite zustand
npm install -D sanitize-filename
```

---

## 17. Testing Setup

### Playwright E2E
**File**: `playwright.config.ts`

```typescript
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});
```

**Existing Tests** (`tests/`):
- `e2e/` - End-to-end flows
- `pages/` - Page objects
- `prompts/` - Prompt testing
- `routes/` - API route tests
- `fixtures.ts` - Test helpers
- `helpers.ts` - Authentication helpers

**For Data Analysis**:
- Add tests in `tests/e2e/data-analysis.test.ts`
- Test file upload → processing → code generation → execution
- Mock E2B responses in tests

---

## 18. Critical Observations for Implementation

### ✅ What Works Well
1. **Artifact system is extensible** - Easy to add notebook artifact
2. **Streaming architecture is solid** - Can stream notebook deltas
3. **Database schema is clean** - Easy to add new tables
4. **Tool system is flexible** - Can add notebook tools
5. **File upload works** - Just needs processing layer
6. **CodeMirror already integrated** - Reuse for notebook cells
7. **papaparse already installed** - CSV parsing ready

### ⚠️ What Needs Modification
1. **File upload route** - Add processing trigger
2. **System prompts** - Add data analysis prompts
3. **Type definitions** - Add notebook types
4. **Artifact definitions** - Register notebook artifact
5. **Chat route** - Add file metadata context
6. **Code execution** - Replace Pyodide with E2B

### ❌ What's Missing
1. **File metadata extraction** - Need CSV/Excel parsers
2. **E2B integration** - Need E2B client manager
3. **Notebook artifact** - Need client + server
4. **Jupyter execution API** - Need /api/jupyter/execute route
5. **State management for notebooks** - Need Zustand store
6. **Rate limiting** - Need Redis-based limits
7. **Logging** - Need structured logging
8. **Security** - Need input sanitization

---

## 19. Implementation Strategy

### Phase 1: Foundation (No Breaking Changes)
1. Add new database tables (migrations)
2. Add new types to `lib/types.ts`
3. Install missing dependencies
4. Create parser utilities (`lib/jupyter/parsers/`)
5. Create file processing API (`/api/files/process`)

### Phase 2: E2B Integration (Isolated)
1. Create E2B client (`lib/jupyter/e2b-client.ts`)
2. Create execution API (`/api/jupyter/execute`)
3. Test execution in isolation

### Phase 3: Notebook Artifact (Parallel to Code)
1. Create notebook server handler
2. Create notebook client component
3. Register in artifact definitions
4. Test streaming

### Phase 4: Integration (Connect Everything)
1. Modify file upload to trigger processing
2. Add system prompts
3. Create notebook tools
4. Modify chat route to include file context
5. Add notebook delta handler

### Phase 5: Polish (UX + Performance)
1. Add file upload status UI
2. Add error recovery
3. Add rate limiting
4. Add logging
5. Add security measures

---

## 20. Risk Assessment

### 🟢 LOW RISK
- Database migrations (using Drizzle, safe)
- Adding new types (TypeScript will catch errors)
- Parser creation (isolated utilities)
- Artifact creation (follows existing pattern)

### 🟡 MEDIUM RISK
- E2B integration (new external service, needs testing)
- File upload modification (critical path, needs care)
- Chat route modification (core functionality)
- State management (new patterns)

### 🔴 HIGH RISK
- System prompt changes (affects all code generation)
- Replacing Pyodide (breaking change for existing code artifact)
- Rate limiting (could lock out users)

**Mitigation**:
1. Keep Pyodide for code artifact (don't break existing)
2. Notebook artifact separate from code artifact
3. Feature flag for data analysis features
4. Extensive testing before production
5. Gradual rollout (free users first)

---

## 21. Key Patterns to Follow

### 1. Artifact Pattern
```typescript
// Server: Generate content, stream deltas
export const myDocumentHandler = createDocumentHandler({
  kind: 'my-kind',
  onCreateDocument: async ({ title, dataStream }) => {
    // Stream deltas: dataStream.write({ type: 'data-myDelta', data })
    // Return final content
  },
});

// Client: Handle deltas, render UI
export const myArtifact = new Artifact({
  kind: 'my-kind',
  onStreamPart: ({ streamPart, setArtifact }) => {
    // Handle streaming updates
  },
  content: ({ ...props }) => {
    // Render component
  },
  actions: [/* ... */],
});
```

### 2. Tool Pattern
```typescript
export const myTool = ({ session, dataStream }) => tool({
  description: '...',
  inputSchema: z.object({ ... }),
  execute: async (params) => {
    // Call handler
    await handler.onCreateDocument({ ...params, dataStream, session });
    // Return result
  },
});
```

### 3. API Route Pattern
```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return unauthorized();
  
  const body = await request.json();
  // Validate with Zod
  
  // Process
  const result = await doWork(body);
  
  return NextResponse.json(result);
}
```

### 4. Database Query Pattern
```typescript
export async function getMyData(id: string) {
  try {
    return await db
      .select()
      .from(myTable)
      .where(eq(myTable.id, id));
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get data');
  }
}
```

---

## 22. Environment Variables Needed

### Existing
```env
AUTH_SECRET=***
POSTGRES_URL=***
BLOB_READ_WRITE_TOKEN=***
ANTHROPIC_API_KEY=***
REDIS_URL=***
```

### New (Need to Add)
```env
E2B_API_KEY=*** # From e2b.dev
E2B_SANDBOX_TIMEOUT=60000
E2B_SESSION_TIMEOUT=1800000
MAX_SANDBOXES_PER_USER=1
UPSTASH_REDIS_URL=*** # For rate limiting
UPSTASH_REDIS_TOKEN=***
```

---

## 23. Migration Path for Existing Users

### Backwards Compatibility
1. ✅ Keep code artifact with Pyodide
2. ✅ Add notebook artifact alongside
3. ✅ Existing chats unaffected
4. ✅ Existing documents still work

### Feature Detection
```typescript
// Check if file is CSV/Excel
if (isDataFile(attachment)) {
  // Use notebook artifact
  tools.push('createNotebook');
} else {
  // Use regular code artifact
  tools.push('createDocument');
}
```

---

## 24. Performance Considerations

### Current Bottlenecks
1. **Pyodide loading** - 20-30 seconds first time
2. **File uploads** - Depends on file size
3. **Database queries** - Generally fast (<100ms)
4. **AI streaming** - 2-5 seconds for response

### New Bottlenecks (Potential)
1. **File processing** - CSV/Excel parsing (target: <2s)
2. **E2B sandbox creation** - Cold start (5-10s)
3. **Code execution** - Depends on complexity (target: <30s)
4. **Large file uploads** - 50MB limit

### Optimizations
1. **File caching in E2B** - Avoid re-uploads
2. **Sandbox reuse** - 30-minute sessions
3. **Parallel processing** - Parse while uploading
4. **Streaming execution** - Show logs in real-time
5. **Database indexes** - On chatId, userId, status

---

## 25. Security Considerations

### Current Security
1. ✅ NextAuth with credentials
2. ✅ CSRF protection
3. ✅ SQL injection prevention (Drizzle)
4. ✅ File size limits (40MB)
5. ✅ Rate limiting (per user)

### New Security Needs
1. ❗ File type validation (CSV/Excel only)
2. ❗ Code injection prevention (sanitize Python)
3. ❗ E2B sandbox isolation (built-in)
4. ❗ File path traversal prevention
5. ❗ Rate limiting on executions
6. ❗ Resource limits (memory, CPU)

---

## 26. Deployment Checklist

### Pre-Deployment
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] E2B API key configured and tested
- [ ] Redis provisioned
- [ ] File limits configured
- [ ] Rate limits configured

### Post-Deployment Monitoring
- [ ] E2B usage and costs
- [ ] Execution success rates
- [ ] File processing times
- [ ] Error rates
- [ ] User feedback

---

## Summary & Recommendations

### ✅ Ready to Implement
The codebase is **well-structured** and **production-ready**. The artifact system is perfect for adding notebook functionality. Key patterns are consistent and extensible.

### 🎯 Implementation Path
1. **Start with Phase 1** (file processing) - Low risk, isolated
2. **Test E2B thoroughly** in Phase 2 - Before integrating
3. **Build notebook artifact** in Phase 3 - Following existing patterns
4. **Integrate carefully** in Phase 4 - Test each modification
5. **Polish iteratively** in Phase 5 - Based on user feedback

### ⚠️ Watch Out For
1. **System prompts** - Most critical for code quality
2. **E2B costs** - Monitor usage closely
3. **File processing performance** - Large files could be slow
4. **State management** - Complex with multiple cells
5. **Error recovery** - Python errors can be cryptic

### 🚀 Confidence Level
**HIGH (90%+)** - The codebase supports the implementation plan well. Patterns are clear, extensible, and production-proven.

---

**Next Step**: Begin Phase 1 implementation following the IMPLEMENTATION_CHECKLIST.md

