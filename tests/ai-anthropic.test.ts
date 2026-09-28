import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { aiConfig as config } from "../integrations/ai/anthropic/config.ts";

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
  read("../integrations/ai/anthropic/workflow.json"),
) as Workflow;
const instructions = read("../integrations/ai/anthropic/instructions.md")
  .replaceAll("\r\n", "\n")
  .trim();
const fixture = () => JSON.parse(read("./fixtures/ai/input.json"));
function node(name: string) {
  const found = workflow.nodes.find((node) => node.name === name);
  if (!found) throw new Error(`Nó não encontrado: ${name}`);
  return found;
}
function run(
  name: string,
  values: unknown[],
  previous: Json[] = [],
  prevName = "Call Anthropic",
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
    type: "message",
    role: "assistant",
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(result) }],
    ...overrides,
  },
});
function classify(response: unknown, input = fixture(), retry = false) {
  return run(
    "Classify",
    [response],
    [prepare(input)],
    retry ? "Call Anthropic (retry)" : "Call Anthropic",
  ).items[0];
}

describe("request", () => {
  test("uses the canonical instructions, model and fixed structured schema", () => {
    const request = prepare();
    expect(request.valid).toBe(true);
    expect(request.body).toEqual({
      model: config.model,
      max_tokens: config.maxTokens,
      output_config: {
        effort: config.effort,
        format: { type: "json_schema", schema: config.outputSchema },
      },
      system: [
        { type: "text", text: instructions },
        {
          type: "text",
          text: JSON.stringify({ business: fixture().business }),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            question: fixture().question,
            message: fixture().message,
          }),
        },
      ],
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
  test("keeps the cached prefix and schema stable across questions and messages", () => {
    const input = fixture();
    input.question = null;
    input.message = "Outro pedido";
    const first = prepare().body as Json;
    const second = prepare(input).body as Json;
    expect(second.system).toEqual(first.system);
    expect(second.output_config).toEqual(first.output_config);
    expect(second.messages).not.toEqual(first.messages);
    input.business.name = "Outro negócio fictício";
    expect((prepare(input).body as Json).system).not.toEqual(first.system);
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
  test("selects text after a thinking block", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "ficticia" },
      { type: "text", text: JSON.stringify(output()) },
    ];
    expect(classify(envelope(null, { content })).result).toEqual({
      ok: true,
      ...output(),
    });
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
    "max_tokens",
    "tool_use",
    "pause_turn",
    "model_context_window_exceeded",
  ])(
    "rejects stop_reason %s even when the text contains valid JSON",
    (stop_reason) => {
      expect(
        classify(envelope(output(), { stop_reason })).result,
      ).toMatchObject({
        ok: false,
        error: { code: "invalid_output", retryable: false },
      });
    },
  );
  test("handles a refusal before parsing the content", () => {
    expect(
      classify(envelope(null, { stop_reason: "refusal", content: [] })).result,
    ).toEqual({
      ok: false,
      error: { code: "refusal", retryable: false },
    });
  });
  test.each([
    [],
    null,
    [{ type: "text", text: "{not-json" }],
    [
      { type: "text", text: "{}" },
      { type: "text", text: "{}" },
    ],
    [{ type: "tool_use", id: "ficticio" }],
    [{ type: "text", text: "null" }],
    [{ type: "text", text: '{"intent":"answer","answer":"cleaning"}' }],
  ])("rejects malformed content %j", (content) => {
    expect(classify(envelope(null, { content })).result).toMatchObject({
      ok: false,
      error: { code: "invalid_output" },
    });
  });
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
    for (const name of ["Call Anthropic", "Call Anthropic (retry)"]) {
      expect(node(name).parameters).toMatchObject({
        method: "POST",
        url: "https://api.anthropic.com/v1/messages",
        authentication: "predefinedCredentialType",
        nodeCredentialType: "anthropicApi",
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
      "Call Anthropic (retry)",
    );
  });
});
