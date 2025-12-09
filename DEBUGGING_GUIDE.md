# Debugging Guide - Notebook Artifact 404 and Parse Errors

## Errors Observed

1. **404 Not Found**: `GET /api/document?id=d476e12b-11ff-4c5b-b6d7-ba3a15f04167 404`
2. **JSON Parse Error**: `Failed to parse notebook content: SyntaxError: Unexpected end of JSON input`
3. **React Key Warning**: `Each child in a list should have a unique "key" prop`
4. **TypeError**: `Cannot read properties of undefined (reading 'trim')`

## Fixes Applied

### 1. ✅ Enhanced Client Error Handling (`artifacts/notebook/client.tsx`)

**Added comprehensive logging:**
```typescript
console.log('[Notebook Client] Content received:', {
  length: content?.length,
  isEmpty: !content,
  preview: content?.substring(0, 100)
});
```

**Fixed trim() error:**
```typescript
// Before
disabled={isExecuting || !cell.content.trim()}

// After
disabled={isExecuting || !cell.content || !cell.content.trim()}
```

**Better empty content handling:**
```typescript
if (!content || content.trim() === '') {
  console.log('[Notebook Client] Empty content, initializing with default cell');
  setCells([{ id: 'cell-1', type: 'code', content: '', status: 'idle' }]);
  return;
}
```

### 2. ✅ Added Server Logging (`artifacts/notebook/server.ts`)

**onCreate logging:**
```typescript
console.log('[Notebook Server] Creating notebook, title:', title);
console.log('[Notebook Server] onCreate streaming cells:', {
  cellCount: cells.length,
  contentLength: content.length,
  preview: content.substring(0, 100)
});
console.log('[Notebook Server] onCreate final content:', {
  length: draftContent.length,
  isEmpty: !draftContent
});
```

**onUpdate logging:**
```typescript
console.log('[Notebook Server] Updating notebook');
console.log('[Notebook Server] onUpdate streaming cells:', { ... });
console.log('[Notebook Server] onUpdate final content:', { ... });
```

## Root Cause Analysis

### Issue 1: 404 Not Found
**Possible causes:**
1. Document not saved to database
2. Document ID mismatch
3. createDocument tool not being called
4. Empty content not being saved

**What to check in console:**
```bash
# Should see:
[Notebook Server] Creating notebook, title: "Analyze sales data"
[Notebook Server] onCreate streaming cells: { cellCount: X, contentLength: Y }
[Notebook Server] onCreate final content: { length: Y, isEmpty: false }

# If missing or isEmpty: true → Document not being created!
```

### Issue 2: JSON Parse Error
**Possible causes:**
1. Content is empty string ("")
2. Content is incomplete JSON
3. Streaming not completing
4. Wrong data format

**What to check in console:**
```bash
# Should see:
[Notebook Client] Content received: { length: 500, isEmpty: false, preview: "[{\"id\":..." }
[Notebook Client] Parsed successfully: { isArray: true, cellCount: 3 }

# If length: 0 or isEmpty: true → Content not being sent!
```

### Issue 3: createDocument Not Called
**Possible causes:**
1. System prompt not instructing Claude to use tool
2. Claude responding with text instead
3. Tool not registered properly

**What to check:**
- Does Claude's response contain tool call?
- Check if `createDocument` appears in the API logs
- Verify artifactPrompt includes notebook instructions

## Expected Console Flow

### Successful Flow:
```bash
# 1. File processing
[Chat API] Detected data file: { name: 'sales_data.csv' }
[File Process API] CSV parsed successfully: { headers: 6, rowCount: 20 }
[Chat API] File processed successfully
[Chat API] Processed parts: { types: ['text', 'text'] }

# 2. Claude creates artifact
[Notebook Server] Creating notebook, title: "Sales Data Analysis"

# 3. Streaming cells
[Notebook Server] onCreate streaming cells: { cellCount: 1, contentLength: 150 }
[Notebook Server] onCreate streaming cells: { cellCount: 2, contentLength: 300 }
[Notebook Server] onCreate streaming cells: { cellCount: 3, contentLength: 500 }

# 4. Final content
[Notebook Server] onCreate final content: { length: 500, isEmpty: false }

# 5. Client receives
[Notebook Client] Content received: { length: 500, isEmpty: false }
[Notebook Client] Parsed successfully: { isArray: true, cellCount: 3 }

# 6. Success!
✅ Notebook displayed with 3 cells
```

### Failed Flow (Empty Content):
```bash
# 1-4 Same as above...

# 5. Client receives EMPTY
[Notebook Client] Content received: { length: 0, isEmpty: true }
[Notebook Client] Empty content, initializing with default cell

# 6. Fallback
⚠️ Notebook shows single empty cell
❌ Original code not displayed
```

## Debugging Steps

### Step 1: Check if Claude calls createDocument

Look for this in console:
```bash
# Should see tool call
createDocument called with kind: "notebook"
```

If NOT present:
- Claude is not using the tool
- System prompt issue
- Check `lib/ai/prompts.ts` - artifactsPrompt

### Step 2: Check if handler is called

Look for:
```bash
[Notebook Server] Creating notebook, title: "..."
```

If NOT present:
- Handler not registered
- Check `lib/artifacts/server.ts`
- Verify notebookDocumentHandler in array

### Step 3: Check if content is generated

Look for:
```bash
[Notebook Server] onCreate streaming cells: { cellCount: X, ... }
```

If cellCount is 0 or no logs:
- streamObject not working
- Claude not generating cells
- Schema validation failing

### Step 4: Check final content

Look for:
```bash
[Notebook Server] onCreate final content: { length: X, isEmpty: false }
```

If isEmpty: true or length: 0:
- Content not being accumulated
- draftContent not being set
- Return statement issue

### Step 5: Check client parsing

Look for:
```bash
[Notebook Client] Content received: { length: X, isEmpty: false }
[Notebook Client] Parsed successfully: { isArray: true, cellCount: X }
```

If parse fails:
- Invalid JSON format
- Content corrupted
- Wrong data structure

## Quick Fix Checklist

If you see 404 errors:
- [ ] Check console for `[Notebook Server] Creating notebook`
- [ ] Check if content length > 0
- [ ] Verify document is saved to database
- [ ] Check document ID matches

If you see parse errors:
- [ ] Check content is not empty
- [ ] Verify JSON format is valid array
- [ ] Check for incomplete streaming

If Claude doesn't create artifact:
- [ ] Verify system prompt includes data analysis instructions
- [ ] Check if createDocument tool is available
- [ ] Confirm file metadata is in message

## Next Test

1. Upload sales_data.csv
2. Ask: "analyze the sales data"
3. Watch console logs carefully
4. Note where the flow breaks
5. Share the console output

The logs will tell us exactly where the problem is! 🔍
