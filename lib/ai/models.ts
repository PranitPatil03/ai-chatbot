export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Gemini Pro",
    description: "Google Pro model optimized for multimodal depth",
  },
  {
    id: "chat-model-reasoning",
    name: "Gemini Pro (Reasoning)",
    description:
      "Adds structured reasoning traces for complex, multi-step problems",
  },
];
