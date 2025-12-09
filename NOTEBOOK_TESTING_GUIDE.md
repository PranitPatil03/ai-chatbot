# Jupyter Notebook Testing Guide

## Quick Test Steps

### Test 1: Create Notebook with Code Execution
1. Start the application: `pnpm dev`
2. Upload a CSV file (e.g., sales data, student records)
3. Ask: "Create a notebook to analyze this data"
4. **Expected Results**:
   - ✅ Notebook artifact opens in sidebar
   - ✅ Multiple code cells appear with Python code
   - ✅ Code is read-only (cannot edit)
   - ✅ Cells auto-execute immediately
   - ✅ Outputs appear below each cell
   - ✅ Execution counts show [1], [2], [3], etc.
   - ✅ Status shows "Ready" when complete
   - ✅ Header shows "X cells • Read-only"

### Test 2: Verify Outputs are Saved
1. After notebook creation (from Test 1)
2. Check browser console for logs:
   ```
   [Notebook Save] Saving notebook state: { ... hasOutputs: true ... }
   [Notebook Save] Document saved successfully
   ```
3. **Expected Results**:
   - ✅ Console shows successful save with outputs
   - ✅ No error messages
   - ✅ Output count > 0 for cells with outputs

### Test 3: Reopen Notebook and Verify Persistence
1. Close the notebook (click X button)
2. Scroll up in chat to find the notebook message
3. Click on the notebook artifact to reopen it
4. **Expected Results**:
   - ✅ All cells display with their code
   - ✅ All outputs display exactly as before
   - ✅ Execution counts preserved [1], [2], [3]
   - ✅ No need to re-execute
   - ✅ Images/charts still visible
   - ✅ Status shows "Ready"

### Test 4: Download Notebook with Outputs
1. With notebook open
2. Click the "Download" action button (down arrow icon)
3. Open the downloaded `.ipynb` file
4. **Expected Results**:
   - ✅ File downloads as `data-analysis-[timestamp].ipynb`
   - ✅ Can open in Jupyter Lab/Notebook
   - ✅ All code cells present
   - ✅ All outputs present below cells
   - ✅ Images/visualizations display
   - ✅ Execution counts match

### Test 5: Verify Read-Only Mode
1. With notebook open
2. Try to click on code cells
3. **Expected Results**:
   - ✅ No cursor appears in code
   - ✅ Cannot type or edit code
   - ✅ Code displays in `<pre>` tags (not textarea)
   - ✅ Header shows "Read-only" indicator
   - ✅ No "Add Cell" button visible

### Test 6: Test Different Output Types

#### Text Output
Ask: "Create a notebook that prints 'Hello World' and shows basic Python operations"
- ✅ Text output appears in bordered box
- ✅ Monospace font for code output
- ✅ Proper line breaks preserved

#### Image Output (Matplotlib)
Ask: "Create a notebook to visualize the data with a bar chart"
- ✅ PNG image displays below cell
- ✅ Image scales properly
- ✅ Image included in download

#### Error Output
Ask: "Create a notebook that intentionally has a division by zero error"
- ✅ Error appears in red box
- ✅ Error icon visible
- ✅ Error message readable
- ✅ Traceback included

#### Table Output
Ask: "Show the first 10 rows of the data"
- ✅ Table formatted properly
- ✅ Monospace font
- ✅ Scrollable if wide

### Test 7: Run All Action
1. With notebook open
2. Click "Run All" action button
3. **Expected Results**:
   - ✅ Status changes to "Initializing"
   - ✅ Cells show running status one by one
   - ✅ New outputs replace old ones
   - ✅ Execution counts increment
   - ✅ Status returns to "Ready"
   - ✅ Changes auto-saved to database

## Manual API Tests

### Test Save Endpoint
```bash
# Get a valid session token first, then:
curl -X POST http://localhost:3000/api/notebook/save \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-chat-123",
    "documentId": "test-doc-123",
    "cells": [
      {
        "id": "cell-1",
        "type": "code",
        "content": "print(\"Hello World\")",
        "status": "success",
        "outputs": [
          {
            "type": "text",
            "content": "Hello World\n"
          }
        ],
        "executionCount": 1,
        "executionTime": 125
      }
    ]
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "documentId": "test-doc-123",
  "cellCount": 1
}
```

## Database Verification

### Check Saved Content
```sql
-- Check if notebook is saved
SELECT id, title, kind, LENGTH(content) as content_length, created_at 
FROM Document 
WHERE kind = 'code' AND title = 'Data Analysis'
ORDER BY created_at DESC 
LIMIT 5;

-- View actual content
SELECT id, title, content 
FROM Document 
WHERE id = 'your-document-id'
ORDER BY created_at DESC 
LIMIT 1;
```

The content should be valid JSON like:
```json
[
  {
    "id": "cell-1",
    "type": "code",
    "content": "import pandas as pd\n...",
    "status": "success",
    "outputs": [
      {
        "type": "text",
        "content": "..."
      }
    ],
    "executionCount": 1,
    "executionTime": 523
  }
]
```

## Console Log Checks

### Look for These Logs

#### On Creation:
```
[Notebook Server] Creating notebook
[Notebook Server] onCreate streaming cells
[Notebook Client] Content received
[Notebook Client] Parsed JSON successfully
[Notebook] Auto-executing all cells individually
[Notebook] Auto-executing cell 1/3
[Notebook] Execution result: { success: true }
[Notebook Save] Saving notebook state
[Notebook Save] Document saved successfully
```

#### On Reopening:
```
[Notebook Client] Content received: { length: 1234, ... }
[Notebook Client] Parsed JSON successfully: { cellCount: 3 }
[Notebook Client] Setting cells: [ ... ]
```

#### On Download:
```
[Notebook] Downloading as .ipynb with outputs
[Notebook] Download complete with 3 cells and outputs
```

## Common Issues & Solutions

### Issue: Outputs not showing
**Check**:
- Browser console for errors
- `cell.outputs` array is populated
- Output types are valid ('text', 'image', 'error', 'table')

### Issue: Cells empty on reopen
**Check**:
- Database content is valid JSON
- Content length > 0
- No parsing errors in console
- Cell IDs are unique

### Issue: Download missing outputs
**Check**:
- Cells have executed (executionCount > 0)
- Outputs exist in cell.outputs array
- Download action completes without errors

### Issue: Cannot see code
**Check**:
- `cell.content` is not empty
- Content is a string
- Pre tag renders properly

## Performance Tests

### Large Dataset (10,000+ rows)
- ✅ Notebook creates successfully
- ✅ Execution completes < 10 seconds
- ✅ Outputs display without lag
- ✅ Save completes < 2 seconds
- ✅ Reopen loads < 1 second

### Many Cells (10+ cells)
- ✅ All cells execute sequentially
- ✅ All outputs display
- ✅ Scroll works smoothly
- ✅ No memory issues

### Large Outputs
- ✅ Long text outputs (>1000 lines) scroll properly
- ✅ Large images display correctly
- ✅ Tables with many columns scroll horizontally

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari
- [ ] Mobile Chrome

## Edge Cases

### Empty Notebook
- Ask: "Create an empty notebook"
- ✅ Shows "No cells available"

### Only Markdown Cells
- ✅ Displays markdown properly
- ✅ No execution attempts

### Mixed Code and Markdown
- ✅ Both types display correctly
- ✅ Only code cells execute

### Network Failure During Execution
- ✅ Error message displays
- ✅ Cell shows error status
- ✅ Can retry with "Run All"

### Session Expired
- ✅ Clear error message
- ✅ Suggests refresh

## Success Criteria

All tests pass when:
- ✅ Code executes and outputs display immediately
- ✅ Outputs persist in database with cells
- ✅ Reopening shows all code and outputs exactly as before
- ✅ Code is completely read-only
- ✅ Downloaded .ipynb files include all outputs
- ✅ UI is clean, modern, and professional
- ✅ No console errors
- ✅ Performance is acceptable
- ✅ Works across browsers

## Automated Test (Optional)

Create `test-notebook-complete.ts`:
```typescript
// TODO: Add automated E2E test using Playwright
// 1. Create notebook
// 2. Verify outputs appear
// 3. Close and reopen
// 4. Verify persistence
// 5. Download and verify .ipynb format
```

## Next Steps After Testing

If all tests pass:
1. ✅ Mark as production ready
2. ✅ Deploy to staging
3. ✅ User acceptance testing
4. ✅ Deploy to production
5. ✅ Monitor for issues

If issues found:
1. Document the issue
2. Check relevant logs
3. Review code changes
4. Create fix
5. Re-test
