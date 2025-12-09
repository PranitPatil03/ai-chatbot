import * as XLSX from "xlsx";

export interface ProcessedFileContent {
  type: "text" | "data";
  content: string;
  metadata: {
    originalType: string;
    sheets?: string[];
    rowCount?: number;
    columnCount?: number;
  };
}

/**
 * Downloads and processes a file from a URL
 * Converts Excel/CSV files to text format that Claude can understand
 */
export async function processFileForAI(
  url: string,
  mediaType: string
): Promise<ProcessedFileContent | null> {
  console.log("📊 [FILE PROCESSOR] Processing file:", { url, mediaType });

  try {
    // Check if it's a supported file type that needs processing
    const needsProcessing =
      mediaType.includes("spreadsheet") ||
      mediaType.includes("excel") ||
      mediaType.includes("csv") ||
      mediaType === "application/vnd.ms-excel" ||
      mediaType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mediaType === "text/csv";

    if (!needsProcessing) {
      console.log("📊 [FILE PROCESSOR] File type doesn't need processing");
      return null;
    }

    // Download the file
    console.log("⬇️  [FILE PROCESSOR] Downloading file from URL...");
    const response = await fetch(url);
    if (!response.ok) {
      console.error("❌ [FILE PROCESSOR] Failed to download file");
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(
      "✅ [FILE PROCESSOR] File downloaded, size:",
      arrayBuffer.byteLength,
      "bytes"
    );

    // Parse with xlsx library
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    console.log("📚 [FILE PROCESSOR] Workbook sheets:", workbook.SheetNames);

    // Convert all sheets to text format
    let textContent = "";
    const sheets = workbook.SheetNames;

    for (const sheetName of sheets) {
      const worksheet = workbook.Sheets[sheetName];

      // Get sheet dimensions
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      const rowCount = range.e.r - range.s.r + 1;
      const colCount = range.e.c - range.s.c + 1;

      textContent += `\n## Sheet: ${sheetName}\n`;
      textContent += `Rows: ${rowCount}, Columns: ${colCount}\n\n`;

      // Convert to CSV format (easier for Claude to parse)
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      textContent += csv + "\n\n";

      console.log(
        `📄 [FILE PROCESSOR] Sheet "${sheetName}": ${rowCount} rows, ${colCount} columns`
      );
    }

    // Also create a JSON representation for the first sheet (if needed)
    const firstSheet = workbook.Sheets[sheets[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

    console.log(
      "✅ [FILE PROCESSOR] File processed successfully, extracted",
      jsonData.length,
      "rows"
    );

    return {
      type: "data",
      content: textContent.trim(),
      metadata: {
        originalType: mediaType,
        sheets,
        rowCount: jsonData.length,
        columnCount: Object.keys(jsonData[0] || {}).length,
      },
    };
  } catch (error) {
    console.error("❌ [FILE PROCESSOR] Error processing file:", error);
    return null;
  }
}

/**
 * Checks if a media type is supported by Claude natively
 * Claude currently only supports: images (jpeg, png, gif, webp) and PDFs
 */
export function isSupportedByClaudeNatively(mediaType: string): boolean {
  const supportedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Note: PDF is technically supported but may have limitations
    // "application/pdf",
  ];

  return supportedTypes.some((type) => mediaType.includes(type));
}
