import { NextResponse } from 'next/server';
import { generateUUID } from '@/lib/utils';
import { saveFileMetadata } from '@/lib/db/queries';
import { parseCSV } from '@/lib/jupyter/parsers/csv-parser';
import { parseExcel } from '@/lib/jupyter/parsers/excel-parser';

/**
 * File Processing API
 * 
 * Processes uploaded CSV/Excel files and extracts metadata
 * Stores minimal data (headers, row count) in database
 * 
 * POST /api/files/process
 * Body: { blobUrl, fileName, fileType, fileSize, chatId }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { blobUrl, fileName, fileType, fileSize, chatId } = body;

    console.log('[File Process API] Received request:', {
      chatId,
      fileName,
      fileType,
      fileSize,
      blobUrl: blobUrl?.substring(0, 50) + '...'
    });

    // Validate required fields
    if (!blobUrl || !fileName || !fileType || !chatId) {
      console.error('[File Process API] Missing required fields:', { blobUrl: !!blobUrl, fileName: !!fileName, fileType: !!fileType, chatId: !!chatId });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Download file from blob storage
    console.log('[File Process API] Downloading file from blob storage...');
    const fileResponse = await fetch(blobUrl);
    if (!fileResponse.ok) {
      console.error('[File Process API] Failed to download file:', fileResponse.status, fileResponse.statusText);
      return NextResponse.json(
        { error: 'Failed to download file from blob storage' },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[File Process API] File downloaded, size:', buffer.length, 'bytes');

    // Process based on file type
    let headers: string[] = [];
    let rowCount = 0;
    let sheetNames: string[] | undefined;
    let encoding: string | undefined;
    let parseError: string | undefined;

    if (fileType === 'text/csv' || fileType.includes('csv') || fileName.endsWith('.csv')) {
      // Parse CSV
      console.log('[File Process API] Parsing CSV file...');
      const result = await parseCSV(buffer);
      
      if (!result.success) {
        console.error('[File Process API] CSV parsing failed:', result.error);
        return NextResponse.json(
          { error: result.error || 'Failed to parse CSV file' },
          { status: 400 }
        );
      }

      headers = result.headers;
      rowCount = result.rowCount;
      encoding = result.encoding;
      console.log('[File Process API] CSV parsed successfully:', {
        headers: headers.length,
        rowCount,
        encoding
      });
    } else if (
      fileType === 'application/vnd.ms-excel' ||
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileType.includes('excel') ||
      fileType.includes('spreadsheet') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.xlsx')
    ) {
      // Parse Excel
      console.log('[File Process API] Parsing Excel file...');
      const result = await parseExcel(buffer);
      
      if (!result.success) {
        console.error('[File Process API] Excel parsing failed:', result.error);
        return NextResponse.json(
          { error: result.error || 'Failed to parse Excel file' },
          { status: 400 }
        );
      }

      headers = result.headers;
      rowCount = result.rowCount;
      sheetNames = result.sheetNames;
      console.log('[File Process API] Excel parsed successfully:', {
        headers: headers.length,
        rowCount,
        sheetNames
      });
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload CSV or Excel files.' },
        { status: 400 }
      );
    }

    // Generate unique ID for file metadata
    const fileId = generateUUID();
    const now = new Date();

    // Save metadata to database
    console.log('[File Process API] Saving metadata to database...');
    await saveFileMetadata({
      id: fileId,
      chatId,
      fileName,
      fileSize: parseInt(String(fileSize), 10) || 0,
      fileType,
      blobUrl,
      headers,
      rowCount,
      sheetNames,
      encoding,
      uploadedAt: now,
      processedAt: now,
    });

    console.log('[File Process API] File processed successfully:', {
      fileId,
      fileName,
      headers: headers.length,
      rowCount
    });

    // Return metadata
    return NextResponse.json({
      success: true,
      fileId,
      fileName,
      fileType,
      headers,
      rowCount,
      sheetNames,
      encoding,
      blobUrl,
    });
  } catch (error) {
    console.error('[File Process API] Error processing file:', error);
    console.error('[File Process API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Internal server error processing file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
