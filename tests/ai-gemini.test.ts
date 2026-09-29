import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { aiConfig as config } from "../integrations/ai/gemini/config.ts";

type Json = Record<string, unknown>;
type Workflow = {
  id: string;
  nodes: {
    name: string;
    type: string;
    parameters: Json;
    credentials?: unknown;
  }[];
  settings: Json;
  connections: Record<string, { main: { node: string }[][] }>;
};
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const workflow = JSON.parse(
  read("../integrations/ai/gemini/workflow.json"),
) as Workflow;
const instructions = read("../integrations/ai/anthropic/instructions.md")
  .replaceAll("\r\n", "\n")
  .trim();
const fixture = () => ({
  ...JSON.parse(read("./fixtures/ai/input.json")),
  dataMode: "synthetic",
});
function node(name: string) {
  const found = workflow.nodes.find((node) => node.name === name);
  if (!found) throw new Error(`Nó não encontrado: ${name}`);
  return found;
}
function run(
  name: string,
  values: unknown[],
  previous: Json[] = [],
  prevName = "Call Gemini",
) {
  const logs: string[] = [];
  const fn = new Function(
    "$input",
    "$",
    "$prevNode",
    "console",
    String(node(name).parameters.jsCode),
  );
  const items = fn(
    { all: () => values.map((json) => ({ json })) },
    () => ({ itemMatching: (index: number) => ({ json: previous[index] }) }),
    { name: prevName },
    { log: (value: string) => logs.push(value) },
  ) as { json: Json; pairedItem: { item: number } }[];
  return { items: items.map((item) => item.json), logs };
}
const prepare = (input: unknown = fixture()) =>
  run("Prepare request", [input]).items[0];
const output = (overrides: Json = {}) => ({
  intent: "answer",
  answer: "cleaning",
  reply: "Ficamos na Rua Exemplo, 100, Cidade Fictícia.",
  ...overrides,
});
const envelope = (result: unknown = output(), overrides: Json = {}) => ({
  statusCode: 200,
  body: {
    candidates: [
      {
        finishReason: "STOP",
        content: { role: "model", parts: [{ text: JSON.stringify(result) }] },
      },
    ],
    ...overrides,
  },
});
function classify(response: unknown, input = fixture(), retry = false) {
  return run(
    "Classify",
    [response],
    [prepare(input)],
    retry ? "Call Gemini (retry)" : "Call Gemini",
  ).items[0];
}

describe("request", () => {
  test("uses the canonical instructions, model and fixed structured schema", () => {
    const request = prepare();
    expect(request.valid).toBe(true);
    expect(request.body).toEqual({
      systemInstruction: {
        parts: [
          { text: instructions },
          { text: JSON.stringify({ business: fixture().business }) },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify({
                question: fixture().question,
                message: fixture().message,
              }),
            },
          ],
        },
      ],
      generationConfig: {
        candidateCount: 1,
        maxOutputTokens: config.maxTokens,
        thinkingConfig: { thinkingLevel: config.effort },
        responseMimeType: "application/json",
        responseJsonSchema: config.outputSchema,
      },
    });
  });
  test("does not send identity, history or caller overrides to the provider", () => {
    const input = fixture();
    input.phone = input.lead = input.history = "DADO_FICTICIO_PRIVADO";
    input.business.extra = input.question.extra = "DADO_FICTICIO_PRIVADO";
    input.question.options[0].extra = "DADO_FICTICIO_PRIVADO";
    input.business.knowledge[0].extra = "DADO_FICTICIO_PRIVADO";
    input.model = input.url = input.instructions = "TENTATIVA_DE_OVERRIDE";
    const body = JSON.stringify(prepare(input).body);
    expect(body).not.toContain("DADO_FICTICIO_PRIVADO");
    expect(body).not.toContain("TENTATIVA_DE_OVERRIDE");
    expect(body).not.toContain(input.clientId);
  });
  test("keeps the fixed prefix and schema stable across questions and messages", () => {
    const input = fixture();
    input.question = null;
    input.message = "Outro pedido";
    const first = prepare().body as Json;
    const second = prepare(input).body as Json;
    expect(second.systemInstruction).toEqual(first.systemInstruction);
    expect(second.generationConfig).toEqual(first.generationConfig);
    expect(second.contents).not.toEqual(first.contents);
    input.business.name = "Outro negócio fictício";
    expect((prepare(input).body as Json).systemInstruction).not.toEqual(
      first.systemInstruction,
    );
  });
  test.each([
    ["action", "book"],
    ["clientId", "nome com espaços"],
    ["business", null],
    ["message", " \n"],
    ["message", 123],
    ["message", "a".repeat(8001)],
    ["question", undefined],
    ["question", { id: "q", text: "Texto", type: "date" }],
    ["question", { id: "q", text: " ", type: "text" }],
    ["question", { id: "q", text: "Texto", type: "number", options: [] }],
    ["business", { name: " ", knowledge: [] }],
    ["business", { name: "Negócio", knowledge: [{ topic: "t", text: " " }] }],
    [
      "business",
      { name: "Negócio", knowledge: [{ topic: "t", text: "a".repeat(6000) }] },
    ],
  ])("rejects invalid %s", (field, value) => {
    expect(prepare({ ...fixture(), [String(field)]: value })).toMatchObject({
      valid: false,
      result: { ok: false, error: { code: "invalid_input", retryable: false } },
    });
  });
  test.each([null, [], 2])("rejects non-object input %s", (input) => {
    expect(prepare(input).valid).toBe(false);
  });
  test.each([
    [],
    [
      { id: "x", label: "X" },
      { id: "x", label: "Outro" },
    ],
    [{ id: "x", label: "a".repeat(21) }],
    Array.from({ length: 11 }, (_, i) => ({ id: `${i}`, label: "X" })),
  ])("rejects invalid options %j", (options) => {
    const input = fixture();
    input.question.options = options;
    expect(prepare(input).valid).toBe(false);
  });
});

describe("response", () => {
  test("accepts an answer and grounded reply without returning the provider envelope", () => {
    expect(classify(envelope()).result).toEqual({ ok: true, ...output() });
  });
  test("ignores thought parts before the final JSON", () => {
    expect(
      classify(
        envelope(null, {
          candidates: [
            {
              finishReason: "STOP",
              content: {
                role: "model",
                parts: [
                  { thought: true, text: "raciocínio fictício" },
                  { text: JSON.stringify(output()) },
                ],
              },
            },
          ],
        }),
      ).result,
    ).toEqual({ ok: true, ...output() });
  });
  test.each(["urgent", "stop"])(
    "discards generated answer and reply for %s",
    (intent) => {
      expect(classify(envelope(output({ intent }))).result).toEqual({
        ok: true,
        intent,
        answer: null,
        reply: null,
      });
    },
  );
  test("does not lose urgency because unused answer or reply is invalid", () => {
    expect(
      classify(
        envelope(
          output({
            intent: "urgent",
            answer: "unknown-option",
            reply: "a".repeat(401),
          }),
        ),
      ).result,
    ).toEqual({ ok: true, intent: "urgent", answer: null, reply: null });
  });
  test.each([
    { intent: "unknown" },
    { answer: "not-an-option" },
    { answer: "Limpeza" },
    { answer: 1 },
    { answer: null },
    { answer: {} },
    { extra: true },
    { reply: "a".repeat(401) },
    { reply: " " },
    { reply: false },
    { intent: "question", reply: null },
    { intent: "other" },
  ])("rejects invalid structured output %j", (bad) => {
    expect(classify(envelope(output(bad))).result).toEqual({
      ok: false,
      error: { code: "invalid_output", retryable: false },
    });
  });
  test("counts reply characters rather than UTF-16 code units", () => {
    expect(
      classify(envelope(output({ reply: "😀".repeat(400) }))).result,
    ).toMatchObject({ ok: true });
    expect(
      classify(envelope(output({ reply: "😀".repeat(401) }))).result,
    ).toMatchObject({ ok: false });
  });
  test.each([
    "MAX_TOKENS",
    "OTHER",
    "MALFORMED_FUNCTION_CALL",
    "UNEXPECTED_TOOL_CALL",
    undefined,
  ])("rejects incomplete or unexpected stop %s", (finishReason) => {
    expect(
      classify(
        envelope(null, {
          candidates: [
            {
              finishReason,
              content: {
                role: "model",
                parts: [{ text: JSON.stringify(output()) }],
              },
            },
          ],
        }),
      ).result,
    ).toMatchObject({ ok: false, error: { code: "invalid_output" } });
  });
  test.each([
    "SAFETY",
    "RECITATION",
    "BLOCKLIST",
    "PROHIBITED_CONTENT",
    "SPII",
  ])("handles blocked output %s", (finishReason) => {
    expect(
      classify(envelope(null, { candidates: [{ finishReason }] })).result,
    ).toMatchObject({
      ok: false,
      error: { code: "refusal", retryable: false },
    });
  });
  test("handles blocked input without candidates", () => {
    expect(
      classify({
        statusCode: 200,
        body: { promptFeedback: { blockReason: "SAFETY" } },
      }).result,
    ).toMatchObject({ ok: false, error: { code: "refusal" } });
  });
  test.each([
    [],
    null,
    [{ text: "{not-json" }],
    [{ text: "{}" }, { text: "{}" }],
    [{ functionCall: { name: "unsafe" } }],
    [{ text: "null" }],
    [{ text: '{"intent":"answer","answer":"cleaning"}' }],
    [{ text: "{}", thought: "false" }],
  ])("rejects malformed parts %j", (parts) => {
    expect(
      classify(
        envelope(null, {
          candidates: [
            { finishReason: "STOP", content: { role: "model", parts } },
          ],
        }),
      ).result,
    ).toMatchObject({ ok: false, error: { code: "invalid_output" } });
  });
  test.each([[], null, [{}, {}], [null]])(
    "rejects invalid candidates %j",
    (candidates) => {
      expect(classify(envelope(null, { candidates })).result).toMatchObject({
        ok: false,
        error: { code: "invalid_output" },
      });
    },
  );
  test.each([undefined, false, "real", true])(
    "requires explicit synthetic-data mode %s",
    (dataMode) => {
      expect(prepare({ ...fixture(), dataMode })).toMatchObject({
        valid: false,
        result: { error: { code: "invalid_input", field: "dataMode" } },
      });
    },
  );
  test.each([
    ["number", 2, true],
    ["number", "2", false],
    ["text", "Indicação", true],
    ["text", 2, false],
    ["text", " ", false],
    ["text", "a".repeat(1001), false],
  ])("validates %s answer %s", (type, answer, accepted) => {
    const input = fixture();
    input.question = { id: "q", text: "Pergunta fictícia", type };
    expect(
      classify(envelope(output({ answer, reply: null })), input).result,
    ).toMatchObject({ ok: accepted });
  });
  test("accepts a question without a pending answer but rejects an invented answer", () => {
    const input = fixture();
    input.question = null;
    expect(
      classify(envelope(output({ intent: "question", answer: null })), input)
        .result,
    ).toMatchObject({ ok: true });
    expect(classify(envelope(), input).result).toMatchObject({ ok: false });
  });
});

describe("failures and privacy", () => {
  test.each([408, 429, 500, 503, 529])("retries HTTP %s once", (statusCode) => {
    expect(classify({ statusCode }).retry).toBe(true);
    expect(classify({ statusCode }, fixture(), true)).toMatchObject({
      retry: false,
      result: { ok: false, error: { code: "unavailable", retryable: true } },
    });
  });
  test.each([
    [400, "provider_error"],
    [401, "auth"],
    [403, "auth"],
    [404, "provider_error"],
  ])("does not retry HTTP %s", (statusCode, code) => {
    expect(classify({ statusCode })).toMatchObject({
      retry: false,
      result: { ok: false, error: { code, retryable: false } },
    });
  });
  test("handles timeout and missing credentials without echoing errors", () => {
    expect(classify({ error: { message: "Timeout DADO_PRIVADO" } }).retry).toBe(
      true,
    );
    expect(
      classify({ error: "Credentials missing DADO_PRIVADO" }).result,
    ).toEqual({
      ok: false,
      error: { code: "auth", retryable: false },
    });
  });
  test("emits only sanitized results and metrics", () => {
    const state = classify(envelope());
    const completed = run("Result", [state]);
    expect(completed.items).toEqual([{ ok: true, ...output() }]);
    expect(JSON.parse(completed.logs[0])).toEqual({
      event: "ai_interpret",
      clientId: fixture().clientId,
      durationMs: expect.any(Number),
      intent: "answer",
    });
    const failed = run("Result", [
      prepare({ ...fixture(), clientId: "DADO PRIVADO" }),
    ]);
    expect(failed.logs.join()).not.toContain("DADO PRIVADO");
    expect(JSON.parse(failed.logs[0])).toMatchObject({
      clientId: null,
      code: "invalid_input",
    });
  });
  test("keeps endpoint, authentication, retries and execution privacy fixed", () => {
    for (const name of ["Call Gemini", "Call Gemini (retry)"]) {
      expect(node(name).parameters).toMatchObject({
        method: "POST",
        url: `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
        authentication: "predefinedCredentialType",
        nodeCredentialType: "googlePalmApi",
        options: { timeout: 45000 },
      });
      expect(node(name).credentials).toBeUndefined();
    }
    expect(workflow.settings).toMatchObject({
      saveDataErrorExecution: "none",
      saveDataSuccessExecution: "none",
      saveManualExecutions: false,
      saveExecutionProgress: false,
    });
    expect(workflow.connections["Needs retry"].main[0][0].node).toBe("Wait");
    expect(workflow.connections.Wait.main[0][0].node).toBe(
      "Call Gemini (retry)",
    );
  });
});
