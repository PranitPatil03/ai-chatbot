import { memo, useEffect, useState } from 'react';
import { create } from 'zustand';
import type { NotebookCell, NotebookOutput } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Play, Loader2, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { Artifact } from '@/components/create-artifact';

/**
 * Notebook Artifact Client Component
 * 
 * Jupyter-style notebook interface for data analysis
 * Features:
 * - Multiple cells (code, markdown, output)
 * - Cell-by-cell execution
 * - Execution status indicators
 * - Output rendering (text, images, errors, tables)
 */

// Zustand store for notebook state
interface NotebookStore {
  cells: NotebookCell[];
  isExecuting: boolean;
  currentCellId: string | null;
  sessionStatus: 'idle' | 'initializing' | 'ready' | 'error';
  errorMessage: string | null;
  
  setCells: (cells: NotebookCell[]) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setCurrentCellId: (cellId: string | null) => void;
  setSessionStatus: (status: 'idle' | 'initializing' | 'ready' | 'error') => void;
  setErrorMessage: (message: string | null) => void;
  updateCell: (cellId: string, updates: Partial<NotebookCell>) => void;
  addCell: (afterCellId?: string) => void;
  deleteCell: (cellId: string) => void;
}

const useNotebookStore = create<NotebookStore>((set) => ({
  cells: [],
  isExecuting: false,
  currentCellId: null,
  sessionStatus: 'idle',
  errorMessage: null,
  
  setCells: (cells) => set({ cells }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  setCurrentCellId: (currentCellId) => set({ currentCellId }),
  setSessionStatus: (sessionStatus) => set({ sessionStatus }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  
  updateCell: (cellId, updates) => set((state) => ({
    cells: state.cells.map((cell) =>
      cell.id === cellId ? { ...cell, ...updates } : cell
    ),
  })),
  
  addCell: (afterCellId) => set((state) => {
    const newCell: NotebookCell = {
      id: `cell-${Date.now()}`,
      type: 'code',
      content: '',
      status: 'idle',
    };
    
    if (!afterCellId) {
      return { cells: [...state.cells, newCell] };
    }
    
    const index = state.cells.findIndex((c) => c.id === afterCellId);
    const newCells = [...state.cells];
    newCells.splice(index + 1, 0, newCell);
    return { cells: newCells };
  }),
  
  deleteCell: (cellId) => set((state) => ({
    cells: state.cells.filter((c) => c.id !== cellId),
  })),
}));

// Cell Output Renderer
function CellOutput({ output }: { output: NotebookOutput }) {
  if (output.type === 'text') {
    return (
      <div className="bg-muted/20 border border-muted rounded-md overflow-hidden">
        <pre className="text-sm font-mono whitespace-pre-wrap p-3 overflow-x-auto">
          {output.content}
        </pre>
      </div>
    );
  }
  
  if (output.type === 'image') {
    return (
      <div className="rounded-md overflow-hidden border border-muted bg-white dark:bg-gray-900 p-2">
        <img 
          src={`data:${output.mimeType};base64,${output.content}`}
          alt="Output visualization"
          className="max-w-full h-auto mx-auto"
        />
      </div>
    );
  }
  
  if (output.type === 'error') {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-3">
        <div className="flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <pre className="text-sm font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap flex-1 overflow-x-auto">
            {output.content}
          </pre>
        </div>
      </div>
    );
  }
  
  if (output.type === 'table') {
    return (
      <div className="overflow-x-auto border border-muted rounded-md bg-muted/20">
        <pre className="text-sm font-mono p-3">
          {output.content}
        </pre>
      </div>
    );
  }
  
  return null;
}

// Individual Cell Component
const NotebookCellComponent = memo(({
  cell,
  onExecute,
  isExecuting,
}: {
  cell: NotebookCell;
  onExecute: (cellId: string) => void;
  isExecuting: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const statusIcon = {
    idle: null,
    running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
  }[cell.status || 'idle'];
  
  return (
    <div
      className="group relative border-l-2 border-transparent hover:border-blue-500 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3 p-4">
        {/* Execution Count / Status */}
        <div className="flex flex-col items-center gap-2 w-14 shrink-0 pt-1">
          <div className="text-xs text-muted-foreground font-mono font-semibold">
            {cell.executionCount ? `[${cell.executionCount}]` : '[ ]'}
          </div>
          {statusIcon}
        </div>
        
        {/* Cell Content */}
        <div className="flex-1 space-y-3">
          {/* Code Display (Read-only) */}
          <div className="relative">
            <div className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
              Python
            </div>
            <pre className="w-full min-h-20 p-3 pt-8 font-mono text-sm bg-muted/30 border rounded-md overflow-x-auto whitespace-pre-wrap wrap-break-word">
              {cell.content || '# No code'}
            </pre>
          </div>
          
          {/* Cell Outputs */}
          {cell.outputs && cell.outputs.length > 0 && (
            <div className="space-y-2 pl-2 border-l-2 border-blue-200 dark:border-blue-800">
              <div className="text-xs text-muted-foreground font-semibold mb-1">Output:</div>
              {cell.outputs.map((output, idx) => (
                <CellOutput key={idx} output={output} />
              ))}
            </div>
          )}
          
          {/* Execution Time */}
          {cell.executionTime !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Executed in {cell.executionTime}ms
            </div>
          )}
          
          {/* Error Message */}
          {cell.error && (
            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded-md">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {cell.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

NotebookCellComponent.displayName = 'NotebookCell';

// Main Notebook Component
export function NotebookArtifactComponent({
  content,
  isStreaming,
  onExecute,
}: {
  content: string;
  isStreaming: boolean;
  onExecute?: (cellId: string, code: string) => Promise<void>;
}) {
  const { cells, setCells, isExecuting, setIsExecuting, sessionStatus, errorMessage } = useNotebookStore();
  
  // Parse content on mount or when content changes
  useEffect(() => {
    console.log('[Notebook Client] Content received:', {
      length: content?.length,
      isEmpty: !content,
      preview: content?.substring(0, 200),
      fullContent: content
    });

    if (!content || content.trim() === '') {
      console.log('[Notebook Client] Empty content, initializing with default cell');
      setCells([
        {
          id: 'cell-1',
          type: 'code',
          content: '',
          status: 'idle',
        },
      ]);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      console.log('[Notebook Client] Parsed JSON successfully:', {
        isArray: Array.isArray(parsed),
        cellCount: Array.isArray(parsed) ? parsed.length : 0,
        firstCell: Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null
      });
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure all cells have the proper structure
        const validCells = parsed.map((cell: any) => ({
          ...cell,
          status: cell.status || 'idle',
          type: cell.type || 'code',
        }));
        console.log('[Notebook Client] Setting cells:', validCells);
        setCells(validCells);
      } else {
        console.warn('[Notebook Client] Parsed but not a valid array, using default');
        setCells([
          {
            id: 'cell-1',
            type: 'code',
            content: '',
            status: 'idle',
          },
        ]);
      }
    } catch (error) {
      console.error('[Notebook Client] Failed to parse JSON:', error);
      console.error('[Notebook Client] Content that failed to parse:', content);
      // Initialize with empty cell if parsing fails
      if (cells.length === 0) {
        setCells([
          {
            id: 'cell-1',
            type: 'code',
            content: '',
            status: 'idle',
          },
        ]);
      }
    }
  }, [content]);
  
  const handleExecuteCell = async (cellId: string) => {
    const cell = cells.find((c) => c.id === cellId);
    if (!cell || !onExecute) return;
    
    setIsExecuting(true);
    
    try {
      await onExecute(cellId, cell.content);
    } catch (error) {
      console.error('Execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Notebook Header */}
      <div className="flex items-center justify-between p-4 border-b bg-linear-to-r from-muted/50 to-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              <path d="M9 12h6m-6 4h6" />
            </svg>
            <div className="text-sm font-semibold">Data Analysis Notebook</div>
          </div>
          <div className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium",
            sessionStatus === 'ready' && "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",
            sessionStatus === 'initializing' && "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
            sessionStatus === 'error' && "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
            sessionStatus === 'idle' && "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400"
          )}>
            {sessionStatus === 'ready' ? '● Ready' : sessionStatus === 'initializing' ? '● Initializing' : sessionStatus === 'error' ? '● Error' : 'Idle'}
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          {cells.length} {cells.length === 1 ? 'cell' : 'cells'} • Read-only
        </div>
      </div>
      
      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800 p-3">
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            {errorMessage}
          </div>
        </div>
      )}
      
      {/* Notebook Cells */}
      <div className="flex-1 overflow-y-auto">
        {cells.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">No cells available</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {cells.map((cell) => (
              <NotebookCellComponent
                key={cell.id}
                cell={cell}
                onExecute={handleExecuteCell}
                isExecuting={isExecuting}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Streaming Indicator */}
      {isStreaming && (
        <div className="border-t p-3 bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating code...
          </div>
        </div>
      )}
    </div>
  );
}

// Metadata type for notebook
type NotebookMetadata = {
  chatId?: string;
  documentId?: string;
  sessionId?: string;
  filesLoaded?: string[];
};

// Artifact definition
export const notebookArtifact = new Artifact<'notebook', NotebookMetadata>({
  kind: 'notebook',
  description: 'Useful for data analysis with Python notebooks; Execute code cells with uploaded CSV/Excel files.',
  initialize: ({ setMetadata, documentId, chatId }) => {
    console.log('[Notebook Artifact] Initializing with chatId:', chatId, 'documentId:', documentId);
    setMetadata({
      chatId: chatId,
      documentId: documentId,
      sessionId: undefined,
      filesLoaded: [],
    });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'data-notebookDelta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: 'streaming',
      }));
    }
  },
  content: ({ content, status, metadata, setMetadata }) => {
    // Cells are now executed server-side before streaming to client
    // No need for client-side auto-execution
    console.log('[Notebook] Cells received with outputs already populated from server');
    
    const handleExecute = async (cellId: string, code: string) => {
      console.log('[Notebook] Execute cell:', { cellId, code: code.substring(0, 100) });
      
      const { updateCell, setSessionStatus, setErrorMessage } = useNotebookStore.getState();
      
      // Update cell status to running
      updateCell(cellId, { 
        status: 'running',
        error: undefined,
        outputs: undefined,
      });
      
      setSessionStatus('initializing');
      
      try {
        // Call E2B execution API
        const response = await fetch('/api/jupyter/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: metadata.chatId,
            code: code,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Execution failed');
        }
        
        const result = await response.json();
        console.log('[Notebook] Execution result:', {
          success: result.success,
          hasResults: !!result.results,
          resultCount: result.results?.length || 0,
          executionTime: result.executionTime,
          error: result.error
        });
        
        setSessionStatus('ready');
        
        if (result.success) {
          // Process execution results
          const outputs: NotebookOutput[] = [];
          
          if (result.results && Array.isArray(result.results)) {
            console.log('[Notebook] Processing', result.results.length, 'execution results');
            
            for (const execResult of result.results) {
              console.log('[Notebook] Result item:', {
                hasText: !!execResult.text,
                hasPng: !!execResult.png,
                hasError: !!execResult.error,
                textLength: execResult.text?.length || 0
              });
              
              // Text output
              if (execResult.text) {
                outputs.push({
                  type: 'text',
                  content: execResult.text,
                });
              }
              
              // Image output (matplotlib, etc.)
              if (execResult.png) {
                outputs.push({
                  type: 'image',
                  content: execResult.png,
                  mimeType: 'image/png',
                });
              }
              
              // Error output
              if (execResult.error) {
                outputs.push({
                  type: 'error',
                  content: execResult.error.name + ': ' + execResult.error.value + '\n' + execResult.error.traceback,
                });
              }
            }
          } else {
            console.warn('[Notebook] No results array in execution response');
          }
          
          console.log('[Notebook] Total outputs collected:', outputs.length);
          
          // Update cell with results
          const updatedCell = {
            status: 'success' as const,
            outputs: outputs.length > 0 ? outputs : undefined,
            executionTime: result.executionTime,
            executionCount: (useNotebookStore.getState().cells.find(c => c.id === cellId)?.executionCount || 0) + 1,
          };
          
          console.log('[Notebook] Updating cell with:', {
            cellId,
            status: updatedCell.status,
            outputCount: outputs.length,
            executionCount: updatedCell.executionCount
          });
          
          updateCell(cellId, updatedCell);
          
          // Update metadata with session info
          if (result.sandboxId && !metadata.sessionId) {
            setMetadata((prev) => ({
              ...prev,
              sessionId: result.sandboxId,
            }));
          }
          
          // Save notebook state after execution
          const { cells: updatedCells } = useNotebookStore.getState();
          console.log('[Notebook] Saving notebook state with', updatedCells.length, 'cells');
          
          fetch('/api/notebook/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: metadata.chatId,
              documentId: metadata.documentId,
              cells: updatedCells,
            }),
          }).then(res => {
            if (res.ok) {
              console.log('[Notebook] State saved successfully');
            } else {
              console.error('[Notebook] Failed to save state:', res.status);
            }
          }).catch(err => console.error('[Notebook] Failed to save after execution:', err));
          
        } else {
          // Execution failed
          updateCell(cellId, {
            status: 'error',
            error: result.error || 'Unknown execution error',
          });
          setErrorMessage(result.error || 'Execution failed');
        }
      } catch (error) {
        console.error('[Notebook] Execution error:', error);
        setSessionStatus('error');
        updateCell(cellId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to execute code',
        });
        setErrorMessage(error instanceof Error ? error.message : 'Failed to execute code');
      }
    };
    
    return (
      <NotebookArtifactComponent
        content={content}
        isStreaming={status === 'streaming'}
        onExecute={handleExecute}
      />
    );
  },
  actions: [
    {
      icon: <Play size={18} />,
      label: "Run All",
      description: "Execute all cells",
      onClick: async ({ content, metadata, setMetadata }) => {
        console.log('[Notebook] Run all cells individually');
        
        const { cells, setIsExecuting, updateCell, setSessionStatus, setErrorMessage } = useNotebookStore.getState();
        
        if (cells.length === 0) {
          console.warn('[Notebook] No cells to execute');
          return;
        }
        
        setIsExecuting(true);
        setSessionStatus('initializing');
        
        try {
          // Collect all code cells
          const codeCells = cells.filter(cell => cell.type === 'code' && cell.content.trim());
          
          if (codeCells.length === 0) {
            console.warn('[Notebook] No code cells with content');
            setIsExecuting(false);
            return;
          }
          
          // Execute cells one by one to capture individual outputs
          for (let idx = 0; idx < codeCells.length; idx++) {
            const cell = codeCells[idx];
            
            console.log(`[Notebook] Executing cell ${idx + 1}/${codeCells.length}: ${cell.id}`);
            
            // Update cell status to running
            updateCell(cell.id, { 
              status: 'running',
              error: undefined,
              outputs: undefined,
            });
            
            const response = await fetch('/api/jupyter/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatId: metadata.chatId,
                code: cell.content,
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Cell ${idx + 1} execution failed`);
            }
            
            const result = await response.json();
            
            if (result.success) {
              const outputs: NotebookOutput[] = [];
              
              if (result.results) {
                for (const execResult of result.results) {
                  if (execResult.text) {
                    outputs.push({ type: 'text', content: execResult.text });
                  }
                  if (execResult.png) {
                    outputs.push({ type: 'image', content: execResult.png, mimeType: 'image/png' });
                  }
                  if (execResult.error) {
                    outputs.push({
                      type: 'error',
                      content: execResult.error.name + ': ' + execResult.error.value,
                    });
                  }
                }
              }
              
              updateCell(cell.id, {
                status: 'success',
                executionCount: idx + 1,
                outputs: outputs.length > 0 ? outputs : undefined,
                executionTime: result.executionTime,
              });
            } else {
              updateCell(cell.id, {
                status: 'error',
                error: result.error || 'Execution failed',
              });
            }
          }
          
          setSessionStatus('ready');
          console.log('[Notebook] Run all complete');
          
          // Save notebook state to database after execution
          const { cells: updatedCells } = useNotebookStore.getState();
          await fetch('/api/notebook/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: metadata.chatId,
              documentId: metadata.documentId,
              cells: updatedCells,
            }),
          });
          
        } catch (error) {
          console.error('[Notebook] Run all error:', error);
          setSessionStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Failed to execute code');
        } finally {
          setIsExecuting(false);
        }
      },
    },
    {
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
      label: "Download",
      description: "Download as Jupyter Notebook (.ipynb) with outputs",
      onClick: async ({ content, metadata }) => {
        console.log('[Notebook] Downloading as .ipynb with outputs');
        
        const { cells } = useNotebookStore.getState();
        
        // Convert to .ipynb format with proper output formatting
        const notebook = {
          cells: cells.map(cell => {
            const cellData: any = {
              cell_type: cell.type === 'code' ? 'code' : 'markdown',
              metadata: {},
              source: cell.content.split('\n')
            };
            
            if (cell.type === 'code') {
              cellData.execution_count = cell.executionCount || null;
              cellData.outputs = [];
              
              if (cell.outputs && cell.outputs.length > 0) {
                for (const output of cell.outputs) {
                  if (output.type === 'text') {
                    cellData.outputs.push({
                      output_type: 'stream',
                      name: 'stdout',
                      text: output.content.split('\n')
                    });
                  } else if (output.type === 'image') {
                    cellData.outputs.push({
                      output_type: 'display_data',
                      data: {
                        'image/png': output.content
                      },
                      metadata: {}
                    });
                  } else if (output.type === 'error') {
                    const errorLines = output.content.split('\n');
                    cellData.outputs.push({
                      output_type: 'error',
                      ename: 'Error',
                      evalue: errorLines[0] || 'Error',
                      traceback: errorLines
                    });
                  } else if (output.type === 'table') {
                    cellData.outputs.push({
                      output_type: 'stream',
                      name: 'stdout',
                      text: output.content.split('\n')
                    });
                  }
                }
              }
            }
            
            return cellData;
          }),
          metadata: {
            kernelspec: {
              display_name: 'Python 3 (ipykernel)',
              language: 'python',
              name: 'python3'
            },
            language_info: {
              codemirror_mode: {
                name: 'ipython',
                version: 3
              },
              file_extension: '.py',
              mimetype: 'text/x-python',
              name: 'python',
              nbconvert_exporter: 'python',
              pygments_lexer: 'ipython3',
              version: '3.10.0'
            }
          },
          nbformat: 4,
          nbformat_minor: 5
        };
        
        // Create blob and download
        const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/x-ipynb+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data-analysis-${Date.now()}.ipynb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('[Notebook] Download complete with', cells.length, 'cells and outputs');
      },
    },
  ],
  toolbar: [],
});
