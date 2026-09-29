export const aiConfig = {
  model: "gemini-3.8-flash",
  effort: "LOW",
  maxTokens: 4096,
  outputSchema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["urgent", "stop", "human", "answer", "question", "other"],
      },
      answer: { type: ["string", "number", "null"] },
      reply: { type: ["string", "null"] },
    },
    required: ["intent", "answer", "reply"],
    additionalProperties: false,
  },
};
