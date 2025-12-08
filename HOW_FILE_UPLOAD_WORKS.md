# How File Upload Now Works - Complete Flow

## The Problem You Encountered

You uploaded a file and saw these issues:
1. Console log: "Found 0 file(s) in prompt" ❌
2. Wrong code generated (generic file discovery instead of loading your file) ❌
3. Build error about "notebook" type ❌

## The Root Cause

The message flow had a **fragmentation issue**:

```
User uploads file + types message
         ↓
multimodal-input.tsx sends:
  parts: [
    { type: "file", url: "https://...", name: "file.xlsx", mediaType: "..." },
    { type: "text", text: "Analyze this data" }
  ]
         ↓
message-sanitizer.ts (OLD VERSION) converts:
  parts: [
    { type: "text", text: "[Data file attached: file.xlsx]\nFile URL: https://..." },  ← Part 1
    { type: "text", text: "Analyze this data" }                                        ← Part 2
  ]
         ↓
Claude API receives TWO separate text parts
         ↓
notebook/server.ts extracts prompt (only gets Part 2: "Analyze this data")
         ↓
extractFileInfoFromPrompt() searches for "File URL:" in "Analyze this data" → NOT FOUND ❌
         ↓
Result: No files downloaded, Claude generates generic code
```

## The Fix

**Combined file info and user text into ONE text part:**

```typescript
// In message-sanitizer.ts (NEW VERSION):

// Separate file parts and text parts
const fileParts: any[] = [];
const textParts: any[] = [];

for (const part of message.parts) {
  if (part.type === "text") {
    textParts.push(part);
  } else if (part.type === "file" && !part.mediaType?.startsWith("image/")) {
    fileParts.push(part);
  }
}

// Convert file parts to descriptions
const fileDescriptions = fileParts.map((part) => {
  return `[Data file attached: ${part.name} (${part.mediaType})]\nFile URL: ${part.url}`;
}).join("\n\n");

// Combine with user text
const userText = textParts.map(p => p.text).join("\n");
const combinedText = fileDescriptions 
  ? `${fileDescriptions}\n\n${userText}`  // File info FIRST, then user text
  : userText;

// Return ONE text part containing both
const sanitizedParts = [
  ...imageParts,
  {
    type: "text",
    text: combinedText,  // ← Single combined text
  },
];
```

## The Correct Flow (After Fix)

```
User uploads file.xlsx + types "Analyze this data"
         ↓
multimodal-input.tsx sends:
  parts: [
    { type: "file", url: "https://...", name: "file.xlsx", mediaType: "..." },
    { type: "text", text: "Analyze this data" }
  ]
         ↓
message-sanitizer.ts (NEW VERSION) combines into ONE part:
  parts: [
    { 
      type: "text", 
      text: "[Data file attached: file.xlsx (application/vnd...)]\nFile URL: https://...\n\nAnalyze this data"
    }
  ]
         ↓
Claude API receives ONE text part with file info + user prompt
         ↓
notebook/server.ts extracts prompt (gets full combined text)
         ↓
extractFileInfoFromPrompt() searches for "File URL:" → FOUND ✅
Regex extracts: { name: "file.xlsx", url: "https://...", type: "application/..." }
         ↓
downloadFile() fetches from Vercel Blob ✅
         ↓
Claude sees: "File file.xlsx will be available at /sandbox/files/file.xlsx"
Claude generates: df = pd.read_excel('/sandbox/files/file.xlsx') ✅
         ↓
E2B sandbox created, file uploaded to /sandbox/files/ ✅
         ↓
Code executes with actual data ✅
         ↓
Results displayed in UI ✅
```

## Example Console Output (After Fix)

```
📧 Message Sanitizer:
  - Original file parts: 1
  - Sanitized text includes file URLs: true
  - Combined text preview: [Data file attached: solemates_directory.xlsx (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)]
File URL: https://xxxxx.public.blob.vercel-storage.com/solemates_directory-abc123.xlsx

Solemates Shoe Directory Analysis

📝 STEP 1: USER PROMPT RECEIVED
Full prompt: [Data file attached: solemates_directory.xlsx (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)]
File URL: https://xxxxx.public.blob.vercel-storage.com/solemates_directory-abc123.xlsx

Solemates Shoe Directory Analysis

📂 STEP 2: FILE EXTRACTION
Found 1 file(s) in prompt                    ← NOW IT FINDS THE FILE! ✅
  📁 File #1:
    - Name: solemates_directory.xlsx
    - Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    - URL: https://xxxxx.public.blob.vercel-storage.com/...

⬇️  STEP 3: DOWNLOADING FILES
  ⬇️  Downloading: solemates_directory.xlsx
  ✅ Downloaded 45678 bytes in 234ms          ← FILE DOWNLOADED! ✅

🤖 STEP 4: CLAUDE CODE GENERATION
...
📄 GENERATED PYTHON CODE:
import pandas as pd

# Load the Excel file that was uploaded
df = pd.read_excel('/sandbox/files/solemates_directory.xlsx')  ← CORRECT CODE! ✅

print("Dataset Overview:")
print(f"Shape: {df.shape}")
print(f"\nFirst 5 rows:")
print(df.head())
...

🔧 STEP 5: E2B SANDBOX EXECUTION
  📤 Uploading 1 file(s)...
  ✅ Uploaded solemates_directory.xlsx (45678 bytes) in 123ms  ← FILE IN SANDBOX! ✅

  ▶️  Executing Python code in sandbox...
    [stdout]: Dataset Overview:
    [stdout]: Shape: (150, 8)                 ← REAL DATA! ✅
    [stdout]: 
    [stdout]: First 5 rows:
    [stdout]:    shoe_id  brand     model  ...
    ...
```

## Key Changes Summary

| Component | Before | After |
|-----------|--------|-------|
| **message-sanitizer.ts** | Created separate text parts for file info and user text | Combines file info + user text into ONE text part |
| **File Extraction** | `extractFileInfoFromPrompt()` only checked user's text part | Now checks the combined text containing file URLs |
| **Claude Prompt** | Only saw user text: "Analyze this data" | Sees full context: "File uploaded: file.xlsx at URL https://... \n\n Analyze this data" |
| **Generated Code** | Generic: `files = os.listdir('.')` | Specific: `df = pd.read_excel('/sandbox/files/file.xlsx')` |
| **Database Schema** | Missing "notebook" enum value | Added "notebook" to kind enum ✅ |

## Testing Checklist

After `pnpm dev`, test:

- [ ] Upload Excel file → Should see "Found 1 file(s) in prompt" ✅
- [ ] Check STEP 3 → Should download file successfully ✅
- [ ] Check STEP 4 → Generated code should reference your file name ✅
- [ ] Check STEP 5 → File should be uploaded to sandbox ✅
- [ ] Check STEP 6 → Execution should show your actual data ✅
- [ ] UI → Console should display analysis results ✅

If you still see "Found 0 file(s)", check:
1. Is the file part being sent by multimodal-input? (Check browser network tab)
2. Is the sanitizer combining text correctly? (Check Message Sanitizer log)
3. Is the regex in extractFileInfoFromPrompt matching? (It looks for "File URL: https://")
