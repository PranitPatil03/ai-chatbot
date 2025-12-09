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
    });

    // Save notebook with cells (including outputs) to document table
    // The content is already in the XML format expected by the artifact system
    const cellsXML = cells
      .map((cell: any) => {
        const outputs = cell.outputs
          ? `\n<!-- Outputs: ${JSON.stringify(cell.outputs)} -->`
          : '';
        return `<VSCode.Cell id="${cell.id}" language="${cell.type === 'code' ? 'python' : 'markdown'}">${outputs}\n${cell.content}\n</VSCode.Cell>`;
      })
      .join('\n\n');

    // Update the document with the new content including outputs
    if (documentId) {
      await saveDocument({
        id: documentId,
        title: 'Data Analysis',
        kind: 'notebook',
        content: cellsXML,
        userId: session.user.id,
      });

      console.log('[Notebook Save] Document updated successfully');
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
