import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

type WorkflowNode = {
  name: string;
  onError?: string;
  parameters: Record<string, unknown>;
  credentials?: unknown;
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
    new URL("../integrations/crm/router/workflow.json", import.meta.url),
    "utf8",
  ),
) as Workflow;

function fixture(name: string): Json {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/crm/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as Json;
}

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
  context: { prevNode?: string; validated?: Json[] } = {},
): Promise<{ output: Json[]; logs: string[] }> {
  const logs: string[] = [];
  const jsCode = node(name).parameters.jsCode as string;
  const $input = { all: () => inputs.map((json) => ({ json })) };
  const $ = (target: string) => {
    if (target !== "Validate lead") {
      throw new Error(`Nó inesperado: ${target}`);
    }
    return {
      itemMatching: (index: number) => ({ json: context.validated?.[index] }),
    };
  };
  const $prevNode = { name: context.prevNode ?? "Call provider" };
  const console = { log: (line: string) => logs.push(line) };
  const run = new AsyncFunction("$input", "$", "$prevNode", "console", jsCode);
  const output = (await run($input, $, $prevNode, console)) as {
    json: Json;
  }[];
  return { output: output.map((item) => item.json), logs };
}

const input = fixture("upsert-new-lead");
const lead = input.lead as Json;

async function validate(value: Json) {
  return runCode("Validate lead", [value]);
}

describe("workflow", () => {
  test("keeps a callable ID, published state and the retry loop", () => {
    const first = node("Call provider");
    const retry = node("Call provider (retry)");

    expect(workflow.id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(workflow.active).toBe(true);
    expect(workflow.nodes.every((item) => item.credentials === undefined)).toBe(
      true,
    );
    expect(
      node("When Executed by Another Workflow").parameters.inputSource,
    ).toBe("passthrough");
    expect(first.parameters).toEqual(retry.parameters);
    expect(first.parameters).toMatchObject({
      mode: "each",
      workflowId: { value: "={{ $json.providerWorkflowId }}", mode: "id" },
    });
    expect([first.onError, retry.onError]).toEqual([
      "continueRegularOutput",
      "continueRegularOutput",
    ]);
    expect(node("Wait").parameters).toMatchObject({
      amount: 2,
      unit: "seconds",
    });
    expect(next("Validate lead")).toBe("Is valid");
    expect([next("Is valid", 0), next("Is valid", 1)]).toEqual([
      "Call provider",
      "Result",
    ]);
    expect(next("Call provider")).toBe("Classify");
    expect(next("Classify")).toBe("Needs retry");
    expect([next("Needs retry", 0), next("Needs retry", 1)]).toEqual([
      "Wait",
      "Result",
    ]);
    expect(next("Wait")).toBe("Call provider (retry)");
    expect(next("Call provider (retry)")).toBe("Classify");
  });
});

describe("Validate lead", () => {
  test("routes a valid lead to the Google Sheets connector", async () => {
    expect(await validate(input)).toEqual({
      output: [
        { ...input, valid: true, providerWorkflowId: "crmGoogleSheets1" },
      ],
      logs: [],
    });
  });

  test.each([
    "talking",
    "qualified",
    "not_qualified",
    "scheduled",
    "with_team",
    "urgent",
    "stopped",
  ])("accepts the %s stage", async (stage) => {
    const { output } = await validate({ ...input, lead: { ...lead, stage } });

    expect(output[0].valid).toBe(true);
  });

  test("accepts answers and an appointment with or without service", async () => {
    const scheduled = fixture("upsert-scheduled");
    const noService = structuredClone(scheduled);
    ((noService.lead as Json).appointment as Json).service = null;

    for (const value of [scheduled, noService]) {
      expect((await validate(value)).output[0].valid).toBe(true);
    }
  });

  const withLead = (changes: Json) => ({
    ...input,
    lead: { ...lead, ...changes },
  });

  test.each([
    ["action", { ...input, action: "getLead" }],
    ["clientId", { ...input, clientId: " " }],
    ["timezone", { ...input, timezone: "Brasil/Leste" }],
    ["timezone", { ...input, timezone: "-03:00" }],
    ["crm", { ...input, crm: { provider: "google-sheets" } }],
    ["lead", { ...input, lead: null }],
    ["lead.id", withLead({ id: "" })],
    ["lead.phone", withLead({ phone: "+55 00 0000-0000" })],
    ["lead.phone", withLead({ phone: undefined })],
    ["lead.name", withLead({ name: undefined })],
    ["lead.channel", withLead({ channel: "" })],
    ["lead.stage", withLead({ stage: "perdido" })],
    ["lead.answers", withLead({ answers: "Implante" })],
    [
      "lead.answers",
      withLead({ answers: [{ question: "Idade", answer: 30 }] }),
    ],
    [
      "lead.answers",
      withLead({
        answers: Array.from({ length: 31 }, () => ({
          question: "Pergunta",
          answer: "Resposta",
        })),
      }),
    ],
    ["lead.appointment", withLead({ appointment: undefined })],
    [
      "lead.appointment",
      withLead({
        appointment: { start: "amanhã", end: "2026-09-28T13:40:00Z" },
      }),
    ],
    ["lead.firstContactAt", withLead({ firstContactAt: "25/09/2026 09:00" })],
    ["lead.lastContactAt", withLead({ lastContactAt: "2026-09-25" })],
    [
      "crm.settings.spreadsheetId",
      {
        ...input,
        crm: { provider: "google-sheets", settings: { spreadsheetId: "a/b" } },
      },
    ],
    [
      "crm.settings.spreadsheetId",
      { ...input, crm: { provider: "google-sheets", settings: {} } },
    ],
  ])(
    "rejects an invalid %s before calling a connector",
    async (field, value) => {
      const received = (value as Json).clientId;
      const clientId =
        typeof received === "string" && received.trim() !== ""
          ? received
          : null;

      expect(await validate(value as Json)).toEqual({
        output: [
          {
            valid: false,
            result: {
              ok: false,
              error: { code: "invalid_input", retryable: false, field },
            },
          },
        ],
        logs: [JSON.stringify({ event: "crm_invalid_input", clientId, field })],
      });
    },
  );

  test("answers unknown_provider for a CRM without connector", async () => {
    expect(await validate(fixture("upsert-unknown-provider"))).toEqual({
      output: [
        {
          valid: false,
          result: {
            ok: false,
            error: { code: "unknown_provider", retryable: false },
          },
        },
      ],
      logs: ['{"event":"crm_unknown_provider","clientId":"odontologia-demo"}'],
    });
  });
});

describe("Classify", () => {
  const validated = {
    ...input,
    valid: true,
    providerWorkflowId: "crmGoogleSheets1",
  };
  const final = (result: Json) => ({ retry: false, result });
  const failure = (code: string, retryable: boolean) =>
    final({ ok: false, error: { code, retryable } });

  async function classify(response: Json, prevNode?: string) {
    return runCode("Classify", [response], {
      prevNode,
      validated: [validated],
    });
  }

  test("passes success through without logs", async () => {
    expect(await classify({ ok: true })).toEqual({
      output: [final({ ok: true })],
      logs: [],
    });
  });

  test("passes a connector failure through and logs its code", async () => {
    expect(
      await classify({
        ok: false,
        error: { code: "forbidden", retryable: false },
      }),
    ).toEqual({
      output: [failure("forbidden", false)],
      logs: [
        '{"event":"crm_upsert_failed","clientId":"odontologia-demo","code":"forbidden"}',
      ],
    });
  });

  test("retries a temporary failure once, then gives up", async () => {
    const temporary = {
      ok: false,
      error: { code: "rate_limited", retryable: true },
    };

    expect((await classify(temporary)).output).toEqual([
      { ...validated, retry: true },
    ]);
    expect((await classify(temporary, "Call provider (retry)")).output).toEqual(
      [failure("rate_limited", true)],
    );
  });

  test("maps failures to call the connector", async () => {
    expect(
      (
        await classify({
          error: "Workflow is not active and cannot be executed.",
        })
      ).output,
    ).toEqual([failure("no_provider", false)]);
    expect(
      (await classify({ error: { message: "Workflow does not exist." } }))
        .output,
    ).toEqual([failure("no_provider", false)]);
    expect(
      (await classify({ error: "falha simulada" }, "Call provider (retry)"))
        .output,
    ).toEqual([failure("unavailable", true)]);
    expect((await classify({})).output).toEqual([
      failure("provider_error", false),
    ]);
  });
});

test("Result returns only the contract output", async () => {
  expect(
    (await runCode("Result", [{ retry: false, result: { ok: true } }])).output,
  ).toEqual([{ ok: true }]);
});
