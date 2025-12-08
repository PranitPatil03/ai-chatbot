import { toast } from "sonner";
import { CodeEditor } from "@/components/code-editor";
import {
  Console,
  type ConsoleOutput,
  type ConsoleOutputContent,
} from "@/components/console";
import { Artifact } from "@/components/create-artifact";
import {
  CopyIcon,
  LogsIcon,
  MessageIcon,
  PlayIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/icons";
import type { NotebookExecution } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { useState } from "react";

type Metadata = {
  consoleOutputs: ConsoleOutput[];
  execution?: NotebookExecution;
  isExecuting: boolean;
};

export const notebookArtifact = new Artifact<"notebook", Metadata>({
  kind: "notebook",
  description:
    "Useful for data analysis and code execution with Python. Runs code in a sandboxed environment with data science libraries (pandas, numpy, matplotlib, etc.)",
  initialize: ({ setMetadata }) => {
    setMetadata({
      consoleOutputs: [],
      isExecuting: false,
    });
  },
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === "data-notebookDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible:
          draftArtifact.status === "streaming" &&
          draftArtifact.content.length > 300 &&
          draftArtifact.content.length < 310
            ? true
            : draftArtifact.isVisible,
        status: "streaming",
      }));
      
      setMetadata((draft) => ({
        ...draft,
        isExecuting: true,
      }));
    }

    if (streamPart.type === "data-notebookExecution") {
      setMetadata((draft) => {
        const execution = streamPart.data as NotebookExecution;
        const contents: ConsoleOutputContent[] = [];

        // Add stdout logs
        if (execution.logs.stdout.length > 0) {
          execution.logs.stdout.forEach((log) => {
            contents.push({
              type: "text",
              value: log,
            });
          });
        }

        // Add stderr logs as text
        if (execution.logs.stderr.length > 0) {
          execution.logs.stderr.forEach((log) => {
            contents.push({
              type: "text",
              value: `[stderr] ${log}`,
            });
          });
        }

        // Add error if present
        if (execution.error) {
          contents.push({
            type: "text",
            value: `❌ Error: ${execution.error}`,
          });
        }

        // Add results (images, text, etc.)
        if (execution.results.length > 0) {
          execution.results.forEach((result) => {
            if (result.text) {
              contents.push({
                type: "text",
                value: result.text,
              });
            }
            
            if (result.png) {
              contents.push({
                type: "image",
                value: `data:image/png;base64,${result.png}`,
              });
            }
          });
        }

        const newOutput: ConsoleOutput = {
          id: crypto.randomUUID(),
          status: execution.success ? "completed" : "failed",
          contents,
        };

        return {
          ...draft,
          consoleOutputs: [...draft.consoleOutputs, newOutput],
          execution,
          isExecuting: false,
        };
      });
    }
  },
  content: ({ metadata, setMetadata, ...props }) => {
    const [consoleOutputs, setConsoleOutputs] = useState<ConsoleOutput[]>(
      metadata?.consoleOutputs || []
    );

    return (
      <>
        <div className="px-1">
          <CodeEditor {...props} />
        </div>

        {metadata?.consoleOutputs && metadata.consoleOutputs.length > 0 && (
          <div className="h-full border-t dark:border-zinc-700">
            <Console
              consoleOutputs={metadata.consoleOutputs}
              setConsoleOutputs={(outputs) => {
                setMetadata((draft) => ({
                  ...draft,
                  consoleOutputs: typeof outputs === "function" ? outputs(draft.consoleOutputs) : outputs,
                }));
              }}
            />
          </div>
        )}
      </>
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        return currentVersionIndex === 0;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        return isCurrentVersion;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy code to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: "Request changes to code",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Please modify this code based on my feedback",
            },
          ],
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: "Add detailed logging",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add detailed print statements to show intermediate results",
            },
          ],
        });
      },
    },
  ],
});
