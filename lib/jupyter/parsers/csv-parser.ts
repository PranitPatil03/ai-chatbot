import Papa from 'papaparse';
// @ts-expect-error - No type definitions available
import * as Encoding from 'encoding-japanese';
import iconv from 'iconv-lite';

export type CSVParseResult = {
  headers: string[];
  rowCount: number;
  encoding: string;
  delimiter: string;
  success: boolean;
  error?: string;
};

/**
 * Detects the encoding of a CSV file
 * Supports UTF-8, Shift_JIS, EUC-JP, and other common encodings
 */
function detectEncoding(buffer: Buffer): string {
  const detectedEncoding = Encoding.detect(buffer);
  
  if (Array.isArray(detectedEncoding)) {
    // If multiple encodings detected, prefer UTF-8
    return detectedEncoding.includes('UTF8') ? 'UTF-8' : detectedEncoding[0];
  }
  
  return detectedEncoding || 'UTF-8';
}

/**
 * Converts buffer to UTF-8 string with proper encoding detection
 */
function bufferToString(buffer: Buffer, encoding: string): string {
  try {
    // Handle common encoding names
    const normalizedEncoding = encoding.toUpperCase().replace(/-/g, '');
    
    if (normalizedEncoding === 'UTF8' || normalizedEncoding === 'UTF8') {
      return buffer.toString('utf-8');
    }
    
    if (normalizedEncoding === 'SHIFTJIS' || normalizedEncoding === 'SJIS') {
      return iconv.decode(buffer, 'shift_jis');
    }
    
    if (normalizedEncoding === 'EUCJP') {
      return iconv.decode(buffer, 'euc-jp');
    }
    
    // Try iconv-lite for other encodings
    if (iconv.encodingExists(encoding)) {
      return iconv.decode(buffer, encoding);
    }
    
    // Fallback to UTF-8
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Error decoding buffer:', error);
    return buffer.toString('utf-8');
  }
}

/**
 * Detects the delimiter used in CSV file
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0];
  const delimiters = [',', ';', '\t', '|'];
  
  let maxCount = 0;
  let detectedDelimiter = ',';
  
  for (const delimiter of delimiters) {
    const count = firstLine.split(delimiter).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }
  
  return detectedDelimiter;
}

/**
 * Parses a CSV file and extracts only headers and row count
 * This is optimized for sending minimal data to the LLM
 * 
 * @param fileBuffer - The CSV file buffer
 * @returns Parsed CSV metadata (headers, row count, encoding)
 */
export async function parseCSV(fileBuffer: Buffer): Promise<CSVParseResult> {
  try {
    // Detect encoding
    const encoding = detectEncoding(fileBuffer);
    
    // Convert buffer to string with detected encoding
    const content = bufferToString(fileBuffer, encoding);
    
    // Detect delimiter
    const delimiter = detectDelimiter(content);
    
    // Parse CSV with PapaParse
    const result = Papa.parse(content, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      preview: 0, // Parse all rows to get accurate count
    });
    
    if (result.errors.length > 0) {
      const criticalErrors = result.errors.filter(
        (error) => error.type === 'FieldMismatch' || error.type === 'Quotes'
      );
      
      if (criticalErrors.length > 0) {
        return {
          headers: [],
          rowCount: 0,
          encoding,
          delimiter,
          success: false,
          error: `CSV parsing error: ${criticalErrors[0].message}`,
        };
      }
    }
    
    // Extract headers
    const headers = result.meta.fields || [];
    
    // Get row count (excluding header)
    const rowCount = result.data.length;
    
    return {
      headers,
      rowCount,
      encoding,
      delimiter,
      success: true,
    };
  } catch (error) {
    return {
      headers: [],
      rowCount: 0,
      encoding: 'UTF-8',
      delimiter: ',',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing CSV',
    };
  }
}

/**
 * Validates if a file is a valid CSV
 */
export function isValidCSV(content: string): boolean {
  try {
    const result = Papa.parse(content, {
      header: true,
      preview: 1,
    });
    
    return !!(result.data.length > 0 && result.meta.fields && result.meta.fields.length > 0);
  } catch {
    return false;
  }
}

/**
 * Gets a sample of CSV data (for testing/preview)
 * Returns first N rows including headers
 */
export async function getCSVSample(
  fileBuffer: Buffer,
  sampleSize: number = 5
): Promise<{ headers: string[]; rows: unknown[] }> {
  try {
    const encoding = detectEncoding(fileBuffer);
    const content = bufferToString(fileBuffer, encoding);
    const delimiter = detectDelimiter(content);
    
    const result = Papa.parse(content, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      preview: sampleSize,
    });
    
    return {
      headers: result.meta.fields || [],
      rows: result.data,
    };
  } catch (error) {
    console.error('Error getting CSV sample:', error);
    return { headers: [], rows: [] };
  }
}
