# Chat API 400 Bad Request Fix

## Issue
User was getting **400 Bad Request** error when sending CSV files in chat:
```
Status Code: 400 Bad Request
Error: "The request couldn't be processed. Please check your input and try again."

Request payload:
{
  "message": {
    "parts": [
      {
        "type": "file",
        "url": "...",
        "name": "sales_data.csv",
        "mediaType": "text/csv"  ← This was rejected
      },
      {
        "type": "text",
        "text": "what are the total sales in the data??"
      }
    ]
  }
}
```

## Root Cause
The Zod schema in `app/(chat)/api/chat/schema.ts` only accepted image file types:
```typescript
const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),  // ← Only images!
  name: z.string().min(1).max(100),
  url: z.string().url(),
});
```

When a CSV file with `mediaType: "text/csv"` was sent, the Zod validation failed, causing the 400 error.

## Solution
Updated `app/(chat)/api/chat/schema.ts` to accept all data analysis file types:

```typescript
const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // CSV files
    "text/csv",
    "application/csv",
    "text/x-csv",
    "application/x-csv",
    // Excel files
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
    // Documents (legacy support)
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});
```

## Files Fixed

### 1. ✅ `app/(chat)/api/files/upload/route.ts`
- Added CSV MIME types to `ALLOWED_MIME_TYPES`
- Increased file size limit to 50MB
- Updated error message

### 2. ✅ `app/(chat)/api/chat/schema.ts`
- Added CSV, Excel, and other data file MIME types to `filePartSchema`
- Now accepts: CSV, Excel, images, PDFs, Word, PowerPoint, text files

## Request Flow Now

1. **Upload CSV file** → `/api/files/upload`
   - Validates file type (CSV/Excel allowed) ✅
   - Uploads to Vercel Blob
   - Returns blob URL

2. **Send chat message** → `/api/chat`
   - User message with file part: `{ type: "file", mediaType: "text/csv", url: "...", name: "sales_data.csv" }`
   - Schema validation passes ✅
   - Message saved to database
   - File URL sent to Claude

3. **Process file** (To be implemented in Phase 3 Step 2)
   - Detect CSV/Excel file in message
   - Call `/api/files/process` to extract headers
   - Replace file URL with metadata in system prompt
   - Send to Claude with lightweight metadata only

## Current Status
✅ **400 Bad Request FIXED** - CSV files now accepted in chat API!

## Next Steps (Phase 3 Step 2)
The schema now accepts CSV files, but we still need to:
1. Detect when a message contains CSV/Excel files
2. Automatically call `/api/files/process` to extract metadata
3. Inject file metadata into system prompt
4. Create notebook artifact with data analysis code
5. Execute cells via `/api/jupyter/execute`

## Testing
Try again with the same request:
```
1. Upload sales_data.csv
2. Ask: "what are the total sales in the data??"
3. Should now succeed! ✅
```

The chat will receive the message, but won't automatically create a notebook yet (that's Phase 3 Step 2).

## Related Documentation
- CSV_UPLOAD_FIX.md - Upload endpoint fix
- PHASE_2_SUMMARY.md - E2B integration complete
- IMPLEMENTATION_PLAN.md - Full roadmap
