import { Sandbox } from '@e2b/code-interpreter';

/**
 * E2B Session Manager
 * 
 * Manages E2B Code Interpreter sandbox sessions with:
 * - Session caching (30-minute persistence)
 * - File upload to sandbox
 * - Code execution with streaming
 * - Error handling and cleanup
 */

// Session cache: chatId -> { sandbox, expiresAt }
const sessionCache = new Map<string, {
  sandbox: Sandbox;
  expiresAt: number;
}>();

// Session timeout: 2 hours (long analysis sessions)
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;

// Cleanup interval: Check every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Start cleanup interval
setInterval(() => {
  cleanupExpiredSessions();
}, CLEANUP_INTERVAL);

/**
 * Get or create E2B sandbox for a chat session
 */
export async function getOrCreateSandbox(chatId: string): Promise<Sandbox> {
  const now = Date.now();
  const cached = sessionCache.get(chatId);

  // Return cached session if still valid
  if (cached && cached.expiresAt > now) {
    console.log(`[E2B] Using cached sandbox for chat ${chatId}`);
    // Extend expiration
    cached.expiresAt = now + SESSION_TIMEOUT;
    return cached.sandbox;
  }

  // Create new sandbox
  console.log(`[E2B] Creating new sandbox for chat ${chatId}`);
  
  if (!process.env.E2B_API_KEY) {
    throw new Error('E2B_API_KEY environment variable is not set');
  }

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    // 2 hour timeout for long analysis sessions (default was 60 seconds)
    timeoutMs: parseInt(process.env.E2B_SANDBOX_TIMEOUT || '7200000', 10),
  });

  // Cache the session
  sessionCache.set(chatId, {
    sandbox,
    expiresAt: now + SESSION_TIMEOUT,
  });

  console.log(`[E2B] Sandbox created: ${sandbox.sandboxId}`);
  return sandbox;
}

/**
 * Upload file from Vercel Blob to E2B sandbox
 */
export async function uploadFileToSandbox(
  sandbox: Sandbox,
  blobUrl: string,
  fileName: string
): Promise<string> {
  try {
    console.log(`[E2B] Uploading file ${fileName} to sandbox`);

    // Download file from Vercel Blob
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file from blob: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Upload to sandbox /tmp directory (standard location for data files)
    const filePath = `/tmp/${fileName}`;
    await sandbox.files.write(filePath, arrayBuffer);

    console.log(`[E2B] File uploaded successfully: ${fileName} -> ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('[E2B] File upload error:', error);
    throw new Error(`Failed to upload file to sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute Python code in sandbox
 */
export async function executeCode(
  sandbox: Sandbox,
  code: string
): Promise<{
  success: boolean;
  results: Array<{
    type: 'text' | 'image' | 'error';
    content: string;
    mimeType?: string;
  }>;
  error?: string;
  executionTime: number;
}> {
  const startTime = Date.now();

  try {
    console.log('[E2B] Executing code:', code.substring(0, 100) + '...');

    const execution = await sandbox.runCode(code);
    const executionTime = Date.now() - startTime;

    const results: Array<{
      type: 'text' | 'image' | 'error';
      content: string;
      mimeType?: string;
    }> = [];

    // Process results
    if (execution.logs.stdout.length > 0) {
      results.push({
        type: 'text',
        content: execution.logs.stdout.join('\n'),
      });
    }

    if (execution.logs.stderr.length > 0) {
      results.push({
        type: 'error',
        content: execution.logs.stderr.join('\n'),
      });
    }

    // Process display data (plots, images, etc.)
    for (const result of execution.results) {
      if (result.png) {
        results.push({
          type: 'image',
          content: result.png,
          mimeType: 'image/png',
        });
      } else if (result.jpeg) {
        results.push({
          type: 'image',
          content: result.jpeg,
          mimeType: 'image/jpeg',
        });
      } else if (result.text) {
        results.push({
          type: 'text',
          content: result.text,
        });
      } else if (result.html) {
        results.push({
          type: 'text',
          content: result.html,
          mimeType: 'text/html',
        });
      }
    }

    // Check for errors
    if (execution.error) {
      return {
        success: false,
        results,
        error: execution.error.value,
        executionTime,
      };
    }

    console.log(`[E2B] Code executed successfully in ${executionTime}ms`);
    return {
      success: true,
      results,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[E2B] Execution error:', error);
    
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown execution error',
      executionTime,
    };
  }
}

/**
 * Close a sandbox and remove from cache
 */
export async function closeSandbox(chatId: string): Promise<void> {
  const cached = sessionCache.get(chatId);
  
  if (cached) {
    console.log(`[E2B] Closing sandbox for chat ${chatId}`);
    await cached.sandbox.kill();
    sessionCache.delete(chatId);
  }
}

/**
 * Cleanup expired sessions
 */
async function cleanupExpiredSessions(): Promise<void> {
  const now = Date.now();
  const expiredChats: string[] = [];

  for (const [chatId, cached] of sessionCache.entries()) {
    if (cached.expiresAt <= now) {
      expiredChats.push(chatId);
    }
  }

  if (expiredChats.length > 0) {
    console.log(`[E2B] Cleaning up ${expiredChats.length} expired sessions`);
    
    for (const chatId of expiredChats) {
      await closeSandbox(chatId);
    }
  }
}

/**
 * Get sandbox info
 */
export function getSandboxInfo(chatId: string): {
  exists: boolean;
  expiresIn?: number;
  sandboxId?: string;
} {
  const cached = sessionCache.get(chatId);
  
  if (!cached) {
    return { exists: false };
  }

  const now = Date.now();
  const expiresIn = Math.max(0, cached.expiresAt - now);

  return {
    exists: true,
    expiresIn,
    sandboxId: cached.sandbox.sandboxId,
  };
}

/**
 * Install Python packages in sandbox
 */
export async function installPackages(
  sandbox: Sandbox,
  packages: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[E2B] Installing packages: ${packages.join(', ')}`);
    
    const code = `
import subprocess
import sys

packages = ${JSON.stringify(packages)}
for package in packages:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", package])
    
print(f"Successfully installed: {', '.join(packages)}")
`;

    const result = await executeCode(sandbox, code);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to install packages',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[E2B] Package installation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get active session count (for monitoring)
 */
export function getActiveSessionCount(): number {
  return sessionCache.size;
}

/**
 * Force cleanup all sessions (for testing/shutdown)
 */
export async function cleanupAllSessions(): Promise<void> {
  console.log(`[E2B] Cleaning up all ${sessionCache.size} sessions`);
  
  const promises = Array.from(sessionCache.keys()).map(chatId => closeSandbox(chatId));
  await Promise.all(promises);
}
