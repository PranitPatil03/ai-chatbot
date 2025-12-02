export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Gemini 2.5 Pro",
    description: "Latest Google Pro model optimized for multimodal depth",
  },
  {
    id: "chat-model-reasoning",
    name: "Gemini 2.5 Pro (Reasoning)",
    description:
      "Adds structured reasoning traces for complex, multi-step problems",
  },
];
