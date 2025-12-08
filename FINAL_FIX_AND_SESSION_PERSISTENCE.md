# Final Fix - File URLs Now Passed to Sandbox + Session Persistence Explanation

## Issue: File Not Reaching Sandbox

### The Problem
Even though the message sanitizer was working correctly, the file information wasn't reaching the notebook creation function.

**Flow was:**
```
User uploads file → sanitizer combines file URL + text ✅
                                ↓
                    Claude generates title: "Shoe Directory Analysis"
                                ↓
                    createDocument tool called with ONLY title
                                ↓
                    Notebook server receives ONLY title ❌
                                ↓
                    extractFileInfoFromPrompt(title) → No file URLs found ❌
```

### Root Cause
The `createDocument` tool only passed `title` to the document handler, but the file URLs were in the **sanitized messages** (from the message sanitizer), not in the title.

### The Fix

**Added `messages` parameter throughout the chain:**

1. **Updated Type Definitions** (`lib/artifacts/server.ts`):
```typescript
export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  messages?: ChatMessage[]; // ✅ NEW: Contains sanitized messages with file URLs
};
```

2. **Updated createDocument Tool** (`lib/ai/tools/create-document.ts`):
```typescript
type CreateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  messages?: ChatMessage[]; // ✅ NEW: Sanitized messages
};

export const createDocument = ({ session, dataStream, messages }: CreateDocumentProps) =>
  tool({
    // ...
    execute: async ({ title, kind }) => {
      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
        messages, // ✅ Pass sanitized messages
      });
    },
  });
```

3. **Updated Route** (`app/(chat)/api/chat/route.ts`):
```typescript
// Before: Only passed session and dataStream
createDocument: createDocument({ session, dataStream }),

// After: Also pass sanitized messages
createDocument: createDocument({ 
  session, 
  dataStream, 
  messages: sanitizedMessages  // ✅ Contains file URLs!
}),
```

4. **Updated Notebook Server** (`artifacts/notebook/server.ts`):
```typescript
onCreateDocument: async ({ title, dataStream, messages }) => {
  // ✅ Extract last user message (contains file URLs from sanitizer)
  const lastUserMessage = messages?.findLast(m => m.role === "user");
  const userPrompt = lastUserMessage?.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === "text")
    .map(part => part.text)
    .join("\n") || title;

  console.log("Full prompt:", userPrompt); // Now has file URLs!
  
  // Extract file information from the FULL prompt (not just title)
  const fileInfos = extractFileInfoFromPrompt(userPrompt);  // ✅ Now finds files!
  
  // ... rest of the code
}
```

### New Flow (Fixed)
```
User uploads file → sanitizer combines: "[Data file attached: file.xlsx]\nFile URL: https://..."
                                ↓
                    messages = [{ role: "user", parts: [{ text: "...File URL..." }] }]
                                ↓
                    createDocument({ messages: sanitizedMessages })  ✅
                                ↓
                    Notebook server receives messages ✅
                                ↓
                    Extracts lastUserMessage.parts[0].text → Contains file URLs! ✅
                                ↓
                    extractFileInfoFromPrompt(userPrompt) → Finds file! ✅
                                ↓
                    Downloads file → Uploads to sandbox ✅
                                ↓
                    Claude generates correct code: df = pd.read_excel('file.xlsx') ✅
```

---

## Expected Console Output (After Fix)

```bash
📧 Message Sanitizer:
  - Original file parts: 1
  - Sanitized text includes file URLs: true ✅
  - Combined text preview: [Data file attached: solemates_shoe_directory.xlsx ...]
    File URL: https://xxxxx.blob.vercel-storage.com/...

🚀 NOTEBOOK CREATION STARTED

📝 STEP 1: USER PROMPT RECEIVED
Full prompt: [Data file attached: solemates_shoe_directory.xlsx (application/vnd...)]
File URL: https://xxxxx.blob.vercel-storage.com/5842e655-987b-...

Shoe Directory Analysis - Men vs Women Distribution  ✅ FULL PROMPT WITH FILE URL!

📂 STEP 2: FILE EXTRACTION
Found 1 file(s) in prompt  ✅ NOT 0!
  File 1:
    - Name: solemates_shoe_directory.xlsx
    - URL: https://xxxxx.blob.vercel-storage.com/...
    - Type: XLSX

⬇️  STEP 3: DOWNLOADING FILES
  → Downloading: solemates_shoe_directory.xlsx
    From: https://qlr1wqro1p9fzjc1.public.blob.vercel-storage...
  ✅ Downloaded 45678 bytes in 234ms  ✅ FILE DOWNLOADED!

🤖 STEP 4: CLAUDE CODE GENERATION
Enhanced User Prompt: [Data file attached: solemates_shoe_directory.xlsx]...
Note: The following files are available in the current directory: solemates_shoe_directory.xlsx  ✅

📄 GENERATED PYTHON CODE:
import pandas as pd

# Load the Excel file
df = pd.read_excel('solemates_shoe_directory.xlsx')  ✅ LOADS YOUR FILE!

print("Gender Distribution:")
print(df['gender'].value_counts())
...

🔧 STEP 5: E2B SANDBOX EXECUTION
  📤 Uploading 1 file(s)...
  ✅ Uploaded solemates_shoe_directory.xlsx (45678 bytes) in 123ms  ✅

  ▶️  Executing Python code...
    [stdout]: Gender Distribution:
    [stdout]: Men      120
    [stdout]: Women     80  ✅ ACTUAL DATA!
    [stdout]: Name: gender, dtype: int64

✅ NOTEBOOK CREATION COMPLETED SUCCESSFULLY
```

---

## Question 2: Session Persistence with Multiple Cells

You asked:
> "is there someway i can use the same sandbox for session with multiple cell for different or more prompts for given time ??"

### Current Architecture (Single Execution)

Right now, **each notebook creation = 1 sandbox = 1 code execution**:

```typescript
// In executeCodeWithE2B():
const sandbox = await CodeInterpreter.create({ timeoutMs: 5 * 60 * 1000 });
try {
  // Upload files
  // Execute code
  // Get results
} finally {
  await sandbox.kill();  // ❌ Sandbox destroyed immediately
}
```

**Limitations:**
- ✅ Simple and reliable
- ✅ No state persistence issues
- ❌ Can't build on previous executions
- ❌ Each execution downloads files again
- ❌ Variables don't persist between updates

### Proposed Architecture (Persistent Session)

**Option A: Session-Based Sandboxes (Recommended)**

Store sandbox per chat session, reuse for multiple cells:

```typescript
// Global sandbox manager
const activeSandboxes = new Map<string, {
  sandbox: CodeInterpreter;
  expiresAt: number;
  files: Set<string>;
}>();

// In notebook server:
export async function getOrCreateSandbox(chatId: string, files: FileInfo[]) {
  const existing = activeSandboxes.get(chatId);
  
  // Reuse if exists and not expired
  if (existing && Date.now() < existing.expiresAt) {
    console.log("♻️  Reusing existing sandbox for chat:", chatId);
    
    // Upload any new files
    for (const file of files) {
      if (!existing.files.has(file.name)) {
        await existing.sandbox.files.write(file.name, file.content);
        existing.files.add(file.name);
      }
    }
    
    // Extend expiration
    existing.expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
    return existing.sandbox;
  }
  
  // Create new sandbox
  console.log("🆕 Creating new sandbox for chat:", chatId);
  const sandbox = await CodeInterpreter.create({ 
    timeoutMs: 30 * 60 * 1000  // 30 minutes
  });
  
  // Upload files
  for (const file of files) {
    await sandbox.files.write(file.name, file.content);
  }
  
  // Store sandbox
  activeSandboxes.set(chatId, {
    sandbox,
    expiresAt: Date.now() + 30 * 60 * 1000,
    files: new Set(files.map(f => f.name)),
  });
  
  // Cleanup expired sandboxes periodically
  scheduleCleanup();
  
  return sandbox;
}

// Execution becomes:
const sandbox = await getOrCreateSandbox(chatId, files);
const execution = await sandbox.notebook.execCell(code);  // ✅ State persists!
// Don't kill sandbox - let it expire or be reused
```

**Benefits:**
- ✅ Variables persist across cells: `df` defined in cell 1 available in cell 2
- ✅ Files uploaded once, reused
- ✅ Faster subsequent executions
- ✅ Can build analysis incrementally
- ✅ 30-minute session = many iterations

**Implementation Changes Needed:**

1. Add `chatId` to document handlers:
```typescript
export type CreateDocumentCallbackProps = {
  // ...existing fields
  chatId: string;  // NEW
};
```

2. Update executeCodeWithE2B signature:
```typescript
async function executeCodeWithE2B(
  code: string,
  files: Array<{ name: string; content: Buffer }>,
  chatId: string  // NEW
): Promise<NotebookExecution> {
  const sandbox = await getOrCreateSandbox(chatId, files);
  // ... execute and return results
  // DON'T kill sandbox
}
```

3. Add cleanup on chat deletion:
```typescript
// In DELETE /api/history or chat close
async function closeChatSession(chatId: string) {
  const sandboxInfo = activeSandboxes.get(chatId);
  if (sandboxInfo) {
    await sandboxInfo.sandbox.kill();
    activeSandboxes.delete(chatId);
    console.log("🧹 Cleaned up sandbox for chat:", chatId);
  }
}
```

4. Scheduled cleanup for expired sandboxes:
```typescript
setInterval(() => {
  const now = Date.now();
  for (const [chatId, info] of activeSandboxes.entries()) {
    if (now > info.expiresAt) {
      info.sandbox.kill();
      activeSandboxes.delete(chatId);
      console.log("⏰ Expired sandbox for chat:", chatId);
    }
  }
}, 5 * 60 * 1000);  // Check every 5 minutes
```

### Usage Example (With Persistent Session)

**Cell 1:**
```python
import pandas as pd
df = pd.read_excel('sales.xlsx')
print(df.shape)  # (1000, 10)
```

**Cell 2** (in same chat):
```python
# df still exists from Cell 1! ✅
print(df['category'].value_counts())
```

**Cell 3** (in same chat):
```python
# df still exists! ✅
import matplotlib.pyplot as plt
df['sales'].plot()
plt.savefig('chart.png')
```

---

## Recommendation

**For v1 (Current):** Keep single-execution model - it's simpler and works
**For v2 (Future):** Implement session-based sandboxes for:
- Multi-cell notebooks
- Variable persistence
- Faster iterations
- Better UX for data analysis

The persistent session would be especially useful for exploratory data analysis where users want to:
1. Load data
2. Clean it
3. Analyze it
4. Visualize it
5. Iterate based on findings

All without re-loading the file each time!

---

## Testing

After `pnpm dev`, test:

1. **Upload Excel file**
2. **Type prompt:** "Analyze this data"
3. **Check logs - should see:**
   - "Found 1 file(s) in prompt" ✅
   - "Downloaded X bytes" ✅
   - "Uploaded file to sandbox" ✅
   - Python code with your filename ✅
   - Actual data in output ✅

If it works, the notebook will show real analysis of your data! 🎉
