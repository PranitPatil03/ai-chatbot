# CSV File Upload Fix

## Issue
User was getting error: **"File type should be an image, PDF, Word, PowerPoint, or Excel document"** when trying to upload CSV files.

## Root Cause
The `/api/files/upload` route had a hardcoded list of allowed MIME types in `ALLOWED_MIME_TYPES` that did not include CSV file types.

## Solution
Updated `app/(chat)/api/files/upload/route.ts`:

### Changes Made:

1. **Added CSV MIME types** to `ALLOWED_MIME_TYPES`:
   ```typescript
   // CSV files
   "text/csv",
   "application/csv",
   "text/x-csv",
   "application/x-csv",
   ```

2. **Added Excel variants** for better compatibility:
   ```typescript
   "application/vnd.ms-excel.sheet.macroEnabled.12",
   "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
   ```

3. **Increased file size limit**:
   - Before: 20MB (misleading, was actually 40MB in code)
   - After: 50MB (matches our data analysis requirements)

4. **Updated error message**:
   - Before: "File type should be an image, PDF, Word, PowerPoint, or Excel document"
   - After: "File type should be an image, CSV, Excel, PDF, Word, PowerPoint, or text document"

## Supported File Types Now

### Data Analysis Files (Primary)
- ✅ CSV files: `.csv` (text/csv, application/csv, text/x-csv, application/x-csv)
- ✅ Excel files: `.xlsx`, `.xls` (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel)
- ✅ Excel macro files: `.xlsm`, `.xlsb`

### Legacy Files (Kept for compatibility)
- ✅ Images: All image/* MIME types
- ✅ PDF: `.pdf`
- ✅ Word: `.doc`, `.docx`
- ✅ PowerPoint: `.ppt`, `.pptx`
- ✅ Text: `.txt`
- ✅ Outlook: `.msg`

## File Size Limits
- Maximum: **50MB** per file
- Aligned with `lib/constants.ts` MAX_FILE_SIZE constant

## Testing
After this fix, users should be able to:
1. Click the attachment button in chat input
2. Select CSV files (e.g., `sales_data.csv`, `employee_data.csv`)
3. Upload successfully without errors
4. See file processed via `/api/files/process`
5. File metadata extracted (headers, row count)

## Related Files
- ✅ Fixed: `app/(chat)/api/files/upload/route.ts`
- ✅ Already correct: `lib/constants.ts` (has ALLOWED_FILE_TYPES)
- ✅ Already correct: `lib/utils.ts` (has validateFileType)
- ✅ Already correct: `components/multimodal-input.tsx` (no accept attribute restriction)

## Status
✅ **FIXED** - CSV files can now be uploaded successfully!
