import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { getJupyterClient } from "@/lib/jupyter/client";
import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Execute Python code in Jupyter kernel
 * 
 * POST /api/jupyter/execute
 * Body: { code: string, kernelId?: string }
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const body = await request.json();
    const { code, kernelId } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required and must be a string' },
        { status: 400 }
      );
    }

    // Initialize Jupyter client
    const jupyterClient = getJupyterClient();

    // Get or create a kernel
    let kernel;
    if (kernelId) {
      try {
        kernel = await jupyterClient.getKernel(kernelId);
      } catch (error) {
        // Kernel doesn't exist, create a new one
        kernel = await jupyterClient.getOrCreateKernel(session.user.id);
      }
    } else {
      kernel = await jupyterClient.getOrCreateKernel(session.user.id);
    }

    // Execute the code
    const result = await jupyterClient.executeCode(kernel.id, code);

    return NextResponse.json({
      success: result.success,
      outputs: result.outputs,
      error: result.error,
      kernelId: kernel.id,
    });

  } catch (error: any) {
    console.error('Jupyter execution error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          name: 'ServerError',
          message: error.message || 'Failed to execute code',
          traceback: [error.stack || ''],
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Get kernel status
 * 
 * GET /api/jupyter/execute?kernelId=xxx
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const kernelId = searchParams.get('kernelId');

    if (!kernelId) {
      return NextResponse.json(
        { error: 'kernelId is required' },
        { status: 400 }
      );
    }

    const jupyterClient = getJupyterClient();
    const kernel = await jupyterClient.getKernel(kernelId);

    return NextResponse.json({ kernel });

  } catch (error: any) {
    console.error('Error getting kernel status:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to get kernel status' },
      { status: 500 }
    );
  }
}

/**
 * Delete kernel
 * 
 * DELETE /api/jupyter/execute?kernelId=xxx
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const kernelId = searchParams.get('kernelId');

    if (!kernelId) {
      return NextResponse.json(
        { error: 'kernelId is required' },
        { status: 400 }
      );
    }

    const jupyterClient = getJupyterClient();
    await jupyterClient.deleteKernel(kernelId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting kernel:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to delete kernel' },
      { status: 500 }
    );
  }
}
