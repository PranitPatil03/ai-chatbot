import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";

type ExecuteNotebookProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

/**
 * AI Tool: Execute Python code in Jupyter notebook
 * 
 * This tool allows the LLM to execute Python code in a Jupyter environment
 * and return the results to the user.
 */
export const executeNotebook = ({ session, dataStream }: ExecuteNotebookProps) =>
  tool({
    description: `Execute Python code in a Jupyter notebook environment. Use this tool to:
- Perform data analysis with pandas, numpy
- Create visualizations with matplotlib, seaborn, plotly
- Run machine learning models
- Process and transform data
- Generate statistical reports

The code will be executed in an isolated Python environment with common data science libraries pre-installed.`,
    
    inputSchema: z.object({
      code: z.string().describe("The Python code to execute"),
      title: z.string().describe("A short descriptive title for this code execution"),
      context: z.string().optional().describe("Additional context or data that the code needs"),
    }),
    
    execute: async ({ code, title, context }) => {
      try {
        // Stream the title and code to the UI
        dataStream.write({
          type: "data-kind",
          data: "code",
          transient: true,
        });

        dataStream.write({
          type: "data-title",
          data: title,
          transient: true,
        });

        dataStream.write({
          type: "data-codeDelta",
          data: code,
          transient: true,
        });

        // Execute the code via our API
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jupyter/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            code,
            context, // Can be used to inject data into the notebook
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          
          dataStream.write({
            type: "data-textDelta",
            data: `Error: ${error.error?.message || 'Failed to execute code'}`,
            transient: true,
          });

          return {
            success: false,
            error: error.error?.message || 'Failed to execute code',
          };
        }

        const result = await response.json();

        // Stream the outputs back to the UI
        if (result.outputs && result.outputs.length > 0) {
          for (const output of result.outputs) {
            // Stream each output as text for now (can be enhanced later)
            if (output.output_type === 'stream' && output.text) {
              dataStream.write({
                type: "data-textDelta",
                data: output.text,
                transient: true,
              });
            } else if ((output.output_type === 'execute_result' || output.output_type === 'display_data') && output.data) {
              // For now, just indicate there's output
              dataStream.write({
                type: "data-textDelta",
                data: '\n[Output displayed]\n',
                transient: true,
              });
            }
          }
        }

        // If there was an error during execution
        if (result.error) {
          dataStream.write({
            type: "data-textDelta",
            data: `\nError: ${result.error.message || 'Execution failed'}\n${result.error.traceback ? result.error.traceback.join('\n') : ''}`,
            transient: true,
          });
        }

        // Return summary to the LLM
        if (result.success) {
          const outputSummary = result.outputs
            .map((out: any) => {
              if (out.output_type === 'stream') {
                return out.text;
              } else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
                return '[Output displayed to user]';
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');

          return {
            success: true,
            message: `Code executed successfully. ${outputSummary}`,
            outputs: result.outputs.length,
          };
        } else {
          return {
            success: false,
            error: result.error?.message || 'Execution failed',
          };
        }

      } catch (error: any) {
        console.error('Error in executeNotebook tool:', error);
        
        dataStream.write({
          type: "data-textDelta",
          data: `\nError: ${error.message || 'Failed to execute notebook'}\n`,
          transient: true,
        });

        return {
          success: false,
          error: error.message || 'Failed to execute notebook',
        };
      }
    },
  });
