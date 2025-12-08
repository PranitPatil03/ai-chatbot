import { anthropic } from "@ai-sdk/anthropic";
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
          model: anthropic("claude-sonnet-4-20250514"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": anthropic("claude-haiku-4-5-20251001"),
        "artifact-model": anthropic("claude-haiku-4-5-20251001"),
      },
    });
