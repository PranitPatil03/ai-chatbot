/**
 * Jupyter Kernel Gateway Client
 * 
 * This module handles communication with Jupyter Kernel Gateway
 * to execute Python code and retrieve outputs.
 */

import axios, { type AxiosInstance } from 'axios';

export interface KernelInfo {
  id: string;
  name: string;
  last_activity: string;
  execution_state: 'idle' | 'busy' | 'starting';
  connections: number;
}

export interface ExecutionResult {
  success: boolean;
  outputs: CellOutput[];
  error?: {
    name: string;
    message: string;
    traceback: string[];
  };
}

export interface CellOutput {
  output_type: 'stream' | 'display_data' | 'execute_result' | 'error';
  text?: string;
  data?: Record<string, any>;
  name?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

export interface WebSocketMessage {
  header: {
    msg_id: string;
    msg_type: string;
  };
  parent_header: Record<string, any>;
  metadata: Record<string, any>;
  content: any;
}

export class JupyterClient {
  private baseUrl: string;
  private authToken: string;
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authToken = authToken;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `token ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 second timeout
    });
  }

  /**
   * List all available kernels
   */
  async listKernels(): Promise<KernelInfo[]> {
    try {
      const response = await this.axiosInstance.get('/api/kernels');
      return response.data;
    } catch (error) {
      console.error('Error listing kernels:', error);
      throw new Error('Failed to list kernels');
    }
  }

  /**
   * Start a new kernel
   */
  async startKernel(kernelName = 'python3'): Promise<KernelInfo> {
    try {
      const response = await this.axiosInstance.post('/api/kernels', {
        name: kernelName,
      });
      return response.data;
    } catch (error) {
      console.error('Error starting kernel:', error);
      throw new Error('Failed to start kernel');
    }
  }

  /**
   * Get kernel info by ID
   */
  async getKernel(kernelId: string): Promise<KernelInfo> {
    try {
      const response = await this.axiosInstance.get(`/api/kernels/${kernelId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting kernel:', error);
      throw new Error('Failed to get kernel info');
    }
  }

  /**
   * Delete/shutdown a kernel
   */
  async deleteKernel(kernelId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/api/kernels/${kernelId}`);
    } catch (error) {
      console.error('Error deleting kernel:', error);
      throw new Error('Failed to delete kernel');
    }
  }

  /**
   * Execute code in a kernel
   * 
   * This is a simplified synchronous execution method.
   */
  async executeCode(
    kernelId: string,
    code: string,
    timeout = 30000
  ): Promise<ExecutionResult> {
    try {
      // Execute request to our simple server
      const execResponse = await this.axiosInstance.post(
        `/api/execute`,
        {
          code,
        },
        {
          timeout,
        }
      );

      return execResponse.data;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          outputs: [],
          error: {
            name: 'TimeoutError',
            message: 'Code execution timed out',
            traceback: ['Execution exceeded the maximum allowed time'],
          },
        };
      }

      console.error('Error executing code:', error);
      return {
        success: false,
        outputs: [],
        error: {
          name: 'ExecutionError',
          message: error.message || 'Failed to execute code',
          traceback: [error.stack || ''],
        },
      };
    }
  }

  /**
   * Interrupt kernel execution
   */
  async interruptKernel(kernelId: string): Promise<void> {
    try {
      await this.axiosInstance.post(`/api/kernels/${kernelId}/interrupt`);
    } catch (error) {
      console.error('Error interrupting kernel:', error);
      throw new Error('Failed to interrupt kernel');
    }
  }

  /**
   * Restart kernel
   */
  async restartKernel(kernelId: string): Promise<KernelInfo> {
    try {
      const response = await this.axiosInstance.post(
        `/api/kernels/${kernelId}/restart`
      );
      return response.data;
    } catch (error) {
      console.error('Error restarting kernel:', error);
      throw new Error('Failed to restart kernel');
    }
  }

  /**
   * Get or create a kernel for a session
   * Reuses existing idle kernel if available
   */
  async getOrCreateKernel(sessionId?: string): Promise<KernelInfo> {
    try {
      const kernels = await this.listKernels();
      
      // Find an idle kernel
      const idleKernel = kernels.find(k => k.execution_state === 'idle');
      
      if (idleKernel) {
        console.log('Reusing existing kernel:', idleKernel.id);
        return idleKernel;
      }

      // No idle kernel found, start a new one
      console.log('Starting new kernel');
      return await this.startKernel();
    } catch (error) {
      console.error('Error getting or creating kernel:', error);
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
let jupyterClient: JupyterClient | null = null;

export function getJupyterClient(): JupyterClient {
  if (!jupyterClient) {
    const baseUrl = process.env.JUPYTER_KERNEL_GATEWAY_URL || 'http://localhost:8888';
    const authToken = process.env.JUPYTER_AUTH_TOKEN || 'dummy-token'; // Not used by our simple server

    jupyterClient = new JupyterClient(baseUrl, authToken);
  }

  return jupyterClient;
}
