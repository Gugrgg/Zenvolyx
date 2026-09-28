export const aiConfig = {
  model: "claude-opus-5-5",
  effort: "low",
  maxTokens: 2000,
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
