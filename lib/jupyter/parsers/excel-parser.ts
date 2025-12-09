import * as XLSX from 'xlsx';

export type ExcelParseResult = {
  headers: string[];
  rowCount: number;
  sheetNames: string[];
  activeSheet: string;
  success: boolean;
  error?: string;
};

/**
 * Parses an Excel file and extracts only headers and row count
 * This is optimized for sending minimal data to the LLM
 * 
 * @param fileBuffer - The Excel file buffer (.xls or .xlsx)
 * @param sheetName - Optional specific sheet to parse (defaults to first sheet)
 * @returns Parsed Excel metadata (headers, row count, sheet names)
 */
export async function parseExcel(
  fileBuffer: Buffer,
  sheetName?: string
): Promise<ExcelParseResult> {
  try {
    // Read the workbook from buffer
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: false, // Keep dates as numbers for faster parsing
      cellFormula: false, // Don't parse formulas
      cellStyles: false, // Don't parse styles
    });
    
    // Get all sheet names
    const sheetNames = workbook.SheetNames;
    
    if (sheetNames.length === 0) {
      return {
        headers: [],
        rowCount: 0,
        sheetNames: [],
        activeSheet: '',
        success: false,
        error: 'No sheets found in Excel file',
      };
    }
    
    // Determine which sheet to parse
    const targetSheet = sheetName && sheetNames.includes(sheetName)
      ? sheetName
      : sheetNames[0];
    
    const worksheet = workbook.Sheets[targetSheet];
    
    if (!worksheet) {
      return {
        headers: [],
        rowCount: 0,
        sheetNames,
        activeSheet: targetSheet,
        success: false,
        error: `Sheet "${targetSheet}" not found`,
      };
    }
    
    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Extract headers (first row)
    const headers: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
      const cell = worksheet[cellAddress];
      
      if (cell && cell.v !== undefined) {
        headers.push(String(cell.v));
      } else {
        headers.push(`Column${col + 1}`); // Default name for empty header
      }
    }
    
    // Calculate row count (excluding header)
    const rowCount = Math.max(0, range.e.r - range.s.r);
    
    return {
      headers,
      rowCount,
      sheetNames,
      activeSheet: targetSheet,
      success: true,
    };
  } catch (error) {
    return {
      headers: [],
      rowCount: 0,
      sheetNames: [],
      activeSheet: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing Excel file',
    };
  }
}

/**
 * Parses all sheets in an Excel file
 * Returns metadata for each sheet
 */
export async function parseAllExcelSheets(
  fileBuffer: Buffer
): Promise<Map<string, { headers: string[]; rowCount: number }>> {
  const results = new Map<string, { headers: string[]; rowCount: number }>();
  
  try {
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: false,
      cellFormula: false,
      cellStyles: false,
    });
    
    for (const sheetName of workbook.SheetNames) {
      const result = await parseExcel(fileBuffer, sheetName);
      
      if (result.success) {
        results.set(sheetName, {
          headers: result.headers,
          rowCount: result.rowCount,
        });
      }
    }
  } catch (error) {
    console.error('Error parsing all Excel sheets:', error);
  }
  
  return results;
}

/**
 * Validates if a file is a valid Excel file
 */
export function isValidExcel(fileBuffer: Buffer): boolean {
  try {
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
    });
    
    return workbook.SheetNames.length > 0;
  } catch {
    return false;
  }
}

/**
 * Gets a sample of Excel data (for testing/preview)
 * Returns first N rows including headers
 */
export async function getExcelSample(
  fileBuffer: Buffer,
  sampleSize: number = 5,
  sheetName?: string
): Promise<{ headers: string[]; rows: unknown[][]; sheetName: string }> {
  try {
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
    });
    
    const sheetNames = workbook.SheetNames;
    const targetSheet = sheetName && sheetNames.includes(sheetName)
      ? sheetName
      : sheetNames[0];
    
    const worksheet = workbook.Sheets[targetSheet];
    
    if (!worksheet) {
      return { headers: [], rows: [], sheetName: targetSheet };
    }
    
    // Convert to JSON with header row
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Return as array of arrays
      range: 0, // Start from first row
      defval: '', // Default value for empty cells
    }) as unknown[][];
    
    // First row is headers
    const headers = data[0] as string[] || [];
    
    // Get sample rows (skip header, take N rows)
    const rows = data.slice(1, sampleSize + 1);
    
    return {
      headers,
      rows,
      sheetName: targetSheet,
    };
  } catch (error) {
    console.error('Error getting Excel sample:', error);
    return { headers: [], rows: [], sheetName: sheetName || '' };
  }
}

/**
 * Gets basic info about an Excel file
 */
export function getExcelInfo(fileBuffer: Buffer): {
  sheetCount: number;
  sheetNames: string[];
  fileSize: number;
} {
  try {
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: false,
      cellFormula: false,
      cellStyles: false,
    });
    
    return {
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
      fileSize: fileBuffer.length,
    };
  } catch (error) {
    console.error('Error getting Excel info:', error);
    return {
      sheetCount: 0,
      sheetNames: [],
      fileSize: fileBuffer.length,
    };
  }
}
