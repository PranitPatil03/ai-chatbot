import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { saveDocument } from '@/lib/db/queries';

/**
 * Save notebook state with outputs to database
 * POST /api/notebook/save
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, documentId, cells } = await request.json();

    if (!chatId || !cells) {
      return NextResponse.json(
        { error: 'Missing required fields: chatId, cells' },
        { status: 400 }
      );
    }

    console.log('[Notebook Save] Saving notebook state:', {
      chatId,
      documentId,
      cellCount: cells.length,
      hasOutputs: cells.some((c: any) => c.outputs && c.outputs.length > 0),
      cellsPreview: cells.map((c: any) => ({
        id: c.id,
        hasContent: !!c.content,
        hasOutputs: !!(c.outputs && c.outputs.length > 0),
        outputCount: c.outputs?.length || 0
      }))
    });

    // Save notebook with cells (including outputs) as JSON
    // This format matches what the client expects when loading
    const content = JSON.stringify(cells);
    
    console.log('[Notebook Save] Content to save:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 300)
    });

    // Update the document with the new content including outputs
    if (documentId) {
      const result = await saveDocument({
        id: documentId,
        title: 'Data Analysis',
        kind: 'notebook',
        content: content,
        userId: session.user.id,
      });

      console.log('[Notebook Save] Document saved successfully:', {
        documentId,
        saved: !!result,
        cellsSaved: cells.length
      });
    } else {
      console.warn('[Notebook Save] No documentId provided, cannot save');
    }

    return NextResponse.json({
      success: true,
      documentId,
      cellCount: cells.length,
    });
  } catch (error) {
    console.error('[Notebook Save] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save notebook',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
