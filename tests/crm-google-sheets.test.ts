import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

type WorkflowNode = {
  name: string;
  type: string;
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
    new URL("../integrations/crm/google-sheets/workflow.json", import.meta.url),
    "utf8",
  ),
) as Workflow;

const SHEETS =
  "https://sheets.googleapis.com/v4/spreadsheets/planilha-ficticia/values/";
const HEADER = [
  "Nome",
  "Telefone",
  "Etapa",
  "Respostas",
  "Agendamento",
  "Canal",
  "Primeiro contato",
  "Último contato",
  "ID do lead",
];
const LEAD = "BR.0000000000000000019";
const PHONE = "5500000000019";

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
  prepared: Json[] = [],
): Promise<Json[]> {
  const jsCode = node(name).parameters.jsCode as string;
  const $input = { all: () => inputs.map((json) => ({ json })) };
  const $ = (target: string) => {
    if (target !== "Prepare row") {
      throw new Error(`Nó inesperado: ${target}`);
    }
    return { itemMatching: (index: number) => ({ json: prepared[index] }) };
  };
  const run = new AsyncFunction("$input", "$", jsCode);
  const output = (await run($input, $)) as { json: Json }[];
  return output.map((item) => item.json);
}

async function prepare(value: Json): Promise<Json> {
  const [prepared] = await runCode("Prepare row", [value]);
  return prepared;
}

describe("workflow", () => {
  test("keeps a callable ID, published state and no credential in the export", () => {
    expect(workflow.id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(workflow.active).toBe(true);
    expect(workflow.nodes.every((item) => item.credentials === undefined)).toBe(
      true,
    );
    expect(
      node("When Executed by Another Workflow").parameters.inputSource,
    ).toBe("passthrough");
  });

  test("calls the Sheets API with the service account and classifies every answer", () => {
    for (const name of ["Read sheet", "Write row"]) {
      const http = node(name);
      expect(http.type).toBe("n8n-nodes-base.httpRequest");
      expect(http.onError).toBe("continueRegularOutput");
      expect(http.parameters).toMatchObject({
        authentication: "predefinedCredentialType",
        nodeCredentialType: "googleApi",
        options: {
          response: { response: { fullResponse: true, neverError: true } },
          timeout: 15000,
        },
      });
    }
    expect(node("Read sheet").parameters.url).toBe("={{ $json.readUrl }}");
    expect(node("Write row").parameters).toMatchObject({
      method: "={{ $json.method }}",
      url: "={{ $json.url }}",
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify($json.body) }}",
    });
  });

  test("keeps the Google address fixed in the code", () => {
    for (const name of ["Prepare row", "Plan write"]) {
      expect(node(name).parameters.jsCode).toContain(
        "const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets/';",
      );
    }
  });

  test("reads, plans, writes when needed and always ends in Result", () => {
    expect(next("When Executed by Another Workflow")).toBe("Prepare row");
    expect(next("Prepare row")).toBe("Read sheet");
    expect(next("Read sheet")).toBe("Plan write");
    expect(next("Plan write")).toBe("Should write");
    expect([next("Should write", 0), next("Should write", 1)]).toEqual([
      "Write row",
      "Result",
    ]);
    expect(next("Write row")).toBe("Result");
  });
});

describe("Prepare row", () => {
  test("formats a new lead in the client's time zone", async () => {
    expect(await prepare(fixture("upsert-new-lead"))).toEqual({
      spreadsheetId: "planilha-ficticia",
      readUrl: `${SHEETS}Leads!A%3AI`,
      leadId: LEAD,
      phone: PHONE,
      row: [
        "Paciente Fictícia",
        PHONE,
        "Em conversa",
        "",
        "",
        "WhatsApp",
        "25/09/2026 09:00",
        "25/09/2026 09:00",
        LEAD,
      ],
    });
  });

  test("writes answers one per line and the appointment with the service", async () => {
    const { row } = await prepare(fixture("upsert-scheduled"));

    expect(row).toEqual([
      "Paciente Fictícia",
      PHONE,
      "Agendado",
      "Qual tratamento você procura?: Implante\nÉ a sua primeira consulta com a gente?: Sim, primeira vez",
      "28/09/2026 10:00 (Implante)",
      "WhatsApp",
      "25/09/2026 09:00",
      "25/09/2026 09:05",
      LEAD,
    ]);
  });

  test("leaves blank cells for a missing name, phone or service", async () => {
    const scheduled = fixture("upsert-scheduled");
    const lead = scheduled.lead as Json;
    const { row, phone } = await prepare({
      ...scheduled,
      timezone: "America/Manaus",
      lead: {
        ...lead,
        name: null,
        phone: null,
        channel: "formulario",
        appointment: { ...(lead.appointment as Json), service: null },
      },
    });

    expect(phone).toBeNull();
    expect((row as string[]).slice(0, 2)).toEqual(["", ""]);
    expect((row as string[])[4]).toBe("28/09/2026 09:00");
    expect((row as string[])[5]).toBe("formulario");
  });

  test.each([
    ["talking", "Em conversa"],
    ["qualified", "Qualificado"],
    ["not_qualified", "Não qualificado"],
    ["scheduled", "Agendado"],
    ["with_team", "Com a equipe"],
    ["urgent", "Urgência"],
    ["stopped", "Pediu para parar"],
  ])("labels the %s stage in Portuguese", async (stage, label) => {
    const input = fixture("upsert-new-lead");
    const { row } = await prepare({
      ...input,
      lead: { ...(input.lead as Json), stage },
    });

    expect((row as string[])[2]).toBe(label);
  });
});

const newLead = await prepare(fixture("upsert-new-lead"));

describe("Plan write", () => {
  const row = (id: string, phone = "") => [
    "Alguém",
    phone,
    "Em conversa",
    "",
    "",
    "WhatsApp",
    "20/09/2026 10:00",
    "20/09/2026 10:00",
    id,
  ];

  async function plan(values: unknown[][] | undefined, override: Json = {}) {
    const response = {
      statusCode: 200,
      body: values === undefined ? { range: "Leads!A1:I1000" } : { values },
    };
    const [result] = await runCode(
      "Plan write",
      [response],
      [{ ...newLead, ...override }],
    );
    return result;
  }

  test("creates the header and the row on an empty sheet", async () => {
    const result = await plan(undefined);

    expect(result).toEqual({
      write: true,
      method: "POST",
      url: `${SHEETS}Leads!A%3AI:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      body: { majorDimension: "ROWS", values: [HEADER, newLead.row] },
    });
  });

  test("appends a new lead below the rows already there", async () => {
    const result = await plan([
      HEADER,
      row("BR.0000000000000000023", "5500000000023"),
    ]);

    expect(result).toMatchObject({
      method: "POST",
      body: { values: [newLead.row] },
    });
  });

  test("updates the row with the same lead ID", async () => {
    const result = await plan([
      HEADER,
      row("BR.0000000000000000023", PHONE),
      row(LEAD),
    ]);

    expect(result).toEqual({
      write: true,
      method: "PUT",
      url: `${SHEETS}Leads!A3%3AI3?valueInputOption=RAW`,
      body: {
        range: "Leads!A3:I3",
        majorDimension: "ROWS",
        values: [newLead.row],
      },
    });
  });

  test("finds a lead who changed number by the phone and writes the new ID there", async () => {
    const result = await plan([
      HEADER,
      row("BR.0000000000000000023", "5500000000023"),
      row("BR.0000000000000000099", PHONE),
    ]);

    expect(result).toMatchObject({
      method: "PUT",
      body: { range: "Leads!A3:I3", values: [newLead.row] },
    });
    expect(((result.body as Json).values as string[][])[0][8]).toBe(LEAD);
  });

  test("does not search by phone without one, and reads short rows and sheets without header", async () => {
    expect(
      await plan([HEADER, row("BR.0000000000000000099", "")], { phone: null }),
    ).toMatchObject({ method: "POST" });
    expect(await plan([["Só nome"], row(LEAD)])).toMatchObject({
      method: "PUT",
      body: { range: "Leads!A2:I2" },
    });
    expect(await plan([row(` ${LEAD} `)])).toMatchObject({
      method: "PUT",
      body: { range: "Leads!A1:I1" },
    });
  });

  test("does not write when the read failed", async () => {
    const responses = [
      { statusCode: 403, body: { error: { message: "denied" } } },
      { error: { message: "timeout" } },
    ];

    for (const response of responses) {
      expect(await runCode("Plan write", [response], [newLead])).toEqual([
        { write: false, response },
      ]);
    }
  });
});

describe("Result", () => {
  const failure = (code: string, retryable: boolean) => ({
    ok: false,
    error: { code, retryable },
  });

  async function result(response: Json, write = true) {
    const [output] = await runCode("Result", [
      write ? response : { write: false, response },
    ]);
    return output;
  }

  test("returns ok after the write", async () => {
    expect(await result({ statusCode: 200, body: {} })).toEqual({ ok: true });
  });

  test.each([
    [401, "", "auth", false],
    [403, "The caller does not have permission", "forbidden", false],
    [404, "Requested entity was not found.", "not_found", false],
    [400, "Unable to parse range: Leads!A:I", "not_found", false],
    [400, "Invalid values", "provider_error", false],
    [429, "Quota exceeded", "rate_limited", true],
    [500, "Internal error", "unavailable", true],
    [503, "", "unavailable", true],
  ])(
    "maps HTTP %i (%s) to %s",
    async (statusCode, message, code, retryable) => {
      const response = { statusCode, body: { error: { message } } };

      expect(await result(response, false)).toEqual(failure(code, retryable));
      expect(await result(response)).toEqual(failure(code, retryable));
    },
  );

  test("maps a rejected service account to auth and network trouble to unavailable", async () => {
    const googleRejected = {
      error: {
        message: "Bad request - please check your parameters",
        context: { data: { error: "invalid_grant" } },
      },
    };
    const badKey = {
      error: {
        message:
          "secretOrPrivateKey must be an asymmetric key when using RS256",
      },
    };

    expect(await result(googleRejected)).toEqual(failure("auth", false));
    expect(await result(badKey)).toEqual(failure("auth", false));
    expect(await result({ error: "socket hang up" })).toEqual(
      failure("unavailable", true),
    );
  });
});

test("the CSV template has the columns the connector writes, in order", () => {
  const template = readFileSync(
    new URL(
      "../integrations/crm/google-sheets/leads-template.csv",
      import.meta.url,
    ),
    "utf8",
  );

  expect(template.trim().split(",")).toEqual(HEADER);
});
