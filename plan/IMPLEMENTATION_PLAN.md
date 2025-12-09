# Data Analysis Chatbot with Jupyter Notebook Execution - Implementation Plan

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [System Prompts](#system-prompts)
4. [Implementation Phases](#implementation-phases)
5. [File Structure](#file-structure)
6. [Technical Specifications](#technical-specifications)
7. [Testing Strategy](#testing-strategy)
8. [Critical Gaps Addressed](#critical-gaps-addressed)
9. [Security & Performance](#security--performance)
10. [Deployment Checklist](#deployment-checklist)

---

## Overview

### Current State
- AI Chatbot with Claude (Anthropic API)
- File upload to Vercel Blob storage
- Code execution using Pyodide (client-side, limited)
- Artifact system for code/text/sheet/image

### Target State
- **Data analysis chatbot** that:
  - Accepts CSV and Excel/XLSX files only
  - Extracts headers and basic metadata for LLM context (lightweight)
  - Generates accurate Python code via Claude
  - Executes code with full dataset in server-side Jupyter environment (E2B)
  - Returns rich outputs (text, tables, plots, errors)
  - Supports iterative analysis (multi-turn conversations)

### Key Principle
> **"Headers for Claude, Full Data for Execution"**
> 
> Only send file headers/metadata to Claude to minimize tokens and focus LLM on code generation. Execute with complete dataset in secure sandbox.

---

## Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: FILE UPLOAD & METADATA EXTRACTION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User uploads file (CSV/Excel/XLSX)                                 │
│           ↓                                                          │
│  POST /api/files/upload                                             │
│    • Upload to Vercel Blob Storage                                  │
│    • Generate unique file ID                                        │
│    • Return blob URL                                                │
│           ↓                                                          │
│  POST /api/files/process                                            │
│    • Download file from blob                                        │
│    • Parse file based on type:                                      │
│      - CSV: Extract column headers only                             │
│      - Excel: Extract sheet names + column headers per sheet        │
│    • Extract basic metadata:                                        │
│      - File name                                                    │
│      - File size                                                    │
│      - Total row count                                              │
│      - Column names (headers)                                       │
│      - Sheet names (for Excel only)                                 │
│    • Store metadata in database                                     │
│    • Return structured metadata to frontend                         │
│                                                                      │
│  Result: Lightweight file metadata stored and ready for Claude      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: CODE GENERATION WITH CLAUDE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User sends prompt + attached file                                  │
│           ↓                                                          │
│  POST /api/chat                                                     │
│    • Fetch file metadata from database                              │
│    • Construct system prompt:                                       │
│      - Base data science agent instructions                         │
│      - File-specific context (columns, types, preview)              │
│      - Available libraries and capabilities                         │
│      - Code generation best practices                               │
│      - Error handling guidelines                                    │
│    • Send to Claude with createNotebook tool                        │
│           ↓                                                          │
│  Claude generates Python code                                       │
│    • Analyzes user request + file metadata                          │
│    • Writes complete, executable Python code                        │
│    • Includes proper imports, data loading, analysis                │
│    • Adds visualizations if appropriate                             │
│    • Streams code back to frontend                                  │
│           ↓                                                          │
│  Frontend receives code stream                                      │
│    • Display in notebook artifact                                   │
│    • Show code cell by cell                                         │
│    • Enable "Execute" action                                        │
│                                                                      │
│  Result: Python code ready for execution                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: JUPYTER EXECUTION IN E2B SANDBOX                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User clicks "Execute" on notebook artifact                         │
│           ↓                                                          │
│  POST /api/jupyter/execute                                          │
│    • Validate user session                                          │
│    • Get or create E2B sandbox for user                             │
│    • Session management:                                            │
│      - One sandbox per user session                                 │
│      - Persistent for 30 minutes                                    │
│      - Stores variables between executions                          │
│           ↓                                                          │
│  Upload file to sandbox                                             │
│    • Download from Vercel Blob                                      │
│    • Upload to E2B at /data/{filename}                              │
│    • Verify file integrity                                          │
│           ↓                                                          │
│  Execute Python code in Jupyter kernel                              │
│    • Run code cell by cell (or all at once)                         │
│    • Capture outputs in real-time:                                  │
│      - stdout/stderr                                                │
│      - Return values                                                │
│      - Matplotlib/Seaborn plots (PNG/SVG)                           │
│      - DataFrames (HTML tables)                                     │
│      - Errors with full traceback                                   │
│    • Stream results back to frontend                                │
│           ↓                                                          │
│  Frontend displays results                                          │
│    • Text output in console                                         │
│    • Tables rendered as HTML                                        │
│    • Plots displayed as images                                      │
│    • Errors highlighted with suggestions                            │
│                                                                      │
│  Result: Analysis complete with rich outputs                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: ITERATIVE ANALYSIS (Multi-turn)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User sees results and asks follow-up question                      │
│           ↓                                                          │
│  System includes in context:                                        │
│    • Previous code                                                  │
│    • Previous execution results                                     │
│    • File metadata                                                  │
│    • Current variables in Jupyter session                           │
│           ↓                                                          │
│  Claude generates new code                                          │
│    • Builds on previous analysis                                    │
│    • Can reference existing variables (df, fig, etc.)               │
│    • Adds new analysis based on user request                        │
│           ↓                                                          │
│  Execute in same sandbox session                                    │
│    • Variables from previous execution available                    │
│    • No need to reload data                                         │
│    • Faster execution                                               │
│           ↓                                                          │
│  Repeat until user satisfied                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## System Prompts

### 1. Base Data Science Agent Prompt

```typescript
export const dataAnalysisSystemPrompt = `
# Data Science Agent with Jupyter Notebook

You are an expert data scientist and Python programmer with access to a persistent Jupyter notebook environment. Your role is to help users analyze data by writing clear, correct, and efficient Python code.

## Core Principles

1. **ACCURACY FIRST**: Write correct, executable code. Every line must work.
2. **COMPLETE SOLUTIONS**: Provide full, self-contained code. Don't use placeholders.
3. **VERIFY ASSUMPTIONS**: Never guess data structure. Use the provided file metadata.
4. **CLEAR OUTPUTS**: Always print or display results clearly.
5. **ROBUST ERROR HANDLING**: Include try-except blocks for file operations and data processing.

## Your Capabilities

### Available Libraries (Pre-installed)
- **Data Manipulation**: pandas, numpy
- **Visualization**: matplotlib, seaborn, plotly
- **Statistical Analysis**: scipy, statsmodels
- **Machine Learning**: scikit-learn
- **File Handling**: openpyxl, xlrd (Excel)
- **Others**: datetime, re, json, csv

### Jupyter Environment Details
- Python 3.10+
- Persistent session (variables remain between executions)
- Files uploaded to \`/data/\` directory
- Outputs captured automatically (prints, plots, dataframes)
- Execution timeout: 60 seconds

## Code Generation Rules

### CRITICAL: Data Loading

**ALWAYS** use the correct file path and loading method:

\`\`\`python
# For CSV files
df = pd.read_csv('/data/{filename}')

# For Excel files  
df = pd.read_excel('/data/{filename}', sheet_name='Sheet1')  # or sheet_name=0

# For multiple sheets
dfs = pd.read_excel('/data/{filename}', sheet_name=None)  # Returns dict of DataFrames

# NEVER use relative paths like './file.csv' or 'file.csv'
# NEVER use hardcoded paths like 'C:/Users/...'
\`\`\`

### Code Structure Best Practices

1. **Start with imports**
   \`\`\`python
   import pandas as pd
   import numpy as np
   import matplotlib.pyplot as plt
   import seaborn as sns
   \`\`\`

2. **Load data with error handling**
   \`\`\`python
   try:
       df = pd.read_csv('/data/{filename}')
       print(f"✓ Data loaded successfully: {df.shape[0]} rows, {df.shape[1]} columns")
   except Exception as e:
       print(f"✗ Error loading data: {e}")
       raise
   \`\`\`

3. **Explore data before analysis**
   \`\`\`python
   # Quick overview
   print("\\nDataset Overview:")
   print(df.info())
   print("\\nFirst few rows:")
   print(df.head())
   print("\\nBasic statistics:")
   print(df.describe())
   \`\`\`

4. **Perform requested analysis**
   - Use descriptive variable names
   - Add comments explaining logic
   - Print intermediate results
   - Handle missing values appropriately

5. **Create visualizations when helpful**
   \`\`\`python
   plt.figure(figsize=(10, 6))
   # ... plotting code ...
   plt.title('Clear Descriptive Title')
   plt.xlabel('X Label')
   plt.ylabel('Y Label')
   plt.tight_layout()
   plt.show()  # This captures the plot
   \`\`\`

6. **Summarize findings**
   \`\`\`python
   print("\\n" + "="*50)
   print("SUMMARY")
   print("="*50)
   print("Key findings from the analysis...")
   \`\`\`

### Error Handling

**ALWAYS** wrap risky operations:

\`\`\`python
# File operations
try:
    df = pd.read_csv('/data/file.csv')
except FileNotFoundError:
    print("Error: File not found. Check the filename.")
except pd.errors.EmptyDataError:
    print("Error: File is empty.")
except Exception as e:
    print(f"Error reading file: {e}")

# Column access
if 'column_name' in df.columns:
    result = df['column_name'].mean()
else:
    print("Error: Column 'column_name' not found.")
    print(f"Available columns: {list(df.columns)}")

# Data type operations
try:
    df['date_column'] = pd.to_datetime(df['date_column'])
except Exception as e:
    print(f"Could not convert to datetime: {e}")
\`\`\`

## Response Format

When generating code, follow this structure:

1. **Brief explanation** (1-2 sentences about what the code will do)
2. **Complete Python code** (properly formatted, executable)
3. **Expected output description** (what the user should see)

### Example Response

"I'll analyze the sales data to find monthly trends and visualize the results.

\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

# Load data
df = pd.read_csv('/data/sales.csv')

# Convert date column
df['date'] = pd.to_datetime(df['date'])

# Extract month
df['month'] = df['date'].dt.to_period('M')

# Calculate monthly sales
monthly_sales = df.groupby('month')['amount'].sum().reset_index()

# Create visualization
plt.figure(figsize=(12, 6))
plt.plot(monthly_sales['month'].astype(str), monthly_sales['amount'], marker='o')
plt.title('Monthly Sales Trend')
plt.xlabel('Month')
plt.ylabel('Total Sales ($)')
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

# Print summary
print(f"Total sales: ${monthly_sales['amount'].sum():,.2f}")
print(f"Average monthly sales: ${monthly_sales['amount'].mean():,.2f}")
print(f"Best month: {monthly_sales.loc[monthly_sales['amount'].idxmax(), 'month']}")
\`\`\`

This will show a line chart of sales trends and print key statistics."

## Multi-turn Analysis

In follow-up requests:
- **Reference existing variables**: You can use \`df\`, \`fig\`, or any variables from previous executions
- **Build incrementally**: Don't reload data unless necessary
- **Maintain context**: Remember what analysis was already performed

Example:
\`\`\`python
# Previous execution created 'df' and 'monthly_sales'
# Now we can directly use them:

# Filter for top performing months
top_months = monthly_sales.nlargest(3, 'amount')
print("Top 3 months:")
print(top_months)
\`\`\`

## Handling Different File Types

### CSV Files
\`\`\`python
# Basic
df = pd.read_csv('/data/file.csv')

# With options
df = pd.read_csv('/data/file.csv', 
                 encoding='utf-8',  # or 'latin-1' if needed
                 sep=',',           # or '\\t' for TSV
                 thousands=',',     # for formatted numbers
                 parse_dates=['date_column'])
\`\`\`

### Excel Files
\`\`\`python
# Single sheet
df = pd.read_excel('/data/file.xlsx', sheet_name='Sales')

# All sheets
all_sheets = pd.read_excel('/data/file.xlsx', sheet_name=None)
for sheet_name, sheet_df in all_sheets.items():
    print(f"Sheet: {sheet_name}, Rows: {len(sheet_df)}")

# Multiple specific sheets
dfs = pd.read_excel('/data/file.xlsx', sheet_name=['Sheet1', 'Sheet2'])
\`\`\`

### Large Files
\`\`\`python
# Read in chunks for memory efficiency
chunk_size = 10000
chunks = []
for chunk in pd.read_csv('/data/large_file.csv', chunksize=chunk_size):
    # Process chunk
    processed = chunk[chunk['value'] > 100]
    chunks.append(processed)

df = pd.concat(chunks, ignore_index=True)
\`\`\`

## Visualization Best Practices

1. **Always set figure size**: \`plt.figure(figsize=(10, 6))\`
2. **Use clear titles and labels**
3. **Choose appropriate plot types**:
   - Line plot: Trends over time
   - Bar chart: Comparisons between categories
   - Scatter plot: Relationships between variables
   - Histogram: Distribution of values
   - Box plot: Statistical distribution
   - Heatmap: Correlation matrices
4. **Use color wisely**: Use seaborn color palettes
5. **Always call \`plt.show()\`** to capture the plot

## Common Mistakes to AVOID

❌ **DON'T**:
- Use \`input()\` or any interactive functions
- Use relative file paths
- Use placeholders like \`# your code here\`
- Import unavailable libraries
- Create infinite loops
- Use \`time.sleep()\` for long durations
- Assume data structure without checking
- Forget error handling
- Use hardcoded indices without bounds checking

✅ **DO**:
- Use absolute paths: \`/data/filename.ext\`
- Validate column existence before access
- Print informative messages
- Handle missing values explicitly
- Use vectorized pandas operations
- Include descriptive comments
- Print clear, formatted outputs
- Create self-contained code

## Remember

Your code will be executed in a real Jupyter environment with the actual data file. 
**Every line must be correct and executable.**
The user is relying on you to produce accurate analysis.
When in doubt, be explicit and verbose rather than assuming.

Now, write Python code to help the user with their data analysis task.
`;
```

### 2. File-Specific Context Prompt

```typescript
export const fileContextPrompt = (metadata: FileMetadata) => {
  const { fileName, fileType, fileSize, headers, rowCount, sheetNames } = metadata;
  
  // Build column list
  const columnsList = headers.map(col => `  - ${col}`).join('\n');
  
  // Sheet information for Excel files
  const sheetInfo = fileType === 'excel' && sheetNames && sheetNames.length > 0
    ? `\n### Available Sheets\n${sheetNames.map(sheet => `  - ${sheet}`).join('\n')}\n`
    : '';

  return `
## File Information

**Filename**: \`${fileName}\`
**Type**: ${fileType.toUpperCase()}
**Size**: ${(fileSize / 1024).toFixed(2)} KB
**Total Rows**: ${rowCount.toLocaleString()}
**Total Columns**: ${headers.length}
${sheetInfo}
### Column Headers
${columnsList}

---

**CRITICAL INSTRUCTIONS**: 
- File is located at: \`/data/${fileName}\`
- Use this EXACT path when loading data
- For CSV: \`df = pd.read_csv('/data/${fileName}')\`
- For Excel: \`df = pd.read_excel('/data/${fileName}'${sheetNames && sheetNames.length > 0 ? `, sheet_name='${sheetNames[0]}'` : ''})\`
- All column names listed above are confirmed to exist in the file
- Use these EXACT column names (case-sensitive) when accessing data
- Always verify column existence before performing operations
`;
};
```

### 3. Update Document Prompt (for iterations)

```typescript
export const updateNotebookPrompt = (
  currentCode: string,
  executionResult: ExecutionResult,
  userRequest: string
) => `
## Current Notebook State

### Previous Code
\`\`\`python
${currentCode}
\`\`\`

### Execution Results
${executionResult.success ? '✓ Executed successfully' : '✗ Execution failed'}

**Output**:
\`\`\`
${executionResult.stdout || '(no output)'}
\`\`\`

${executionResult.stderr ? `
**Errors**:
\`\`\`
${executionResult.stderr}
\`\`\`
` : ''}

${executionResult.variables ? `
**Available Variables**:
${Object.keys(executionResult.variables).join(', ')}
` : ''}

---

## User's New Request
${userRequest}

---

## Instructions

Based on the user's request and the current state:

1. **If there was an error**: 
   - Analyze the error message carefully
   - Identify the root cause
   - Fix the code and re-run the complete analysis

2. **If execution was successful**:
   - Build on the existing analysis
   - You can reference variables from previous execution (e.g., \`df\`, \`monthly_sales\`)
   - Add new analysis as requested
   - Don't reload data unless necessary

3. **Code Generation**:
   - Generate COMPLETE, EXECUTABLE code
   - Include all necessary imports (even if used before)
   - Test assumptions before using them
   - Handle edge cases

Write the updated Python code now.
`;
```

### 4. Error Recovery Prompt

```typescript
export const errorRecoveryPrompt = (error: ExecutionError) => `
## Execution Error Detected

**Error Type**: ${error.name}
**Error Message**: ${error.value}

**Traceback**:
\`\`\`
${error.traceback}
\`\`\`

---

## Your Task

Analyze this error and provide a FIXED version of the code.

### Common Issues and Fixes:

1. **FileNotFoundError**: Wrong file path
   - Fix: Use \`/data/filename.ext\`

2. **KeyError**: Column doesn't exist
   - Fix: Check \`df.columns\` and use correct name

3. **ValueError**: Wrong data type
   - Fix: Convert data type explicitly (e.g., \`pd.to_datetime()\`)

4. **AttributeError**: Method doesn't exist
   - Fix: Check pandas/numpy documentation for correct method

5. **IndexError**: Index out of range
   - Fix: Check data length before accessing

### Debugging Steps:
1. Identify the line that failed
2. Understand why it failed
3. Provide corrected code with explanation
4. Add validation to prevent similar errors

Generate the corrected Python code now, with comments explaining the fixes.
`;
```

---

## Implementation Phases

### Phase 1: File Processing & Metadata Extraction

#### 1.0 File Type Validation & Upload Integration
**File**: `lib/constants.ts`

```typescript
// Add file validation constants
export const ALLOWED_FILE_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
} as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILES_PER_CHAT = 5;
```

**File**: `lib/utils.ts`

```typescript
// Add file validation utility
export function validateFileType(file: File): { valid: boolean; error?: string } {
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  const mimeType = file.type;
  
  if (!extension) {
    return { valid: false, error: 'File has no extension' };
  }
  
  const allowedExtensions = Object.values(ALLOWED_FILE_TYPES).flat();
  if (!allowedExtensions.includes(extension)) {
    return { 
      valid: false, 
      error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}` 
    };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
    };
  }
  
  return { valid: true };
}
```

**File**: `app/(chat)/api/files/upload/route.ts` (MODIFIED)

```typescript
// Add processing trigger after upload
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chatId = formData.get('chatId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const validation = validateFileType(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Upload to Vercel Blob
    const blob = await put(objectName, fileBuffer, {
      access: 'public',
      contentType: file.type,
    });

    // Trigger async processing
    const processingResult = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/files/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blobUrl: blob.url,
        fileName: file.name,
        fileSize: file.size,
        fileType: extension === '.csv' ? 'csv' : 'excel',
        chatId,
        userId: session.user.id,
      }),
    });

    if (!processingResult.ok) {
      // Delete blob if processing fails
      await del(blob.url);
      return NextResponse.json({ error: 'File processing failed' }, { status: 500 });
    }

    const metadata = await processingResult.json();

    return NextResponse.json({
      ...blob,
      metadata, // Include extracted metadata
      contentType: file.type,
      originalFilename: file.name,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

#### 1.1 Install Dependencies
```bash
npm install xlsx papaparse encoding-japanese iconv-lite
npm install -D @types/papaparse
```

#### 1.2 Database Schema
**File**: `lib/db/schema.ts`

```typescript
export const fileMetadata = pgTable('file_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chat.id).notNull(),
  userId: uuid('user_id').notNull(),
  blobUrl: text('blob_url').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // 'csv' | 'excel'
  fileSize: integer('file_size').notNull(), // in bytes
  
  // Extracted metadata (lightweight - headers only)
  headers: json('headers').$type<string[]>().notNull(),
  rowCount: integer('row_count').notNull(),
  sheetNames: json('sheet_names').$type<string[]>(), // For Excel files only
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
  
  // Status
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'ready' | 'error'
  errorMessage: text('error_message'),
});

// Types
type FileMetadata = {
  id: string;
  fileName: string;
  fileType: 'csv' | 'excel';
  fileSize: number; // in bytes
  blobUrl: string;
  headers: string[]; // Column names only
  rowCount: number;
  sheetNames?: string[]; // For Excel files
};
```

#### 1.3 File Processing API
**File**: `app/(chat)/api/files/process/route.ts`

**Purpose**: Extract lightweight metadata from uploaded files (headers only)

**Features**:
- Download file from Vercel Blob
- Parse based on file type (CSV or Excel)
- Extract ONLY:
  - Column headers (names only)
  - Total row count
  - File size
  - Sheet names (for Excel)
- Store metadata in database
- Return structured response

**What NOT to Extract** (to keep it lightweight):
- ❌ Data types (dtype inference)
- ❌ Preview rows
- ❌ Statistical summaries (min/max/mean)
- ❌ Non-null counts
- ❌ Sample values
- ❌ Unique counts

**Parsers Needed**:
```typescript
// lib/jupyter/parsers/csv-parser.ts
export async function parseCSV(fileBuffer: Buffer): Promise<{
  headers: string[];
  rowCount: number;
}>

// lib/jupyter/parsers/excel-parser.ts
export async function parseExcel(fileBuffer: Buffer): Promise<{
  headers: string[];
  rowCount: number;
  sheetNames: string[];
}>
```

#### 1.4 Database Queries
**File**: `lib/db/queries.ts`

```typescript
export async function saveFileMetadata(metadata: FileMetadata)
export async function getFileMetadataByChatId(chatId: string)
export async function getFileMetadataById(id: string)
export async function updateFileMetadataStatus(id: string, status: string)
```

---

### Phase 2: Notebook Artifact 

#### 2.1 Create Notebook Artifact Definition
**File**: `artifacts/notebook/client.tsx`

**Key Differences from Code Artifact**:
- Multiple cells support (code cells + markdown cells)
- Cell-by-cell execution
- Output display per cell
- Jupyter-like interface
- Variables panel showing current session state
- Can run all cells or individual cells

**Metadata Structure**:
```typescript
type NotebookMetadata = {
  cells: NotebookCell[];
  sessionId: string; // E2B sandbox session
  fileMetadata: FileMetadata;
  executionCount: number;
  variables: Record<string, any>; // Current variables in Jupyter session
};

type NotebookCell = {
  id: string;
  type: 'code' | 'markdown';
  content: string;
  outputs: CellOutput[];
  executionCount?: number;
  status: 'idle' | 'running' | 'completed' | 'error';
};

type CellOutput = {
  type: 'stream' | 'execute_result' | 'display_data' | 'error';
  content: string | ImageData | TableData;
  timestamp: number;
};
```

#### 2.2 Notebook Actions
```typescript
// Execute single cell
{
  icon: <PlayIcon />,
  label: "Run Cell",
  onClick: ({ cellId, content, metadata, setMetadata }) => {
    // Execute single cell in E2B
  }
}

// Execute all cells
{
  icon: <PlayAllIcon />,
  label: "Run All",
  onClick: ({ metadata, setMetadata }) => {
    // Execute all cells sequentially
  }
}

// Clear outputs
{
  icon: <ClearIcon />,
  label: "Clear Outputs",
  onClick: ({ metadata, setMetadata }) => {
    // Clear all cell outputs
  }
}

// Restart kernel
{
  icon: <RestartIcon />,
  label: "Restart Kernel",
  onClick: ({ metadata, setMetadata }) => {
    // Close E2B sandbox and create new one
  }
}

// Download notebook
{
  icon: <DownloadIcon />,
  label: "Download .ipynb",
  onClick: ({ metadata }) => {
    // Convert to Jupyter notebook format and download
  }
}
```

#### 2.3 Notebook Server Handler
**File**: `artifacts/notebook/server.ts`

```typescript
export const notebookDocumentHandler = createDocumentHandler<"notebook">({
  kind: "notebook",
  
  onCreateDocument: async ({ title, dataStream, session }) => {
    // 1. Generate code using enhanced data analysis prompt
    // 2. Create notebook structure with cells
    // 3. Stream notebook to frontend
    // 4. Return notebook content
  },
  
  onUpdateDocument: async ({ document, description, dataStream }) => {
    // 1. Analyze current notebook state
    // 2. Get execution results from previous run
    // 3. Generate updated code
    // 4. Stream updated notebook
  },
});
```

#### 2.4 Update Artifact Definitions
**File**: `components/artifact.tsx`

```typescript
import { notebookArtifact } from '@/artifacts/notebook/client';

export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  notebookArtifact, // NEW
  imageArtifact,
  sheetArtifact,
];

export type ArtifactKind = 'text' | 'code' | 'notebook' | 'image' | 'sheet';
```

---

### Phase 3: E2B Integration

#### 3.1 Install E2B SDK
```bash
npm install @e2b/code-interpreter
```

#### 3.2 E2B Client Manager
**File**: `lib/jupyter/e2b-client.ts`

```typescript
import { Sandbox } from '@e2b/code-interpreter';

export class E2BSessionManager {
  private static sessions: Map<string, Sandbox> = new Map();
  private static sessionTimeout = 30 * 60 * 1000; // 30 minutes
  
  /**
   * Get or create E2B sandbox for user session
   */
  static async getOrCreateSandbox(userId: string): Promise<Sandbox> {
    // Check if session exists
    if (this.sessions.has(userId)) {
      const sandbox = this.sessions.get(userId)!;
      // Verify sandbox is still alive
      try {
        await sandbox.ping();
        return sandbox;
      } catch (error) {
        // Sandbox died, remove from map
        this.sessions.delete(userId);
      }
    }
    
    // Create new sandbox
    const sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY!,
      timeoutMs: 60000,
    });
    
    this.sessions.set(userId, sandbox);
    
    // Set cleanup timeout
    setTimeout(() => {
      this.closeSandbox(userId);
    }, this.sessionTimeout);
    
    return sandbox;
  }
  
  /**
   * Close sandbox and cleanup
   */
  static async closeSandbox(userId: string): Promise<void> {
    const sandbox = this.sessions.get(userId);
    if (sandbox) {
      try {
        await sandbox.close();
      } catch (error) {
        console.error('Error closing sandbox:', error);
      }
      this.sessions.delete(userId);
    }
  }
  
  /**
   * Upload file to sandbox
   */
  static async uploadFile(
    sandbox: Sandbox,
    blobUrl: string,
    fileName: string
  ): Promise<void> {
    // Download from Vercel Blob
    const response = await fetch(blobUrl);
    const buffer = await response.arrayBuffer();
    
    // Upload to E2B at /data/
    await sandbox.files.write(`/data/${fileName}`, Buffer.from(buffer));
  }
  
  /**
   * Execute Python code
   */
  static async executeCode(
    sandbox: Sandbox,
    code: string
  ): Promise<ExecutionResult> {
    const execution = await sandbox.runCode(code);
    
    return {
      success: !execution.error,
      stdout: execution.logs.stdout.join('\n'),
      stderr: execution.logs.stderr.join('\n'),
      results: execution.results,
      error: execution.error ? {
        name: execution.error.name,
        value: execution.error.value,
        traceback: execution.error.traceback,
      } : null,
      executionCount: execution.execution_count,
    };
  }
  
  /**
   * Get current variables in Jupyter session
   */
  static async getVariables(sandbox: Sandbox): Promise<Record<string, any>> {
    const code = `
import json
import pandas as pd

variables = {}
for name, obj in globals().items():
    if not name.startswith('_'):
        if isinstance(obj, pd.DataFrame):
            variables[name] = {
                'type': 'DataFrame',
                'shape': obj.shape,
                'columns': list(obj.columns)
            }
        elif isinstance(obj, (int, float, str, bool)):
            variables[name] = {'type': type(obj).__name__, 'value': obj}
        else:
            variables[name] = {'type': type(obj).__name__}

print(json.dumps(variables))
`;
    
    const result = await this.executeCode(sandbox, code);
    try {
      return JSON.parse(result.stdout);
    } catch {
      return {};
    }
  }
}

// Types
export type ExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  results: any[]; // Plots, tables, etc.
  error: ExecutionError | null;
  executionCount?: number;
};

export type ExecutionError = {
  name: string;
  value: string;
  traceback: string;
};
```

#### 3.3 Execution API Route
**File**: `app/(chat)/api/jupyter/execute/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { E2BSessionManager } from '@/lib/jupyter/e2b-client';
import { getFileMetadataById } from '@/lib/db/queries';

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
    
    // 4. Upload file if not already uploaded
    const fileMetadata = await getFileMetadataById(fileMetadataId);
    await E2BSessionManager.uploadFile(
      sandbox,
      fileMetadata.blobUrl,
      fileMetadata.fileName
    );
    
    // 5. Execute code
    const result = await E2BSessionManager.executeCode(sandbox, code);
    
    // 6. Get current variables
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

#### 3.4 Session Management API
**File**: `app/(chat)/api/jupyter/session/route.ts`

```typescript
// GET: Check session status
export async function GET(request: Request)

// POST: Create new session  
export async function POST(request: Request)

// DELETE: Close session
export async function DELETE(request: Request)
```

---

### Phase 4: Chat Integration 

#### 4.1 Create Notebook Tool
**File**: `lib/ai/tools/create-notebook.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const createNotebook = (fileMetadata: FileMetadata | null) => {
  return tool({
    description: 'Create a Jupyter notebook for data analysis with Python code',
    parameters: z.object({
      title: z.string().describe('Title of the notebook'),
      code: z.string().describe('Complete Python code for data analysis'),
      explanation: z.string().describe('Brief explanation of what the code does'),
    }),
    execute: async ({ title, code, explanation }) => {
      // This is called by Claude
      // We stream the notebook to frontend
      return {
        title,
        code,
        explanation,
        fileInfo: fileMetadata,
      };
    },
  });
};
```

#### 4.2 Update Chat Route
**File**: `app/(chat)/api/chat/route.ts`

```typescript
// Inside POST handler:

// Check for file attachments
const fileMetadata = message.experimental_attachments 
  ? await getFileMetadataByChatId(id)
  : null;

// Build system prompt
const systemPromptContent = fileMetadata 
  ? `${dataAnalysisSystemPrompt}\n\n${fileContextPrompt(fileMetadata)}`
  : regularPrompt;

// Add createNotebook tool
const tools = {
  getWeather,
  createDocument: createDocument(session),
  updateDocument: updateDocument(session),
  requestSuggestions: requestSuggestions(session),
  createNotebook: createNotebook(fileMetadata), // NEW
};

// Stream to frontend with tool calls
const result = streamText({
  model: myProvider.languageModel(selectedChatModel),
  system: systemPromptContent,
  messages: convertToModelMessages(coreMessages),
  tools,
  maxSteps: 5,
  experimental_transform: smoothStream(),
  onFinish: async ({ response }) => {
    // Save chat and messages
  },
});
```

#### 4.3 Handle Notebook Streaming
**File**: `artifacts/notebook/server.ts`

```typescript
onCreateDocument: async ({ title, dataStream, session }) => {
  // Title contains the user's request + file metadata
  const { fullStream } = streamText({
    model: myProvider.languageModel("artifact-model"),
    system: dataAnalysisSystemPrompt,
    prompt: title,
  });
  
  let generatedCode = '';
  
  for await (const delta of fullStream) {
    if (delta.type === 'text-delta') {
      generatedCode += delta.text;
      
      // Stream to frontend
      dataStream.write({
        type: 'data-notebookDelta',
        data: {
          code: generatedCode,
          status: 'generating',
        },
        transient: true,
      });
    }
  }
  
  // Create notebook structure
  const notebook = {
    cells: [
      {
        id: generateUUID(),
        type: 'code',
        content: generatedCode,
        outputs: [],
        status: 'idle',
      }
    ],
    sessionId: null,
    executionCount: 0,
  };
  
  return JSON.stringify(notebook);
}
```

---

### Phase 5: UI/UX Enhancements 

#### 5.1 File Preview Component
**File**: `components/file-preview-detailed.tsx`

```typescript
export function FilePreviewDetailed({ metadata }: { metadata: FileMetadata }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{metadata.fileName}</h3>
          <p className="text-sm text-muted-foreground">
            {metadata.rowCount.toLocaleString()} rows × {metadata.headers.length} columns
          </p>
          <p className="text-xs text-muted-foreground">
            {(metadata.fileSize / 1024).toFixed(2)} KB
          </p>
        </div>
        <Badge>{metadata.fileType.toUpperCase()}</Badge>
      </div>
      
      {/* Sheet Names (Excel only) */}
      {metadata.sheetNames && metadata.sheetNames.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium">Sheets</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {metadata.sheetNames.map(sheet => (
              <Badge key={sheet} variant="outline">{sheet}</Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Column Headers */}
      <div className="mt-4">
        <h4 className="text-sm font-medium">Column Headers ({metadata.headers.length})</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {metadata.headers.map(header => (
            <Badge key={header} variant="secondary" className="font-mono text-xs">
              {header}
            </Badge>
          ))}
        </div>
      </div>
      
      {/* Info Message */}
      <div className="mt-4 rounded bg-muted p-3">
        <p className="text-xs text-muted-foreground">
          💡 The full dataset will be available during code execution in the Jupyter environment.
        </p>
      </div>
    </div>
  );
}
```

#### 5.2 Notebook Cell Component
**File**: `components/notebook-cell.tsx`

```typescript
export function NotebookCell({ 
  cell, 
  onExecute, 
  onUpdate 
}: NotebookCellProps) {
  return (
    <div className="notebook-cell">
      {/* Cell toolbar */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onExecute(cell.id)}>
          <PlayIcon />
        </Button>
        <span className="text-sm text-muted-foreground">
          [{cell.executionCount || ' '}]
        </span>
      </div>
      
      {/* Cell content */}
      {cell.type === 'code' ? (
        <CodeEditor 
          value={cell.content}
          onChange={(value) => onUpdate(cell.id, value)}
        />
      ) : (
        <MarkdownEditor
          value={cell.content}
          onChange={(value) => onUpdate(cell.id, value)}
        />
      )}
      
      {/* Cell outputs */}
      {cell.outputs.length > 0 && (
        <div className="cell-outputs">
          {cell.outputs.map((output, idx) => (
            <CellOutput key={idx} output={output} />
          ))}
        </div>
      )}
      
      {/* Loading state */}
      {cell.status === 'running' && (
        <div className="flex items-center gap-2 p-2">
          <Loader />
          <span>Executing...</span>
        </div>
      )}
    </div>
  );
}
```

#### 5.3 Variables Panel
**File**: `components/variables-panel.tsx`

```typescript
export function VariablesPanel({ variables }: { variables: Record<string, any> }) {
  return (
    <div className="variables-panel">
      <h3 className="text-sm font-medium mb-2">Variables</h3>
      {Object.entries(variables).map(([name, info]) => (
        <div key={name} className="flex items-center justify-between p-2 rounded hover:bg-muted">
          <span className="font-mono text-sm">{name}</span>
          <Badge variant="outline">{info.type}</Badge>
        </div>
      ))}
    </div>
  );
}
```

#### 5.4 Execution Status
**File**: `components/execution-status.tsx`

```typescript
export function ExecutionStatus({ status, duration }: ExecutionStatusProps) {
  return (
    <div className="execution-status">
      {status === 'running' && (
        <>
          <Loader />
          <span>Executing... ({duration}s)</span>
        </>
      )}
      {status === 'completed' && (
        <>
          <CheckIcon className="text-green-500" />
          <span>Completed in {duration}s</span>
        </>
      )}
      {status === 'error' && (
        <>
          <XIcon className="text-red-500" />
          <span>Execution failed</span>
        </>
      )}
    </div>
  );
}
```

---

### Phase 6: Error Handling & Recovery 

#### 6.1 Error Detection
**File**: `lib/jupyter/error-handler.ts`

```typescript
export class ExecutionErrorHandler {
  static analyzeError(error: ExecutionError): ErrorAnalysis {
    const { name, value, traceback } = error;
    
    // Detect common error types
    if (name === 'FileNotFoundError') {
      return {
        category: 'file_not_found',
        suggestion: 'Check file path. Use: /data/{filename}',
        autoFix: this.generateFilePathFix(traceback),
      };
    }
    
    if (name === 'KeyError') {
      return {
        category: 'column_not_found',
        suggestion: 'Column does not exist. Check column names.',
        autoFix: this.generateColumnNameFix(value, traceback),
      };
    }
    
    if (name === 'ValueError' && value.includes('datetime')) {
      return {
        category: 'datetime_parsing',
        suggestion: 'Date parsing failed. Try specifying format.',
        autoFix: this.generateDateParseFix(traceback),
      };
    }
    
    // Generic error
    return {
      category: 'unknown',
      suggestion: 'Review the error and adjust the code.',
      autoFix: null,
    };
  }
  
  static async suggestFix(
    code: string,
    error: ExecutionError,
    fileMetadata: FileMetadata
  ): Promise<string> {
    // Use Claude to suggest fix
    const fixPrompt = errorRecoveryPrompt(error);
    
    const { text } = await generateText({
      model: myProvider.languageModel("artifact-model"),
      system: `${dataAnalysisSystemPrompt}\n\n${fileContextPrompt(fileMetadata)}`,
      prompt: `${fixPrompt}\n\n**Original Code**:\n\`\`\`python\n${code}\n\`\`\``,
    });
    
    return text;
  }
}
```

#### 6.2 Auto-retry Logic
**File**: `artifacts/notebook/client.tsx`

```typescript
// In execute action
onClick: async ({ content, metadata, setMetadata }) => {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    const result = await executeCode(content, metadata.fileMetadata);
    
    if (result.success) {
      // Success!
      setMetadata({ ...metadata, outputs: result.outputs });
      break;
    } else {
      attempts++;
      
      if (attempts < maxAttempts) {
        // Try to fix automatically
        const suggestedFix = await suggestFix(
          content,
          result.error,
          metadata.fileMetadata
        );
        
        // Ask user if they want to try the fix
        const shouldRetry = await confirmFix(suggestedFix);
        if (shouldRetry) {
          content = suggestedFix;
          continue;
        } else {
          break;
        }
      } else {
        // Max attempts reached
        setMetadata({ 
          ...metadata, 
          outputs: [{ type: 'error', content: result.error }] 
        });
      }
    }
  }
}
```

---

### Phase 7: Testing & Optimization 

#### 7.1 Unit Tests
```typescript
// tests/unit/file-parsers.test.ts
describe('File Parsers', () => {
  test('CSV parser extracts headers correctly', async () => {
    const result = await parseCSV(sampleCSVBuffer);
    expect(result.headers).toEqual(['col1', 'col2', 'col3']);
  });
  
  test('Excel parser handles multiple sheets', async () => {
    const result = await parseExcel(sampleExcelBuffer);
    expect(result.sheets).toHaveLength(2);
  });
});

// tests/unit/e2b-client.test.ts
describe('E2B Client', () => {
  test('Executes Python code successfully', async () => {
    const sandbox = await E2BSessionManager.getOrCreateSandbox('test-user');
    const result = await E2BSessionManager.executeCode(
      sandbox,
      'print("Hello, World!")'
    );
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Hello, World!');
  });
});
```

#### 7.2 Integration Tests
```typescript
// tests/e2e/notebook-execution.test.ts
test('Full notebook execution flow', async () => {
  // 1. Upload file
  const file = createTestCSV();
  const uploadResponse = await uploadFile(file);
  
  // 2. Process file
  const processResponse = await processFile(uploadResponse.url);
  expect(processResponse.status).toBe('ready');
  
  // 3. Generate notebook
  const chatResponse = await sendChatMessage(
    'Analyze this data',
    [processResponse.id]
  );
  expect(chatResponse).toContain('notebook');
  
  // 4. Execute code
  const executeResponse = await executeNotebook(chatResponse.notebookId);
  expect(executeResponse.success).toBe(true);
  expect(executeResponse.outputs).toBeDefined();
});
```

#### 7.3 Performance Optimization
- **File upload**: Use streaming for large files
- **Metadata extraction**: Cache results
- **E2B sessions**: Implement connection pooling
- **Code generation**: Add caching for common patterns
- **Results streaming**: Use Server-Sent Events for real-time updates

---

## File Structure

```
ai-chatbot/
├── app/
│   └── (chat)/
│       ├── api/
│       │   ├── files/
│       │   │   ├── upload/
│       │   │   │   └── route.ts ← MODIFIED (add processing call)
│       │   │   └── process/
│       │   │       └── route.ts ← NEW (extract metadata)
│       │   └── jupyter/
│       │       ├── execute/
│       │       │   └── route.ts ← NEW (execute code in E2B)
│       │       └── session/
│       │           └── route.ts ← NEW (manage E2B sessions)
│       └── actions.ts ← MODIFIED (add notebook actions)
│
├── artifacts/
│   └── notebook/ ← NEW FOLDER
│       ├── client.tsx ← NEW (notebook artifact UI)
│       └── server.ts ← NEW (notebook generation handler)
│
├── components/
│   ├── artifact.tsx ← MODIFIED (add notebook to definitions)
│   ├── notebook-cell.tsx ← NEW (individual cell component)
│   ├── notebook-viewer.tsx ← NEW (full notebook display)
│   ├── file-preview-detailed.tsx ← NEW (detailed file info)
│   ├── variables-panel.tsx ← NEW (show session variables)
│   ├── execution-status.tsx ← NEW (execution progress)
│   └── console.tsx ← MODIFIED (enhanced output display)
│
├── lib/
│   ├── ai/
│   │   ├── prompts.ts ← MODIFIED (add data analysis prompts)
│   │   └── tools/
│   │       ├── create-notebook.ts ← NEW (notebook creation tool)
│   │       └── update-notebook.ts ← NEW (notebook update tool)
│   ├── db/
│   │   ├── schema.ts ← MODIFIED (add file_metadata table)
│   │   └── queries.ts ← MODIFIED (add metadata queries)
│   └── jupyter/ ← NEW FOLDER
│       ├── e2b-client.ts ← NEW (E2B integration)
│       ├── error-handler.ts ← NEW (error analysis & recovery)
│       ├── session-manager.ts ← NEW (session lifecycle)
│       └── parsers/
│           ├── csv-parser.ts ← NEW (headers + row count only)
│           └── excel-parser.ts ← NEW (headers + sheets + row count)
│
├── tests/
│   ├── unit/
│   │   ├── file-parsers.test.ts ← NEW
│   │   └── e2b-client.test.ts ← NEW
│   └── e2e/
│       └── notebook-execution.test.ts ← NEW
│
├── .env.example ← MODIFIED (add E2B_API_KEY)
└── package.json ← MODIFIED (add dependencies)
```

---

## Technical Specifications

### Dependencies

```json
{
  "dependencies": {
    "@e2b/code-interpreter": "^1.0.0",
    "xlsx": "^0.18.5",
    "papaparse": "^5.4.1"
  }
}
```

### Environment Variables

```env
# Existing
AUTH_SECRET=***
POSTGRES_URL=***
BLOB_READ_WRITE_TOKEN=***
ANTHROPIC_API_KEY=*** (or AI_GATEWAY_API_KEY)

# New - E2B Configuration
E2B_API_KEY=*** # Get from e2b.dev
E2B_SANDBOX_TIMEOUT=60000 # 60 seconds
E2B_SESSION_TIMEOUT=1800000 # 30 minutes
MAX_SANDBOXES_PER_USER=1
```

### Database Migration

```sql
-- Add file_metadata table (lightweight - headers only)
CREATE TABLE file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  blob_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'excel')),
  file_size INTEGER NOT NULL,
  headers JSONB NOT NULL,
  row_count INTEGER NOT NULL,
  sheet_names JSONB, -- For Excel files only
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT
);

CREATE INDEX idx_file_metadata_chat_id ON file_metadata(chat_id);
CREATE INDEX idx_file_metadata_user_id ON file_metadata(user_id);
CREATE INDEX idx_file_metadata_status ON file_metadata(status);
```

---

## Testing Strategy

### 1. Unit Testing
- File parsers (CSV, Excel, PDF)
- E2B client methods
- Error handler logic
- Prompt generation functions

### 2. Integration Testing
- File upload → metadata extraction → database storage
- Claude code generation with file context
- E2B execution with real files
- Multi-turn conversation flow

### 3. End-to-End Testing
- Complete user flow: upload → generate → execute → iterate
- Error recovery scenarios
- Session management
- Performance under load

### 4. Test Files
Prepare test datasets:
- **CSV**: Sales data (100 rows, 5 columns)
- **Excel**: Multi-sheet workbook (2-3 sheets)
- **Large CSV**: 10,000+ rows (stress test)
- **Excel with many columns**: 20+ columns to test header extraction

---

## Success Metrics

### Functional
- ✅ File upload success rate: >99%
- ✅ Header extraction accuracy: 100% (exact headers)
- ✅ Code generation quality: >90% executable on first try
- ✅ Execution success rate: >85%
- ✅ Error recovery rate: >70%

### Performance
- ✅ File processing (headers only): <2 seconds for files <10MB
- ✅ Code generation: <10 seconds
- ✅ Code execution: <30 seconds
- ✅ Total end-to-end: <45 seconds

### User Experience
- ✅ Clear error messages with actionable suggestions
- ✅ Real-time progress indicators
- ✅ Intuitive notebook interface
- ✅ Responsive UI during execution

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| E2B API downtime | High | Implement retry logic, fallback to local execution |
| Large file processing | Medium | Add file size limits, streaming processing |
| Claude generates incorrect code | High | **Enhanced system prompts**, validation layer |
| Expensive API costs | Medium | Cache results, rate limiting |
| Security vulnerabilities | High | Sandboxed execution, input validation |
| Session management complexity | Medium | Use Redis for state management |

---

## Next Steps

1. **Review this plan** ✓
2. **Set up E2B account** → Get API key from e2b.dev
3. **Run database migrations** → Add file_metadata table
4. **Install dependencies** → npm install packages
5. **Start with Phase 1** → File processing implementation
6. **Test with sample files** → Validate metadata extraction
7. **Iterate and refine** → Improve based on results

---

## Key Differentiators

### Why This Implementation Will Succeed:

1. **Precise System Prompts**
   - Detailed instructions for Claude
   - File-specific context
   - Error handling guidelines
   - Best practices baked in

2. **Separate Concerns**
   - Headers for LLM (fast, cheap)
   - Full data for execution (powerful, accurate)
   - Clear separation of responsibilities

3. **Robust Error Recovery**
   - Automatic error detection
   - Suggested fixes from Claude
   - Retry logic with user confirmation

4. **Jupyter-like Experience**
   - Cell-by-cell execution
   - Variables panel
   - Rich output display
   - Interactive iteration

5. **Production Ready**
   - Proper session management
   - Security through sandboxing
   - Performance optimizations
   - Comprehensive testing

---

## Contact & Support

For questions or issues during implementation:
1. Check E2B documentation: https://e2b.dev/docs
2. Review AI SDK docs: https://sdk.vercel.ai/docs
3. Test with small datasets first
4. Monitor E2B dashboard for usage

---

**This plan is your complete blueprint. Follow it phase by phase, and you'll have a production-ready data analysis chatbot with Jupyter execution capabilities.**

---

## 8. Critical Gaps Addressed

This section addresses all missing components identified during the detailed analysis.

### 8.1 Type Definitions for Notebook Streaming

**File**: `lib/types.ts`

```typescript
// Add to CustomUIDataTypes
export type CustomUIDataTypes = 
  | 'document'
  | 'code'
  | 'notebook'  // NEW
  | 'sheet'
  | 'image'
  | 'text';

// Notebook-specific types
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

// File metadata types
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

### 8.2 Notebook State Management (Frontend)

**File**: `hooks/use-notebook.ts`

```typescript
'use client';

import { create } from 'zustand';
import { NotebookCell, NotebookMetadata, NotebookDelta } from '@/lib/types';

interface NotebookState {
  notebooks: Record<string, {
    metadata: NotebookMetadata;
    cells: NotebookCell[];
  }>;
  
  // Actions
  initNotebook: (notebookId: string, metadata: NotebookMetadata) => void;
  addCell: (notebookId: string, cell: NotebookCell, index?: number) => void;
  updateCell: (notebookId: string, cellId: string, updates: Partial<NotebookCell>) => void;
  deleteCell: (notebookId: string, cellId: string) => void;
  updateMetadata: (notebookId: string, updates: Partial<NotebookMetadata>) => void;
  clearNotebook: (notebookId: string) => void;
  
  // Streaming handler
  applyDelta: (delta: NotebookDelta) => void;
}

export const useNotebook = create<NotebookState>((set, get) => ({
  notebooks: {},

  initNotebook: (notebookId, metadata) => set((state) => ({
    notebooks: {
      ...state.notebooks,
      [notebookId]: {
        metadata,
        cells: [],
      },
    },
  })),

  addCell: (notebookId, cell, index) => set((state) => {
    const notebook = state.notebooks[notebookId];
    if (!notebook) return state;

    const cells = [...notebook.cells];
    if (index !== undefined) {
      cells.splice(index, 0, cell);
    } else {
      cells.push(cell);
    }

    return {
      notebooks: {
        ...state.notebooks,
        [notebookId]: { ...notebook, cells },
      },
    };
  }),

  updateCell: (notebookId, cellId, updates) => set((state) => {
    const notebook = state.notebooks[notebookId];
    if (!notebook) return state;

    const cells = notebook.cells.map((cell) =>
      cell.id === cellId ? { ...cell, ...updates } : cell
    );

    return {
      notebooks: {
        ...state.notebooks,
        [notebookId]: { ...notebook, cells },
      },
    };
  }),

  deleteCell: (notebookId, cellId) => set((state) => {
    const notebook = state.notebooks[notebookId];
    if (!notebook) return state;

    const cells = notebook.cells.filter((cell) => cell.id !== cellId);

    return {
      notebooks: {
        ...state.notebooks,
        [notebookId]: { ...notebook, cells },
      },
    };
  }),

  updateMetadata: (notebookId, updates) => set((state) => {
    const notebook = state.notebooks[notebookId];
    if (!notebook) return state;

    return {
      notebooks: {
        ...state.notebooks,
        [notebookId]: {
          ...notebook,
          metadata: { ...notebook.metadata, ...updates },
        },
      },
    };
  }),

  clearNotebook: (notebookId) => set((state) => {
    const newNotebooks = { ...state.notebooks };
    delete newNotebooks[notebookId];
    return { notebooks: newNotebooks };
  }),

  applyDelta: (delta) => {
    const { type, notebookId, cell, cellId, metadata } = delta;

    switch (type) {
      case 'init':
        if (notebookId && metadata) {
          get().initNotebook(notebookId, metadata as NotebookMetadata);
        }
        break;
      case 'add-cell':
        if (notebookId && cell) {
          get().addCell(notebookId, cell);
        }
        break;
      case 'update-cell':
        if (notebookId && cellId && cell) {
          get().updateCell(notebookId, cellId, cell);
        }
        break;
      case 'delete-cell':
        if (notebookId && cellId) {
          get().deleteCell(notebookId, cellId);
        }
        break;
      case 'update-metadata':
        if (notebookId && metadata) {
          get().updateMetadata(notebookId, metadata);
        }
        break;
    }
  },
}));
```

### 8.3 Data Stream Handler Integration

**File**: `components/data-stream-handler.tsx` (MODIFIED)

```typescript
// Add to existing handlers
useEffect(() => {
  const handleNotebookDelta = (delta: NotebookDelta) => {
    useNotebook.getState().applyDelta(delta);
  };

  streamData.on('data-notebookDelta', handleNotebookDelta);

  return () => {
    streamData.off('data-notebookDelta', handleNotebookDelta);
  };
}, [streamData]);
```

### 8.4 Multimodal Input Component Integration

**File**: `components/multimodal-input.tsx` (MODIFIED)

```typescript
// Add file processing status display
export function MultimodalInput() {
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    file: File;
    status: 'uploading' | 'processing' | 'ready' | 'error';
    metadata?: FileMetadata;
    error?: string;
  }>>([]);

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const validation = validateFileType(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploadedFiles(prev => [...prev, { file, status: 'uploading' }]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();

      setUploadedFiles(prev =>
        prev.map(f =>
          f.file === file
            ? { ...f, status: 'ready', metadata: result.metadata }
            : f
        )
      );

      // Add to attachments for chat
      setAttachments(prev => [...prev, {
        name: result.originalFilename,
        url: result.url,
        contentType: result.contentType,
        metadata: result.metadata,
      }]);

    } catch (error) {
      setUploadedFiles(prev =>
        prev.map(f =>
          f.file === file
            ? { ...f, status: 'error', error: error.message }
            : f
        )
      );
      toast.error(`Upload failed: ${error.message}`);
    }
  };

  return (
    <div>
      {/* File upload status display */}
      {uploadedFiles.length > 0 && (
        <div className="mb-2 space-y-2">
          {uploadedFiles.map((item, i) => (
            <FileUploadStatus key={i} {...item} />
          ))}
        </div>
      )}
      
      {/* Rest of component */}
    </div>
  );
}

function FileUploadStatus({ 
  file, 
  status, 
  metadata, 
  error 
}: { 
  file: File; 
  status: string; 
  metadata?: FileMetadata; 
  error?: string; 
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <FileIcon className="w-4 h-4" />
      <div className="flex-1">
        <div className="text-sm font-medium">{file.name}</div>
        <div className="text-xs text-muted-foreground">
          {status === 'uploading' && 'Uploading...'}
          {status === 'processing' && 'Processing...'}
          {status === 'ready' && metadata && `Ready • ${metadata.rowCount} rows • ${metadata.headers.length} columns`}
          {status === 'error' && <span className="text-red-500">{error}</span>}
        </div>
      </div>
      {status === 'ready' && <CheckIcon className="w-4 h-4 text-green-500" />}
      {status === 'error' && <XIcon className="w-4 h-4 text-red-500" />}
    </div>
  );
}
```

### 8.5 E2B File Caching Strategy

**File**: `lib/jupyter/e2b-client.ts` (ADD TO EXISTING)

```typescript
// Add to E2BSessionManager class
private static fileCache = new Map<string, Set<string>>(); // sessionId -> Set<fileId>

async uploadFile(sessionId: string, fileUrl: string, fileId: string): Promise<string> {
  const sandbox = this.sessions.get(sessionId);
  if (!sandbox) {
    throw new Error('Session not found');
  }

  // Check cache first
  const cachedFiles = E2BSessionManager.fileCache.get(sessionId) || new Set();
  if (cachedFiles.has(fileId)) {
    console.log(`File ${fileId} already in sandbox, skipping upload`);
    return `/data/${fileId}`;
  }

  // Fetch file from Vercel Blob
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const fileName = fileId; // Use fileId as filename for consistency

  // Upload to sandbox
  await sandbox.files.write(`/data/${fileName}`, Buffer.from(buffer));

  // Update cache
  cachedFiles.add(fileId);
  E2BSessionManager.fileCache.set(sessionId, cachedFiles);

  return `/data/${fileName}`;
}

static closeSandbox(sessionId: string) {
  const sandbox = this.sessions.get(sessionId);
  if (sandbox) {
    sandbox.close();
    this.sessions.delete(sessionId);
    this.fileCache.delete(sessionId); // Clear cache
  }
}
```

### 8.6 Notebook Persistence to Database

**File**: `lib/db/schema.ts` (ADD NEW TABLE)

```typescript
export const notebookState = pgTable('notebook_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id').notNull().references(() => chat.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  notebookId: text('notebook_id').notNull(),
  cells: jsonb('cells').notNull().$type<NotebookCell[]>(),
  metadata: jsonb('metadata').notNull().$type<NotebookMetadata>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type NotebookState = typeof notebookState.$inferSelect;
```

**File**: `lib/db/queries.ts` (ADD NEW QUERIES)

```typescript
export async function saveNotebookState(
  chatId: string,
  userId: string,
  notebookId: string,
  cells: NotebookCell[],
  metadata: NotebookMetadata
) {
  const [notebook] = await db
    .insert(notebookState)
    .values({
      chatId,
      userId,
      notebookId,
      cells,
      metadata,
    })
    .onConflictDoUpdate({
      target: [notebookState.notebookId],
      set: {
        cells,
        metadata,
        updatedAt: new Date(),
      },
    })
    .returning();

  return notebook;
}

export async function getNotebookState(notebookId: string) {
  const [notebook] = await db
    .select()
    .from(notebookState)
    .where(eq(notebookState.notebookId, notebookId))
    .limit(1);

  return notebook;
}

export async function getNotebooksByChatId(chatId: string) {
  return db
    .select()
    .from(notebookState)
    .where(eq(notebookState.chatId, chatId))
    .orderBy(desc(notebookState.updatedAt));
}
```

### 8.7 Multi-turn Context Management

**File**: `app/(chat)/actions.ts` (MODIFIED)

```typescript
// Add to chat action
export async function continueConversation(input: string) {
  'use server';

  // ... existing code ...

  // Load file metadata for context
  const files = await getFilesByChatId(chatId);
  
  // Load previous notebook state for multi-turn
  const notebooks = await getNotebooksByChatId(chatId);
  
  // Build context with previous results
  const notebookContext = notebooks
    .map(nb => `
Previous Analysis Results:
${nb.cells
  .filter(cell => cell.type === 'code' && cell.output)
  .map(cell => `
Code: ${cell.content}
Output: ${JSON.stringify(cell.output, null, 2)}
`)
  .join('\n')}
`)
    .join('\n');

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: `${dataAnalysisSystemPrompt}\n\n${fileContextPrompt(files)}\n\n${notebookContext}`,
    messages: convertToCoreMessages(messages),
    maxSteps: 5,
    experimental_toolCallStreaming: true,
    tools: {
      // ... tools ...
    },
    onFinish: async ({ response }) => {
      // Save notebook state after each turn
      if (response.toolCalls?.some(tc => tc.toolName === 'createNotebook' || tc.toolName === 'updateNotebook')) {
        // Extract notebook state from response
        const notebookId = /* extract from tool call */;
        const cells = /* extract from tool call */;
        const metadata = /* extract from tool call */;
        
        await saveNotebookState(chatId, session.user.id, notebookId, cells, metadata);
      }
    },
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error) => {
      // ... error handling ...
    },
  });
}
```

### 8.8 Rate Limiting & Resource Quotas

**File**: `lib/rate-limit.ts` (NEW)

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export async function checkRateLimit(
  userId: string,
  action: 'upload' | 'execute' | 'session',
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const key = `ratelimit:${action}:${userId}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get current count
  const count = await redis.zcount(key, windowStart, now);

  if (count >= config.maxRequests) {
    const oldestRequest = await redis.zrange(key, 0, 0, { withScores: true });
    const resetAt = new Date((oldestRequest[1] as number) + config.windowMs);
    
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Add current request
  await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  
  // Clean old entries
  await redis.zremrangebyscore(key, 0, windowStart);
  
  // Set expiry
  await redis.expire(key, Math.ceil(config.windowMs / 1000));

  return {
    allowed: true,
    remaining: config.maxRequests - count - 1,
    resetAt: new Date(now + config.windowMs),
  };
}

// Predefined limits
export const RATE_LIMITS = {
  FILE_UPLOAD: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  CODE_EXECUTION: { maxRequests: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour
  E2B_SESSION: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
};
```

**File**: `app/(chat)/api/jupyter/execute/route.ts` (ADD RATE LIMITING)

```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(
    session.user.id,
    'execute',
    RATE_LIMITS.CODE_EXECUTION
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt.toISOString(),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        },
      }
    );
  }

  // ... rest of execution logic ...
}
```

### 8.9 Notebook Download (.ipynb Export)

**File**: `lib/jupyter/notebook-export.ts` (NEW)

```typescript
import { NotebookCell, NotebookMetadata } from '@/lib/types';

interface JupyterNotebook {
  cells: JupyterCell[];
  metadata: {
    kernelspec: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info: {
      name: string;
      version: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}

interface JupyterCell {
  cell_type: 'code' | 'markdown';
  execution_count: number | null;
  metadata: Record<string, any>;
  source: string[];
  outputs?: JupyterOutput[];
}

interface JupyterOutput {
  output_type: string;
  data?: Record<string, any>;
  text?: string[];
  execution_count?: number;
}

export function exportToJupyterFormat(
  cells: NotebookCell[],
  metadata: NotebookMetadata
): JupyterNotebook {
  return {
    cells: cells.map(cell => ({
      cell_type: cell.type === 'code' ? 'code' : 'markdown',
      execution_count: cell.executionCount || null,
      metadata: {},
      source: cell.content.split('\n').map(line => line + '\n'),
      outputs: cell.output?.map(output => ({
        output_type: output.type,
        data: output.data,
        execution_count: output.executionCount,
      })),
    })),
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.11',
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

export function downloadNotebook(notebook: JupyterNotebook, fileName: string) {
  const blob = new Blob([JSON.stringify(notebook, null, 2)], {
    type: 'application/x-ipynb+json',
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.ipynb') ? fileName : `${fileName}.ipynb`;
  link.click();
  
  URL.revokeObjectURL(url);
}
```

---

## 9. Security & Performance

### 9.1 Input Sanitization

**File**: `lib/security.ts` (NEW)

```typescript
import sanitize from 'sanitize-filename';

export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts
  const cleaned = sanitize(fileName.replace(/\.\./g, ''));
  
  // Limit length
  return cleaned.slice(0, 255);
}

export function sanitizePythonCode(code: string): { safe: boolean; reason?: string } {
  const dangerousPatterns = [
    /import\s+os/i,
    /import\s+subprocess/i,
    /import\s+sys/i,
    /__import__/i,
    /exec\(/i,
    /eval\(/i,
    /compile\(/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        safe: false,
        reason: `Potentially dangerous code detected: ${pattern.source}`,
      };
    }
  }

  return { safe: true };
}

export function sanitizeSQL(input: string): string {
  // Use parameterized queries instead - this is just for metadata
  return input.replace(/['";]/g, '');
}
```

### 9.2 Performance Optimization

**File**: `lib/performance.ts` (NEW)

```typescript
// Debounce utility for notebook updates
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Memoization for expensive operations
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Progressive loading for large files
export async function* streamLargeFile(
  url: string,
  chunkSize: number = 1024 * 1024 // 1MB chunks
): AsyncGenerator<Buffer> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error('Failed to fetch file');
  }

  const reader = response.body.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield Buffer.from(value);
  }
}
```

---

## 10. Deployment Checklist

### Pre-Deployment
- [ ] All environment variables set in production
- [ ] Database migrations run successfully
- [ ] E2B API key configured and tested
- [ ] Redis instance provisioned (for rate limiting)
- [ ] File size limits configured
- [ ] Rate limits configured per user tier
- [ ] Error tracking service integrated (Sentry)
- [ ] Performance monitoring enabled

### Testing Checklist
- [ ] Unit tests passing (file parsers, E2B client)
- [ ] Integration tests passing (full flow)
- [ ] E2E tests passing (Playwright)
- [ ] Load testing completed (concurrent users)
- [ ] Error scenarios tested (network failures, invalid files)
- [ ] Rate limiting tested
- [ ] Security audit completed

### Post-Deployment Monitoring
- [ ] Monitor E2B usage and costs
- [ ] Track execution success rates
- [ ] Monitor API latency
- [ ] Track error rates by type
- [ ] Monitor file processing times
- [ ] Watch for rate limit violations
- [ ] Track user engagement with notebooks

### Rollback Plan
- [ ] Database migration rollback script ready
- [ ] Previous version deployment ready
- [ ] Feature flag to disable notebook feature
- [ ] Communication plan for users

---

## Summary of Addressed Gaps

✅ **File Upload Integration** - Added validation, processing trigger, error handling
✅ **File Type Validation** - Complete validation with mime types and extensions
✅ **Multimodal Input** - Added file processing status display
✅ **Type Definitions** - Complete TypeScript types for notebook streaming
✅ **Notebook Client** - Added state management with Zustand
✅ **File Association** - Database schema and queries for persistence
✅ **E2B File Caching** - Implemented caching to avoid re-uploads
✅ **Error Recovery** - Retry logic with user feedback
✅ **Notebook Persistence** - Database table and queries for saving state
✅ **Rate Limiting** - Redis-based rate limiting with quotas
✅ **Frontend State** - Zustand store for notebook management
✅ **Multi-turn Context** - Context building from previous executions
✅ **Data Stream Handler** - Integration for notebook deltas
✅ **Notebook Download** - Jupyter format export
✅ **CSV Parser Details** - Encoding detection, delimiter detection
✅ **Excel Parser Details** - Multi-sheet handling, merged cells
✅ **Security** - Input sanitization, code validation
✅ **Logging** - Structured logging with monitoring
✅ **Migration Strategy** - Database migration with rollback
✅ **Deployment Checklist** - Complete pre/post deployment steps

---

**All critical gaps have been addressed. The plan is now complete and ready for implementation.**
