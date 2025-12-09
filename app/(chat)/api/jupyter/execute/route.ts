import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  getOrCreateSandbox,
  uploadFileToSandbox,
  executeCode,
  getSandboxInfo,
} from '@/lib/jupyter/e2b-manager';
import { getFileMetadataByChatId } from '@/lib/db/queries';

/**
 * Jupyter Code Execution API
 * 
 * Executes Python code in E2B Code Interpreter sandbox
 * Automatically uploads files from chat to sandbox
 * 
 * POST /api/jupyter/execute
 * Body: { chatId, code, fileIds? }
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chatId, code, fileIds } = body;

    // Validate required fields
    if (!chatId || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: chatId, code' },
        { status: 400 }
      );
    }

    // Validate code length
    if (code.length > 50000) {
      return NextResponse.json(
        { error: 'Code too long (max 50,000 characters)' },
        { status: 400 }
      );
    }

    console.log(`[API] Executing code for chat ${chatId}`);

    // Get or create sandbox
    const sandbox = await getOrCreateSandbox(chatId);
    const sandboxInfo = getSandboxInfo(chatId);

    // Upload files if specified
    const uploadedFiles: string[] = [];
    if (fileIds && fileIds.length > 0) {
      console.log(`[API] Uploading ${fileIds.length} files to sandbox`);
      
      const fileMetadataList = await getFileMetadataByChatId({ chatId });
      const filesMap = new Map(fileMetadataList.map(f => [f.id, f]));

      for (const fileId of fileIds) {
        const fileMeta = filesMap.get(fileId);
        if (!fileMeta) {
          console.warn(`[API] File ${fileId} not found, skipping`);
          continue;
        }

        try {
          const filePath = await uploadFileToSandbox(
            sandbox,
            fileMeta.blobUrl,
            fileMeta.fileName
          );
          uploadedFiles.push(filePath);
        } catch (error) {
          console.error(`[API] Failed to upload file ${fileMeta.fileName}:`, error);
          return NextResponse.json(
            {
              error: `Failed to upload file ${fileMeta.fileName}`,
              details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
          );
        }
      }
    } else {
      // Upload all files from chat
      console.log('[API] Uploading all files from chat to sandbox');
      const fileMetadataList = await getFileMetadataByChatId({ chatId });

      for (const fileMeta of fileMetadataList) {
        try {
          const filePath = await uploadFileToSandbox(
            sandbox,
            fileMeta.blobUrl,
            fileMeta.fileName
          );
          uploadedFiles.push(filePath);
        } catch (error) {
          console.error(`[API] Failed to upload file ${fileMeta.fileName}:`, error);
          // Continue with other files
        }
      }
    }

    // Execute code
    console.log(`[API] Executing code in sandbox ${sandboxInfo.sandboxId}`);
    const result = await executeCode(sandbox, code);

    // Return results
    return NextResponse.json({
      success: result.success,
      results: result.results,
      error: result.error,
      executionTime: result.executionTime,
      sandboxId: sandboxInfo.sandboxId,
      uploadedFiles,
      expiresIn: sandboxInfo.expiresIn,
    });

  } catch (error) {
    console.error('[API] Execution error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to execute code',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get sandbox info for a chat
 * 
 * GET /api/jupyter/execute?chatId=xxx
 */
export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json(
        { error: 'Missing chatId parameter' },
        { status: 400 }
      );
    }

    const sandboxInfo = getSandboxInfo(chatId);

    return NextResponse.json({
      exists: sandboxInfo.exists,
      sandboxId: sandboxInfo.sandboxId,
      expiresIn: sandboxInfo.expiresIn,
    });

  } catch (error) {
    console.error('[API] Get sandbox info error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get sandbox info',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
