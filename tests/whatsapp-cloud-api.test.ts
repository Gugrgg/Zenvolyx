import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

type WorkflowNode = {
  name: string;
  onError?: string;
  parameters: Record<string, unknown>;
};

type Workflow = {
  id: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<string, { main: { node: string }[][] }>;
};

type Json = Record<string, unknown>;
type CodeRunner = (...args: unknown[]) => Promise<unknown>;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => CodeRunner;

const workflow = JSON.parse(
  readFileSync(
    new URL(
      "../integrations/whatsapp/cloud-api/workflow.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Workflow;

const base = {
  clientId: "cliente-ficticio",
  gatewayWorkflowId: "waGatewayFicti01",
  phoneNumberId: "000000000018001",
  leadId: "BR.0000000000000000001",
};

function node(name: string): WorkflowNode {
  const found = workflow.nodes.find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`Nó ausente: ${name}`);
  }
  return found;
}

function next(from: string, output = 0): string {
  return workflow.connections[from].main[output][0].node;
}

async function runCode(
  name: string,
  inputs: Json[],
  context: { prevNode?: string; built?: Json[] } = {},
): Promise<Json[]> {
  const jsCode = node(name).parameters.jsCode as string;
  const $input = { all: () => inputs.map((json) => ({ json })) };
  const $ = (target: string) => {
    if (target !== "Build request") {
      throw new Error(`Nó inesperado: ${target}`);
    }
    return {
      itemMatching: (index: number) => ({ json: context.built?.[index] }),
    };
  };
  const $prevNode = { name: context.prevNode ?? "Call gateway" };
  const run = new AsyncFunction("$input", "$", "$prevNode", jsCode);
  const output = (await run($input, $, $prevNode)) as { json: Json }[];
  return output.map((item) => item.json);
}

async function build(input: Json): Promise<Json> {
  const [result] = await runCode("Build request", [input]);
  return result;
}

async function classify(response: Json, prevNode?: string): Promise<Json> {
  const built = { valid: true, ...base, method: "POST", path: "/1/messages" };
  const [result] = await runCode("Classify", [response], {
    prevNode,
    built: [built],
  });
  return result;
}

describe("workflow", () => {
  test("keeps a callable ID, published state and the retry loop", () => {
    const first = node("Call gateway");
    const retry = node("Call gateway (retry)");

    expect(workflow.id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(workflow.active).toBe(true);
    expect(
      node("When Executed by Another Workflow").parameters.inputSource,
    ).toBe("passthrough");
    expect(first.parameters).toEqual(retry.parameters);
    expect(first.parameters).toMatchObject({
      mode: "each",
      workflowId: { value: "={{ $json.gatewayWorkflowId }}", mode: "id" },
    });
    expect([first.onError, retry.onError]).toEqual([
      "continueRegularOutput",
      "continueRegularOutput",
    ]);
    expect(node("Wait").parameters).toMatchObject({
      amount: 2,
      unit: "seconds",
    });
    expect(next("Build request")).toBe("Is valid");
    expect([next("Is valid", 0), next("Is valid", 1)]).toEqual([
      "Call gateway",
      "Result",
    ]);
    expect(next("Call gateway")).toBe("Classify");
    expect(next("Classify")).toBe("Needs retry");
    expect([next("Needs retry", 0), next("Needs retry", 1)]).toEqual([
      "Wait",
      "Result",
    ]);
    expect(next("Wait")).toBe("Call gateway (retry)");
    expect(next("Call gateway (retry)")).toBe("Classify");
  });
});

describe("Build request", () => {
  const request = { method: "POST", path: "/000000000018001/messages" };
  const recipient = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    recipient: base.leadId,
  };

  test("sends text to the lead's BSUID", async () => {
    expect(
      await build({ ...base, action: "sendText", text: "Mensagem fictícia" }),
    ).toEqual({
      valid: true,
      clientId: base.clientId,
      gatewayWorkflowId: base.gatewayWorkflowId,
      ...request,
      body: {
        ...recipient,
        type: "text",
        text: { body: "Mensagem fictícia", preview_url: false },
      },
    });
  });

  test("builds reply buttons and lists", async () => {
    const buttons = await build({
      ...base,
      action: "sendButtons",
      text: "Qual atendimento?",
      options: [{ id: "evaluation", label: "Avaliação" }],
    });
    const list = await build({
      ...base,
      action: "sendList",
      text: "Escolha um horário",
      listButton: "Ver horários",
      options: [{ id: "slot-1", label: "Segunda 28/09 às 09:00" }],
    });

    expect(buttons.body).toEqual({
      ...recipient,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Qual atendimento?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "evaluation", title: "Avaliação" } },
          ],
        },
      },
    });
    expect(list.body).toEqual({
      ...recipient,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "Escolha um horário" },
        action: {
          button: "Ver horários",
          sections: [
            { rows: [{ id: "slot-1", title: "Segunda 28/09 às 09:00" }] },
          ],
        },
      },
    });
  });

  test("builds templates with and without parameters", async () => {
    const withParameters = await build({
      ...base,
      action: "sendTemplate",
      template: {
        name: "lembrete",
        language: "pt_BR",
        parameters: ["Ana", 10],
      },
    });
    const plain = await build({
      ...base,
      action: "sendTemplate",
      template: { name: "lembrete", language: "pt_BR" },
    });

    expect(withParameters.body).toEqual({
      ...recipient,
      type: "template",
      template: {
        name: "lembrete",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ana" },
              { type: "text", text: "10" },
            ],
          },
        ],
      },
    });
    expect(plain.body).toEqual({
      ...recipient,
      type: "template",
      template: { name: "lembrete", language: { code: "pt_BR" } },
    });
  });

  test("marks as read and shows the typing indicator", async () => {
    const { leadId: _leadId, ...withoutLead } = base;

    expect(
      await build({
        ...withoutLead,
        action: "markRead",
        messageId: "wamid.ficticio",
      }),
    ).toMatchObject({
      ...request,
      body: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: "wamid.ficticio",
        typing_indicator: { type: "text" },
      },
    });
  });

  const options = (count: number, label = "Opção") =>
    Array.from({ length: count }, (_, index) => ({ id: `o${index}`, label }));

  test.each([
    ["action", { ...base, action: "sendAudio", text: "x" }],
    ["clientId", { ...base, clientId: " ", action: "sendText", text: "x" }],
    [
      "gatewayWorkflowId",
      {
        ...base,
        gatewayWorkflowId: "porta-com-hifen",
        action: "sendText",
        text: "x",
      },
    ],
    [
      "phoneNumberId",
      { ...base, phoneNumberId: "1/../2", action: "sendText", text: "x" },
    ],
    ["leadId", { ...base, leadId: undefined, action: "sendText", text: "x" }],
    ["text", { ...base, action: "sendText", text: "x".repeat(4097) }],
    ["text", { ...base, action: "sendButtons", text: "", options: options(1) }],
    [
      "options",
      { ...base, action: "sendButtons", text: "x", options: options(4) },
    ],
    [
      "options",
      {
        ...base,
        action: "sendButtons",
        text: "x",
        options: options(1, "x".repeat(21)),
      },
    ],
    [
      "options",
      {
        ...base,
        action: "sendButtons",
        text: "x",
        options: [
          { id: "a", label: "A" },
          { id: "a", label: "B" },
        ],
      },
    ],
    [
      "options",
      {
        ...base,
        action: "sendList",
        text: "x",
        listButton: "Ver",
        options: options(11),
      },
    ],
    [
      "options",
      {
        ...base,
        action: "sendList",
        text: "x",
        listButton: "Ver",
        options: options(1, "x".repeat(25)),
      },
    ],
    [
      "listButton",
      { ...base, action: "sendList", text: "x", options: options(2) },
    ],
    [
      "template",
      { ...base, action: "sendTemplate", template: { name: "lembrete" } },
    ],
    [
      "template",
      {
        ...base,
        action: "sendTemplate",
        template: { name: "lembrete", language: "pt_BR", parameters: [{}] },
      },
    ],
    ["messageId", { ...base, action: "markRead" }],
  ])(
    "rejects an invalid %s before calling the gateway",
    async (field, input) => {
      expect(await build(input)).toEqual({
        valid: false,
        result: {
          ok: false,
          error: { code: "invalid_input", retryable: false, field },
        },
      });
    },
  );
});

describe("Classify", () => {
  const final = (result: Json) => ({ retry: false, result });
  const failure = (
    code: string,
    retryable: boolean,
    metaCode: number | null = null,
  ) => final({ ok: false, error: { code, retryable, metaCode } });

  test("returns the message ID or a plain success", async () => {
    expect(
      await classify({
        status: 200,
        body: { messages: [{ id: "wamid.ficticio" }] },
      }),
    ).toEqual(final({ ok: true, messageId: "wamid.ficticio" }));
    expect(await classify({ status: 200, body: { success: true } })).toEqual(
      final({ ok: true }),
    );
  });

  test.each([
    ["auth", 401, 190],
    ["auth", 400, 190],
    ["outside_window", 400, 131047],
    ["undeliverable", 400, 131026],
    ["meta_error", 400, 100],
  ])(
    "maps %s without retrying (status %i, code %i)",
    async (code, status, metaCode) => {
      expect(
        await classify({ status, body: { error: { code: metaCode } } }),
      ).toEqual(failure(code, false, metaCode));
    },
  );

  test.each([
    ["rate_limited", 429, 130429],
    ["rate_limited", 400, 80007],
    ["unavailable", 503, null],
  ])("retries %s once, then gives up", async (code, status, metaCode) => {
    const response = {
      status,
      body: metaCode === null ? {} : { error: { code: metaCode } },
    };

    expect(await classify(response)).toEqual({
      valid: true,
      ...base,
      method: "POST",
      path: "/1/messages",
      retry: true,
    });
    expect(await classify(response, "Call gateway (retry)")).toEqual(
      failure(code, true, metaCode),
    );
  });

  test("maps gateway problems", async () => {
    expect(
      await classify({ status: 0, body: null, rejected: "invalid_path" }),
    ).toEqual(failure("invalid_request", false));
    expect(
      await classify({
        error: "Workflow is not active and cannot be executed.",
      }),
    ).toEqual(failure("no_gateway", false));
    expect(
      await classify({ error: { message: "Workflow does not exist." } }),
    ).toEqual(failure("no_gateway", false));
    expect(
      await classify({ error: "falha simulada" }, "Call gateway (retry)"),
    ).toEqual(failure("unavailable", true));
  });
});

test("Result returns only the contract output", async () => {
  expect(
    await runCode("Result", [
      { retry: false, result: { ok: true, messageId: "wamid.ficticio" } },
    ]),
  ).toEqual([{ ok: true, messageId: "wamid.ficticio" }]);
});

test("the example payload in fixtures follows the contract", async () => {
  const example = JSON.parse(
    readFileSync(
      new URL("./fixtures/whatsapp/connector-send-text.json", import.meta.url),
      "utf8",
    ),
  ) as Json;

  expect(await build(example)).toMatchObject({
    valid: true,
    path: "/000000000018001/messages",
    body: { type: "text", recipient: "BR.0000000000000000001" },
  });
});
