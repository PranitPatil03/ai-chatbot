# 🧪 Quick Testing Guide - Data Analysis Chatbot

## Prerequisites
- ✅ E2B API key configured in `.env.local`
- ✅ Development server running
- ✅ Test file ready: `test-data/sales_data.csv`

## Test 1: Document Creation (404 Fix)

### Steps:
1. Open browser console (Cmd+Option+I or F12)
2. Upload `sales_data.csv`
3. Type: **"analyze the total sales in this data"**
4. Press Enter

### Expected Console Output:
```bash
[Chat API] Detected data file: { name: 'sales_data.csv' }
[File Process API] CSV parsed successfully: { headers: 6, rowCount: 20 }
[CreateDocument Tool] Called with: { title: 'Sales Data Analysis', kind: 'notebook' }
[Notebook Server] Creating notebook
[DocumentHandler] Saving document to database...
[DB] saveDocument called: { id: 'xxx' }
[DB] Document saved successfully
[Notebook Artifact] Initializing with chatId: abc-123
```

### ✅ Success Criteria:
- [ ] No `404 (Not Found)` errors
- [ ] Notebook artifact appears on right side
- [ ] Code cells are visible
- [ ] Artifact stays visible (doesn't disappear)

### ❌ If You See:
```bash
GET /api/document?id=xxx 404 (Not Found)
```
**Problem**: Old code still running. **Solution**: Restart dev server.

---

## Test 2: Individual Cell Execution

### Steps:
1. After notebook is created (from Test 1)
2. Hover over the first code cell
3. Click the **Play** button (or press Cmd/Ctrl+Enter)

### Expected Console Output:
```bash
[Notebook] Execute cell: { cellId: 'cell-1', code: 'import pandas...' }
[Notebook] Execution result: { success: true, executionTime: 1234 }
```

### ✅ Success Criteria:
- [ ] Cell status changes: idle → running (spinner) → success (green check)
- [ ] Output appears below the cell
- [ ] Execution count appears: `[1]`
- [ ] Execution time shown: "Executed in XXXms"

---

## Quick Commands

### Restart Server:
```bash
# Stop current server
Ctrl+C

# Start fresh
pnpm dev
```

### Check E2B Connection:
```bash
# Test E2B API
curl -X POST http://localhost:3000/api/jupyter/execute \
  -H "Content-Type: application/json" \
  -d '{"chatId":"test","code":"print(123)"}'
```

---

**Ready to test?** Follow the steps above in order! 🚀
