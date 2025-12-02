import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

export const defaultModel = anthropic("claude-sonnet-4-20250514");

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": anthropic("claude-sonnet-4-20250514"),
        "chat-model-reasoning": wrapLanguageModel({
          model: anthropic("claude-3-5-sonnet-20241022"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": anthropic("claude-3-5-haiku-20241022"),
        "artifact-model": google("gemini-2.0-flash-exp"),
      },
    });
