# Critical Bug Fix - Messages Not Being Passed Through Wrapper

## The Bug 🐛

Even though we added `messages` parameter throughout the chain, there was a **missing link** in the wrapper function!

### What Was Happening:

```
route.ts → createDocument({ messages: sanitizedMessages })  ✅
                    ↓
createDocument tool → onCreateDocument({ messages })  ✅
                    ↓
createDocumentHandler wrapper → config.onCreateDocument({
  id: args.id,
  title: args.title,
  dataStream: args.dataStream,
  session: args.session,
  // ❌ messages: args.messages  ← MISSING!
})
                    ↓
notebookDocumentHandler receives { messages: undefined }  ❌
```

### The Fix:

**File:** `lib/artifacts/server.ts`

```typescript
// Before (WRONG):
onCreateDocument: async (args: CreateDocumentCallbackProps) => {
  const draftContent = await config.onCreateDocument({
    id: args.id,
    title: args.title,
    dataStream: args.dataStream,
    session: args.session,
    // ❌ messages not passed!
  });
}

// After (CORRECT):
onCreateDocument: async (args: CreateDocumentCallbackProps) => {
  const draftContent = await config.onCreateDocument({
    id: args.id,
    title: args.title,
    dataStream: args.dataStream,
    session: args.session,
    messages: args.messages, // ✅ Pass messages through!
  });
}
```

---

## Why This Happened

The `createDocumentHandler` is a **wrapper function** that:
1. Receives arguments from the tool
2. Calls the actual handler (e.g., `notebookDocumentHandler`)
3. Saves the document

We added `messages?` to the `CreateDocumentCallbackProps` type, but **forgot to pass it through the wrapper**. This is a classic "middle layer" bug!

---

## Complete Flow (Now Fixed)

### 1. User uploads file + types message
```typescript
// multimodal-input.tsx
parts: [
  { type: "file", url: "https://...", name: "file.xlsx", ... },
  { type: "text", text: "Analyze this data" }
]
```

### 2. Message sanitizer combines them
```typescript
// message-sanitizer.ts
sanitizedMessages = [{
  role: "user",
  parts: [{
    type: "text",
    text: "[Data file attached: file.xlsx]\nFile URL: https://...\n\nAnalyze this data"
  }]
}]
```

### 3. Route passes to createDocument tool
```typescript
// route.ts
createDocument({ 
  session, 
  dataStream, 
  messages: sanitizedMessages  ✅
})
```

### 4. Tool passes to document handler
```typescript
// create-document.ts
await documentHandler.onCreateDocument({
  id,
  title,
  dataStream,
  session,
  messages,  ✅
});
```

### 5. **Wrapper NOW passes to actual handler** ✅ FIXED!
```typescript
// artifacts/server.ts (createDocumentHandler wrapper)
const draftContent = await config.onCreateDocument({
  id: args.id,
  title: args.title,
  dataStream: args.dataStream,
  session: args.session,
  messages: args.messages,  ✅ NOW INCLUDED!
});
```

### 6. Notebook handler receives full messages
```typescript
// artifacts/notebook/server.ts
onCreateDocument: async ({ messages }) => {
  const lastUserMessage = messages?.findLast(m => m.role === "user");
  const userPrompt = lastUserMessage?.parts
    .filter(part => part.type === "text")
    .map(part => part.text)
    .join("\n");
  
  // userPrompt now contains: "[Data file attached: file.xlsx]\nFile URL: https://..."
  const fileInfos = extractFileInfoFromPrompt(userPrompt);  ✅ FINDS FILE!
}
```

---

## Expected Output (After Fix + Restart)

```bash
pnpm dev

# Upload file → Type "Analyze this data"

📧 Message Sanitizer:
  - Original file parts: 1
  - Sanitized text includes file URLs: true ✅

📦 createDocument tool:
  - messages passed? true ✅
  - messages count: 2
  - last message parts: 1
    - Part 0 (text): [Data file attached: solemates_shoe_directory.xlsx]...

🔍 DEBUG: Checking messages parameter
  - messages defined? true ✅
  - messages length: 2
  - lastUserMessage found? true ✅
  - lastUserMessage parts: 1
  - Part 0: type=text, preview=[Data file attached: solemates_shoe_directory.xlsx]
File URL: https://qlr1wqro1p9fzjc1...

📝 STEP 1: USER PROMPT RECEIVED
Full prompt: [Data file attached: solemates_shoe_directory.xlsx (application/vnd...)]
File URL: https://qlr1wqro1p9fzjc1.public.blob.vercel-storage.com/...

Analyze this data  ✅ FULL PROMPT WITH FILE URL!

📂 STEP 2: FILE EXTRACTION
Found 1 file(s) in prompt  ✅ NOT 0!
  File 1:
    - Name: solemates_shoe_directory.xlsx
    - URL: https://qlr1wqro1p9fzjc1...
    - Type: XLSX

⬇️  STEP 3: DOWNLOADING FILES
  → Downloading: solemates_shoe_directory.xlsx
  ✅ Downloaded 45678 bytes in 234ms  ✅

🤖 STEP 4: CLAUDE CODE GENERATION
Enhanced User Prompt: [Data file attached: solemates_shoe_directory.xlsx]...
Note: The following files are available in the current directory: solemates_shoe_directory.xlsx

📄 GENERATED PYTHON CODE:
import pandas as pd

# Load the Excel file
df = pd.read_excel('solemates_shoe_directory.xlsx')  ✅ LOADS YOUR FILE!

# Gender distribution analysis
print("Gender Distribution:")
print(df['gender'].value_counts())
...

🔧 STEP 5: E2B SANDBOX EXECUTION
  📤 Uploading 1 file(s)...
  ✅ Uploaded solemates_shoe_directory.xlsx (45678 bytes) in 123ms  ✅

  ▶️  Executing Python code...
    [stdout]: Gender Distribution:
    [stdout]: Men      120
    [stdout]: Women     80  ✅ YOUR DATA!

✅ NOTEBOOK CREATION COMPLETED SUCCESSFULLY
```

---

## Files Changed in This Fix

1. ✅ `lib/artifacts/server.ts` - Added `messages: args.messages` to wrapper
2. ✅ `artifacts/notebook/server.ts` - Added debug logging
3. ✅ `lib/ai/tools/create-document.ts` - Added debug logging

---

## Testing

1. **Restart dev server**: `pnpm dev`
2. **Upload your Excel file**
3. **Type**: "Analyze this data"
4. **Check terminal** - You should now see:
   - "messages defined? true" ✅
   - "Found 1 file(s) in prompt" ✅
   - "Downloaded X bytes" ✅
   - Real data in output ✅

**This was the missing piece!** The wrapper function was blocking `messages` from reaching the handlers. Now it should work! 🎉
