export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Claude Sonnet 4",
    description: "Anthropic's smart model for complex agents and coding tasks",
  },
  {
    id: "chat-model-reasoning",
    name: "Claude Sonnet 4 (Reasoning)",
    description:
      "Adds structured reasoning traces for complex, multi-step problems",
  },
];
