import CodeInterpreter from "@e2b/code-interpreter";
import { streamObject } from "ai";
import { z } from "zod";
import { notebookPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

/**
 * E2B CodeInterpreter is a pre-configured sandbox template that includes:
 * - Python 3.11+ runtime
 * - Jupyter kernel for code execution
 * - Pre-installed data science libraries (pandas, numpy, matplotlib, etc.)
 * - Isolated filesystem
 * - Network access (limited)
 *
 * The template is maintained by E2B and includes everything needed for
 * data analysis and code execution without manual setup.
 */

// Helper to extract file info from the sanitized prompt
function extractFileInfoFromPrompt(
  prompt: string
): Array<{ name: string; url: string }> {
  const files: Array<{ name: string; url: string }> = [];

  // Match pattern: [Data file attached: filename.ext (mediaType)]
  // File URL: https://...
  const filePattern =
    /\[Data file attached: (.+?) \(.+?\)\]\s*File URL: (https:\/\/[^\s]+)/g;
  let match;

  while ((match = filePattern.exec(prompt)) !== null) {
    files.push({
      name: match[1],
      url: match[2],
    });
  }

  return files;
}

// Helper to download file from URL
async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// E2B Code Interpreter client with timeout
async function executeCodeWithE2B(
  code: string,
  files?: { name: string; content: Buffer }[]
) {
  console.log("\n  🔐 Checking E2B API key...");
  const apiKey = process.env.E2B_API_KEY;

  if (!apiKey) {
    console.error("  ❌ E2B_API_KEY not found in environment!");
    throw new Error(
      "E2B_API_KEY is not set. Please add it to your .env file. Get your key at https://e2b.dev/"
    );
  }
  console.log("  ✅ E2B API key found:", apiKey.substring(0, 10) + "...");

  console.log("\n  🏗️  Creating E2B CodeInterpreter sandbox...");
  console.log(
    "  - Template: CodeInterpreter (includes Jupyter kernel + data science libs)"
  );
  console.log("  - Timeout: 300000ms (5 minutes)");
  console.log("  - Python Version: 3.11+");
  console.log(
    "  - Pre-installed: pandas, numpy, matplotlib, scipy, scikit-learn, etc."
  );

  const startTime = Date.now();
  const sandbox = await CodeInterpreter.create({
    apiKey,
    timeoutMs: 300_000, // 5 minutes
  });

  const creationTime = Date.now() - startTime;
  console.log(`  ✅ Sandbox created successfully in ${creationTime}ms`);
  console.log(
    `  - Sandbox ID: ${(sandbox as any).sandboxId || (sandbox as any).id || "unknown"}`
  );

  try {
    // Upload files if provided
    if (files && files.length > 0) {
      console.log(`\n  📤 Uploading ${files.length} file(s) to sandbox...`);
      for (const file of files) {
        try {
          console.log(`    → Uploading: ${file.name}`);
          // Write file to sandbox filesystem (convert Buffer to ArrayBuffer)
          const arrayBuffer = file.content.buffer.slice(
            file.content.byteOffset,
            file.content.byteOffset + file.content.byteLength
          ) as ArrayBuffer;

          const uploadStart = Date.now();
          await sandbox.files.write(file.name, arrayBuffer);
          const uploadTime = Date.now() - uploadStart;

          console.log(`    ✅ Uploaded: ${file.name} in ${uploadTime}ms`);
        } catch (uploadError) {
          console.error(`    ❌ Failed to upload ${file.name}:`, uploadError);
          throw new Error(`Failed to upload file ${file.name} to sandbox`);
        }
      }
    } else {
      console.log("\n  ℹ️  No files to upload");
    }

    // Execute the code
    console.log("\n  ▶️  Executing Python code in sandbox...");
    console.log(`  - Code length: ${code.length} characters`);
    console.log(`  - Code preview: ${code.substring(0, 100)}...`);

    const execStart = Date.now();
    const execution = await sandbox.runCode(code, {
      onStderr: (msg: any) => {
        console.log("    [stderr]:", msg);
      },
      onStdout: (msg: any) => {
        console.log("    [stdout]:", msg);
      },
    });
    const execTime = Date.now() - execStart;

    console.log(`\n  ✅ Execution completed in ${execTime}ms`);

    console.log("\n  📋 Execution Summary:");
    console.log(`    - Success: ${!execution.error}`);
    console.log(
      `    - Error: ${execution.error ? `${execution.error.name}: ${execution.error.value}` : "None"}`
    );
    console.log(`    - Stdout lines: ${execution.logs.stdout.length}`);
    console.log(`    - Stderr lines: ${execution.logs.stderr.length}`);
    console.log(`    - Results: ${execution.results.length}`);

    return {
      success: !execution.error,
      error: execution.error
        ? `${execution.error.name}: ${execution.error.value}`
        : undefined,
      logs: execution.logs,
      results: execution.results,
    };
  } finally {
    console.log("\n  🧹 Cleaning up sandbox...");
    await sandbox.kill();
    console.log("  ✅ Sandbox terminated");
  }
}

export const notebookDocumentHandler = createDocumentHandler<"notebook">({
  kind: "notebook",
  onCreateDocument: async ({ title, dataStream, messages }) => {
    console.log("\n" + "=".repeat(80));
    console.log("🚀 NOTEBOOK CREATION STARTED");
    console.log("=".repeat(80));

    let generatedCode = "";

    // STEP 1: Extract last user message (contains file URLs from sanitizer)
    console.log("\n🔍 DEBUG: Checking messages parameter");
    console.log("  - messages defined?", !!messages);
    console.log("  - messages length:", messages?.length || 0);

    const lastUserMessage = messages?.findLast((m) => m.role === "user");
    console.log("  - lastUserMessage found?", !!lastUserMessage);
    console.log(
      "  - lastUserMessage parts:",
      lastUserMessage?.parts.length || 0
    );

    if (lastUserMessage?.parts) {
      lastUserMessage.parts.forEach((part, i) => {
        console.log(
          `  - Part ${i}: type=${part.type}, preview=${part.type === "text" ? (part as any).text.substring(0, 100) : "N/A"}`
        );
      });
    }

    const userPrompt =
      lastUserMessage?.parts
        .filter(
          (part): part is { type: "text"; text: string } => part.type === "text"
        )
        .map((part) => part.text)
        .join("\n") || title;

    console.log("\n📝 STEP 1: USER PROMPT RECEIVED");
    console.log("Full prompt:", userPrompt);
    console.log("-".repeat(80));

    // Extract file information from the sanitized prompt (contains file URLs)
    const fileInfos = extractFileInfoFromPrompt(userPrompt);
    console.log("\n📂 STEP 2: FILE EXTRACTION");
    console.log(`Found ${fileInfos.length} file(s) in prompt`);

    // Log file details
    if (fileInfos.length > 0) {
      fileInfos.forEach((fileInfo, index) => {
        console.log(`  File ${index + 1}:`);
        console.log(`    - Name: ${fileInfo.name}`);
        console.log(`    - URL: ${fileInfo.url}`);
        console.log(
          `    - Type: ${fileInfo.name.split(".").pop()?.toUpperCase() || "UNKNOWN"}`
        );
      });
    } else {
      console.log("  ⚠️  No files found in prompt");
    }

    // Download files if any exist
    console.log("\n⬇️  STEP 3: DOWNLOADING FILES");
    const files: Array<{ name: string; content: Buffer }> = [];
    for (const fileInfo of fileInfos) {
      try {
        console.log(`  → Downloading: ${fileInfo.name}`);
        console.log(`    From: ${fileInfo.url.substring(0, 50)}...`);
        const content = await downloadFile(fileInfo.url);
        files.push({ name: fileInfo.name, content });
        console.log(
          `  ✅ Downloaded: ${fileInfo.name} (${(content.length / 1024).toFixed(2)} KB)`
        );
      } catch (error) {
        console.error(`  ❌ Failed to download ${fileInfo.name}:`, error);
        // Continue anyway - Claude will generate code, just won't have the file
      }
    }

    if (files.length === 0 && fileInfos.length > 0) {
      console.log(
        "  ⚠️  WARNING: Files were found but none downloaded successfully"
      );
    }

    // Update prompt to tell Claude the files are READY and give analysis instructions
    let enhancedPrompt = userPrompt; // Use full user prompt with file URLs
    if (files.length > 0) {
      const fileList = files.map((f) => `'${f.name}'`).join(", ");
      enhancedPrompt = `${userPrompt}

CRITICAL EXECUTION REQUIREMENTS:
- The data file(s) ${fileList} are ALREADY UPLOADED and READY in the current directory
- Filename to use: '${files[0].name}'
- Generate ONE complete code block that does EVERYTHING the user asked for
- DO NOT stop after just exploring columns - complete the ENTIRE task
- DO NOT generate incomplete code - finish the analysis and visualization
- Your code must produce the FINAL RESULTS the user requested
- If user asks for counts: print the actual counts
- If user asks for plot: create AND save the plot
- Complete the task fully in one execution`;
    }

    console.log("\n🤖 STEP 4: CLAUDE CODE GENERATION");
    console.log("System Prompt Length:", notebookPrompt.length, "characters");
    console.log(
      "System Prompt Preview:",
      notebookPrompt.substring(0, 200) + "..."
    );
    console.log("-".repeat(80));
    console.log(
      "Enhanced User Prompt:",
      enhancedPrompt.substring(0, 300) + "..."
    );
    console.log("-".repeat(80));
    console.log("Generating Python code...");

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: notebookPrompt,
      prompt: enhancedPrompt,
      schema: z.object({
        code: z
          .string()
          .describe(
            "Executable Python code without markdown formatting or backticks"
          ),
      }),
    });

    // Stream the generated code
    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: "data-notebookDelta",
            data: code ?? "",
            transient: true,
          });

          generatedCode = code;
        }
      }
    }

    console.log("\n✅ Code generation complete!");
    console.log("Generated Code Length:", generatedCode.length, "characters");
    console.log("-".repeat(80));
    console.log("📄 GENERATED PYTHON CODE:");
    console.log("-".repeat(80));
    console.log(generatedCode);
    console.log("-".repeat(80));

    // Execute the code with E2B (passing downloaded files)
    console.log("\n🔧 STEP 5: E2B SANDBOX EXECUTION");
    console.log("Files to upload:", files.length);
    if (files.length > 0) {
      files.forEach((f, i) =>
        console.log(
          `  ${i + 1}. ${f.name} (${(f.content.length / 1024).toFixed(2)} KB)`
        )
      );
    }

    try {
      console.log("Creating E2B sandbox...");
      const result = await executeCodeWithE2B(
        generatedCode,
        files.length > 0 ? files : undefined
      );

      console.log("\n📊 STEP 6: EXECUTION RESULTS");
      console.log("Success:", result.success);
      console.log("Error:", result.error || "None");
      console.log("Stdout lines:", result.logs.stdout.length);
      console.log("Stderr lines:", result.logs.stderr.length);
      console.log("Results count:", result.results.length);

      if (result.logs.stdout.length > 0) {
        console.log("\n📤 STDOUT OUTPUT:");
        console.log("-".repeat(80));
        result.logs.stdout.forEach((line, i) =>
          console.log(`[${i + 1}]`, line)
        );
        console.log("-".repeat(80));
      }

      if (result.logs.stderr.length > 0) {
        console.log("\n⚠️  STDERR OUTPUT:");
        console.log("-".repeat(80));
        result.logs.stderr.forEach((line, i) =>
          console.log(`[${i + 1}]`, line)
        );
        console.log("-".repeat(80));
      }

      if (result.results.length > 0) {
        console.log("\n🎨 RESULTS:");
        result.results.forEach((r, i) => {
          console.log(`Result ${i + 1}:`, Object.keys(r).join(", "));
        });
      }

      // Send execution results
      dataStream.write({
        type: "data-notebookExecution",
        data: {
          success: result.success,
          error: result.error,
          logs: result.logs,
          results: result.results,
        },
        transient: false,
      });

      console.log("\n✅ NOTEBOOK CREATION COMPLETED SUCCESSFULLY");
      console.log("=".repeat(80) + "\n");
    } catch (error) {
      console.error("\n❌ E2B EXECUTION ERROR:");
      console.error(
        "Error type:",
        error instanceof Error ? error.constructor.name : typeof error
      );
      console.error(
        "Error message:",
        error instanceof Error ? error.message : String(error)
      );
      console.error("Full error:", error);
      dataStream.write({
        type: "data-notebookExecution",
        data: {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown execution error",
          logs: { stdout: [], stderr: [] },
          results: [],
        },
        transient: false,
      });
    }

    // Return content and file URLs for saving
    return {
      content: generatedCode,
      fileUrls: fileInfos.length > 0 ? fileInfos : undefined,
    };
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let updatedCode = "";

    // Use stored file URLs from document (saved during creation)
    const storedFileUrls = (document as any).fileUrls as Array<{
      name: string;
      url: string;
    }> | null;
    console.log(
      `[Notebook Update] Document has ${storedFileUrls?.length || 0} stored file(s)`
    );

    // Download stored files
    const files: Array<{ name: string; content: Buffer }> = [];
    if (storedFileUrls && storedFileUrls.length > 0) {
      for (const fileInfo of storedFileUrls) {
        try {
          console.log(`[Notebook Update] Re-downloading: ${fileInfo.name}`);
          const content = await downloadFile(fileInfo.url);
          files.push({ name: fileInfo.name, content });
          console.log(
            `[Notebook Update] ✅ Downloaded: ${fileInfo.name} (${(content.length / 1024).toFixed(2)} KB)`
          );
        } catch (error) {
          console.error(
            `[Notebook Update] ❌ Failed to download ${fileInfo.name}:`,
            error
          );
        }
      }
    }

    // Update prompt to tell Claude the filenames that are available
    let enhancedDescription = description;
    if (files.length > 0) {
      const fileList = files.map((f) => f.name).join(", ");
      enhancedDescription = `${description}\n\nNote: The following data files are available in the sandbox: ${fileList}`;
    }

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: updateDocumentPrompt(document.content, "notebook"),
      prompt: enhancedDescription,
      schema: z.object({
        code: z
          .string()
          .describe(
            "Executable Python code without markdown formatting or backticks"
          ),
      }),
    });

    // Stream the updated code
    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: "data-notebookDelta",
            data: code ?? "",
            transient: true,
          });

          updatedCode = code;
        }
      }
    }

    // Execute the updated code with E2B (passing downloaded files)
    try {
      const result = await executeCodeWithE2B(
        updatedCode,
        files.length > 0 ? files : undefined
      );

      dataStream.write({
        type: "data-notebookExecution",
        data: {
          success: result.success,
          error: result.error,
          logs: result.logs,
          results: result.results,
        },
        transient: false,
      });
    } catch (error) {
      console.error("E2B execution error:", error);
      dataStream.write({
        type: "data-notebookExecution",
        data: {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown execution error",
          logs: { stdout: [], stderr: [] },
          results: [],
        },
        transient: false,
      });
    }

    return updatedCode;
  },
});
