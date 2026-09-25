import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

type WorkflowNode = {
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: unknown;
  executeOnce?: boolean;
  alwaysOutputData?: boolean;
};

type Workflow = {
  id: string;
  name: string;
  active: boolean;
  settings: Record<string, unknown>;
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
    new URL("../automations/whatsapp-inbound/workflow.json", import.meta.url),
    "utf8",
  ),
) as Workflow;

const SECRET = "segredo-ficticio-de-teste";
const PROCESSED = "whatsapp_processed_messages";
const PAUSES = "whatsapp_lead_pauses";
const BUFFER = "whatsapp_message_buffer";
const LEAD = "BR.0000000000000000019";
const PHONE = "5500000000019";
const CLIENT = "odontologia-demo";

function node(name: string): WorkflowNode {
  const found = workflow.nodes.find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`Nó ausente: ${name}`);
  }
  return found;
}

function targets(from: string, output = 0): string[] {
  return workflow.connections[from].main[output].map(
    (connection) => connection.node,
  );
}

function above(first: string, second: string): boolean {
  return node(first).position[1] < node(second).position[1];
}

function fixture<T = Json>(name: string): T {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/whatsapp/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as T;
}

// Roda o código de um nó Code deste JSON; `nodes` simula a saída de outros nós ($('Nó')).
async function runCode(
  name: string,
  inputs: Json[],
  nodes: Record<string, Json[]> = {},
): Promise<{ output: Json[]; logs: string[] }> {
  const logs: string[] = [];
  const jsCode = node(name).parameters.jsCode as string;
  const $input = { all: () => inputs.map((json) => ({ json })) };
  const $ = (target: string) => {
    const items = nodes[target];
    if (items === undefined) {
      throw new Error(`Nó inesperado: ${target}`);
    }
    return {
      all: () => items.map((json) => ({ json })),
      itemMatching: (index: number) => ({ json: items[index] }),
    };
  };
  const console = { log: (line: string) => logs.push(line) };
  const run = new AsyncFunction("$input", "$", "console", jsCode);
  const output = (await run($input, $, console)) as { json: Json }[];
  return { output: output.map((item) => item.json), logs };
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

// O que o nó "Compute signature" entrega: o corpo já lido e o HMAC calculado sobre os bytes brutos.
function signedRequest(body: Json, headerSecret = SECRET): Json {
  const raw = JSON.stringify(body);
  return {
    headers: { "x-hub-signature-256": `sha256=${hmac(headerSecret, raw)}` },
    body,
    computedSignature: hmac(SECRET, raw),
  };
}

async function parse(body: Json): Promise<{ output: Json[]; logs: string[] }> {
  return runCode("Parse events", [signedRequest(body)]);
}

function change(body: Json): Json {
  return ((body.entry as Json[])[0].changes as Json[])[0];
}

function changeValue(body: Json): Json {
  return change(body).value as Json;
}

function messagesChange(value: Json): Json {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "000000000019100",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "000000000019001" },
              ...value,
            },
          },
        ],
      },
    ],
  };
}

describe("workflow", () => {
  test("keeps a fixed ID, publishes and has no credential in the export", () => {
    expect(workflow.id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(workflow.active).toBe(true);
    expect(workflow.settings).toEqual({ executionOrder: "v1" });
    expect(workflow.nodes.every((item) => item.credentials === undefined)).toBe(
      true,
    );
  });

  test("answers Meta's verification by GET and receives events by POST on the same path", () => {
    const get = node("Meta verification request");
    const post = node("WhatsApp events");

    expect(get.parameters).toMatchObject({
      httpMethod: "GET",
      path: "whatsapp",
      responseMode: "responseNode",
    });
    expect(post.parameters).toMatchObject({
      httpMethod: "POST",
      path: "whatsapp",
      options: { rawBody: true },
    });
    expect(post.parameters.responseMode ?? "onReceived").toBe("onReceived");
    expect(node("Respond to Meta").parameters).toMatchObject({
      respondWith: "text",
      responseBody: "={{ $json.body }}",
      options: { responseCode: "={{ $json.status }}" },
    });
  });

  test("computes both HMACs with the App Secret held by the Crypto credential", () => {
    const token = node("Derive verify token (HMAC)");
    const signature = node("Compute signature");

    for (const crypto of [token, signature]) {
      expect(crypto.type).toBe("n8n-nodes-base.crypto");
      expect(crypto.typeVersion).toBe(2);
      expect(crypto.parameters).toMatchObject({
        action: "hmac",
        type: "SHA256",
        encoding: "hex",
      });
    }
    expect(token.parameters).toMatchObject({
      value: "zenvolyx-whatsapp-webhook",
      dataPropertyName: "expectedToken",
    });
    expect(signature.parameters).toMatchObject({
      binaryData: true,
      binaryPropertyName: "data",
      dataPropertyName: "computedSignature",
    });
  });

  test("wires the verification, the POST path, the echo branch and the burst branch", () => {
    expect(targets("Meta verification request")).toEqual([
      "Derive verify token (HMAC)",
    ]);
    expect(targets("Show verify token for Meta")).toEqual([
      "Derive verify token (HMAC)",
    ]);
    expect(targets("Derive verify token (HMAC)")).toEqual([
      "Check verification",
    ]);
    expect(targets("Check verification")).toEqual(["Is Meta request"]);
    expect(targets("Is Meta request", 0)).toEqual(["Respond to Meta"]);
    expect(targets("Is Meta request", 1)).toEqual([]);
    expect(targets("WhatsApp events")).toEqual(["Compute signature"]);
    expect(targets("Compute signature")).toEqual(["Parse events"]);
    expect(targets("Load client config")).toEqual(["Build event"]);
    expect(targets("Build event")).toEqual(["Is echo"]);
    expect(targets("Is echo", 0)).toEqual(["Pause for team"]);
    expect(targets("Is echo", 1)).toEqual(["Buffer message"]);
    expect(targets("Buffer message")).toEqual(["Wait for silence"]);
    expect(targets("Wait for silence")).toEqual(["Latest per lead"]);
    expect(targets("Read pause")).toEqual(["Group burst"]);
    expect(targets("Is not paused", 0)).toEqual(["Burst event"]);
    expect(targets("Is not paused", 1)).toEqual([]);
    expect(node("Wait for silence").parameters).toEqual({
      resume: "timeInterval",
      amount: 8,
      unit: "seconds",
    });
  });

  test("runs the upper branch first where the order matters", () => {
    // Com executionOrder v1, entre ramos do mesmo nó o de cima roda inteiro antes.
    const branches: [string, string[]][] = [
      ["Parse events", ["Ensure message table", "Is new message"]],
      ["Is new message", ["Record message", "Load client config"]],
      ["Latest per lead", ["Read burst", "Read pause"]],
      ["Group burst", ["Delete burst rows", "Is not paused"]],
      [
        "Every day",
        [
          "Ensure message table (daily)",
          "Delete old message IDs",
          "Delete expired pauses",
          "Delete stale buffer rows",
        ],
      ],
    ];
    for (const [from, expected] of branches) {
      expect(targets(from)).toEqual(expected);
      for (let index = 1; index < expected.length; index++) {
        expect(above(expected[index - 1], expected[index])).toBe(true);
      }
    }
  });

  test("creates the three tables before using them, on each path", () => {
    const tables = [
      [PROCESSED, "Ensure message table"],
      [PAUSES, "Ensure pause table"],
      [BUFFER, "Ensure buffer table"],
    ];
    for (const suffix of ["", " (daily)"]) {
      for (const [tableName, name] of tables) {
        expect(node(`${name}${suffix}`).parameters).toMatchObject({
          resource: "table",
          operation: "create",
          tableName,
          options: { createIfNotExists: true },
        });
      }
      expect(targets(`Ensure message table${suffix}`)).toEqual([
        `Ensure pause table${suffix}`,
      ]);
      expect(targets(`Ensure pause table${suffix}`)).toEqual([
        `Ensure buffer table${suffix}`,
      ]);
    }
    for (const [, name] of tables) {
      expect(node(name).executeOnce).toBe(true);
    }
  });

  test("gives each table the columns its writers use", () => {
    const columns = (name: string) =>
      (
        (node(name).parameters.columns as { column: { name: string }[] })
          .column ?? []
      ).map((column) => column.name);
    const written = (name: string) =>
      Object.keys(
        (node(name).parameters.columns as { value: Json }).value,
      ).sort();

    expect(columns("Ensure message table")).toEqual(written("Record message"));
    expect(columns("Ensure pause table").sort()).toEqual(
      written("Pause for team"),
    );
    expect(columns("Ensure buffer table").sort()).toEqual(
      written("Buffer message"),
    );
    expect(
      (
        node("Ensure pause table").parameters.columns as {
          column: { name: string; type: string }[];
        }
      ).column.find((column) => column.name === "pausedUntil")?.type,
    ).toBe("date");
  });

  test("refers to every table by name, so the JSON works on any instance", () => {
    for (const item of workflow.nodes.filter(
      (candidate) =>
        candidate.type === "n8n-nodes-base.dataTable" &&
        candidate.parameters.resource === "row",
    )) {
      expect(item.parameters.dataTableId).toMatchObject({
        __rl: true,
        mode: "name",
      });
      expect([PROCESSED, PAUSES, BUFFER]).toContain(
        (item.parameters.dataTableId as Json).value,
      );
    }
  });

  test("deduplicates by message ID and cleans each table on schedule", () => {
    expect(node("Is new message").parameters).toMatchObject({
      operation: "rowNotExists",
      filters: {
        conditions: [
          { keyName: "messageId", keyValue: "={{ $json.messageId }}" },
        ],
      },
    });
    expect(node("Record message").parameters).toMatchObject({
      operation: "insert",
      columns: { value: { messageId: "={{ $json.messageId }}" } },
    });
    const cleanups: [string, string, string, string][] = [
      [
        "Delete old message IDs",
        PROCESSED,
        "createdAt",
        "={{ $now.minus({ days: 7 }).toISO() }}",
      ],
      ["Delete expired pauses", PAUSES, "pausedUntil", "={{ $now.toISO() }}"],
      [
        "Delete stale buffer rows",
        BUFFER,
        "createdAt",
        "={{ $now.minus({ hours: 1 }).toISO() }}",
      ],
    ];
    for (const [name, value, keyName, keyValue] of cleanups) {
      expect(node(name).parameters).toMatchObject({
        operation: "deleteRows",
        dataTableId: { value },
        filters: { conditions: [{ keyName, condition: "lt", keyValue }] },
      });
    }
    expect(node("Every day").parameters).toEqual({
      rule: { interval: [{ field: "days", triggerAtHour: 3 }] },
    });
  });

  test("pauses a lead for 24 hours on a team echo, one row per lead", () => {
    expect(node("Pause for team").parameters).toMatchObject({
      operation: "upsert",
      dataTableId: { value: PAUSES },
      matchType: "allConditions",
      filters: {
        conditions: [
          {
            keyName: "clientId",
            condition: "eq",
            keyValue: "={{ $json.clientId }}",
          },
          {
            keyName: "leadKey",
            condition: "eq",
            keyValue: "={{ $json.leadKey }}",
          },
        ],
      },
      columns: {
        value: {
          clientId: "={{ $json.clientId }}",
          leadKey: "={{ $json.leadKey }}",
          pausedUntil: "={{ $now.plus({ hours: 24 }).toISO() }}",
          reason: "team",
        },
      },
    });
  });

  test("reads the burst and the active pauses, and deletes only the rows it answered", () => {
    expect(node("Read burst").parameters).toMatchObject({
      operation: "get",
      dataTableId: { value: BUFFER },
      matchType: "allConditions",
      returnAll: true,
    });
    expect(node("Read pause").parameters).toMatchObject({
      operation: "get",
      dataTableId: { value: PAUSES },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "clientId", keyValue: "={{ $json.clientId }}" },
          {
            keyName: "pausedUntil",
            condition: "gt",
            keyValue: "={{ $now.toISO() }}",
          },
        ],
      },
      returnAll: true,
    });
    expect(node("Read burst").alwaysOutputData).toBe(true);
    expect(node("Read pause").alwaysOutputData).toBe(true);
    expect(node("Delete burst rows").parameters).toMatchObject({
      operation: "deleteRows",
      dataTableId: { value: BUFFER },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "clientId", keyValue: "={{ $json.clientId }}" },
          { keyName: "leadId", keyValue: "={{ $json.leadId }}" },
          {
            keyName: "id",
            condition: "lte",
            keyValue: "={{ $json.maxRowId }}",
          },
        ],
      },
    });
  });

  test("loads the client with the shared loader, one call per message", () => {
    expect(node("Load client config").parameters).toEqual({
      source: "database",
      workflowId: { __rl: true, value: "loadClientConfig", mode: "id" },
      mode: "each",
      options: {},
    });
  });
});

describe("Check verification", () => {
  const expectedToken = hmac(SECRET, "zenvolyx-whatsapp-webhook");
  const request = (query: Json) => ({ query, expectedToken });
  const valid = {
    "hub.mode": "subscribe",
    "hub.challenge": "1158201444",
    "hub.verify_token": expectedToken,
  };

  test("echoes the challenge when mode and token match", async () => {
    const { output, logs } = await runCode("Check verification", [
      request(valid),
    ]);

    expect(output).toEqual([
      { fromMeta: true, status: 200, body: "1158201444" },
    ]);
    expect(logs).toEqual([]);
  });

  test.each([
    ["a wrong token", { ...valid, "hub.verify_token": "errado" }],
    ["no token", { ...valid, "hub.verify_token": undefined }],
    ["another mode", { ...valid, "hub.mode": "unsubscribe" }],
    ["an unsafe challenge", { ...valid, "hub.challenge": "<b>x</b>" }],
    ["no parameters", {}],
  ])("rejects %s with 403", async (_case, query) => {
    const { output, logs } = await runCode("Check verification", [
      request(query),
    ]);

    expect(output).toEqual([{ fromMeta: true, status: 403, body: "" }]);
    expect(logs).toEqual(['{"event":"whatsapp_verification_rejected"}']);
  });

  test("shows the token on a manual run, without answering a webhook", async () => {
    const { output } = await runCode("Check verification", [{ expectedToken }]);

    expect(output).toEqual([{ fromMeta: false, verifyToken: expectedToken }]);
  });
});

describe("Parse events", () => {
  const message = {
    kind: "message",
    phoneNumberId: "000000000019001",
    leadId: LEAD,
    phone: PHONE,
    name: "Paciente Fictícia",
    receivedAt: "2026-09-21T14:13:20.000Z",
  };

  test("reads a text message with phone and profile name", async () => {
    const { output, logs } = await parse(fixture("inbound-text"));

    expect(output).toEqual([
      {
        ...message,
        messageId: "wamid.T019.texto.0001",
        type: "text",
        text: "Olá! Queria saber sobre implante dentário",
        replyId: null,
      },
    ]);
    expect(logs).toEqual([]);
  });

  test("keeps the BSUID when the phone is hidden by a username", async () => {
    const { output } = await parse(fixture("inbound-username"));

    expect(output).toEqual([
      {
        kind: "message",
        phoneNumberId: "000000000019001",
        messageId: "wamid.T019.usuario.0001",
        leadId: "BR.0000000000000000020",
        phone: null,
        name: "Paciente Fictício",
        type: "text",
        text: "Oi, vocês atendem sábado?",
        replyId: null,
        receivedAt: "2026-09-21T14:14:20.000Z",
      },
    ]);
  });

  test.each([
    [
      "inbound-button-reply",
      "wamid.T019.botao.0001",
      "new",
      "Sim, primeira vez",
    ],
    ["inbound-list-reply", "wamid.T019.lista.0001", "implant", "Implante"],
  ])("reads %s as a reply", async (name, messageId, replyId, text) => {
    const { output } = await parse(fixture(name));

    expect(output).toEqual([
      { ...message, messageId, type: "reply", text, replyId },
    ]);
  });

  test("marks other types as unsupported, for the team", async () => {
    const { output } = await parse(fixture("inbound-audio"));

    expect(output).toEqual([
      {
        ...message,
        messageId: "wamid.T019.audio.0001",
        type: "unsupported",
        text: null,
        replyId: null,
      },
    ]);
  });

  test("reads a team echo with the lead's BSUID and phone", async () => {
    const { output, logs } = await parse(fixture("inbound-echo"));

    expect(output).toEqual([
      {
        kind: "echo",
        phoneNumberId: "000000000019001",
        messageId: "wamid.T020.eco.0001",
        leadId: LEAD,
        phone: PHONE,
      },
    ]);
    expect(logs).toEqual([]);
  });

  test("accepts an echo with only the phone and drops one without the lead", async () => {
    const phoneOnly = fixture("inbound-echo");
    const echo = (changeValue(phoneOnly).message_echoes as Json[])[0];
    echo.to_user_id = undefined;
    const withoutLead = structuredClone(phoneOnly);
    (changeValue(withoutLead).message_echoes as Json[])[0].to = undefined;

    expect((await parse(phoneOnly)).output).toEqual([
      {
        kind: "echo",
        phoneNumberId: "000000000019001",
        messageId: "wamid.T020.eco.0001",
        leadId: null,
        phone: PHONE,
      },
    ]);
    expect(await parse(withoutLead)).toEqual({
      output: [],
      logs: [
        '{"event":"whatsapp_invalid_echo","phoneNumberId":"000000000019001"}',
      ],
    });
  });

  test("logs a failed status with codes only", async () => {
    const { output, logs } = await parse(fixture("inbound-status-failed"));

    expect(output).toEqual([]);
    expect(logs).toEqual([
      '{"event":"whatsapp_failed_status","phoneNumberId":"000000000019001","errorCodes":[131026]}',
    ]);
  });

  test("drops history, app state, other statuses, reactions and system messages silently", async () => {
    const delivered = messagesChange({
      statuses: [{ id: "wamid.x", status: "delivered", recipient_id: PHONE }],
    });
    const appState = fixture("inbound-text");
    change(appState).field = "smb_app_state_sync";
    const ignored = messagesChange({
      contacts: [{ user_id: LEAD }],
      messages: [
        {
          from_user_id: LEAD,
          id: "wamid.T019.reacao",
          timestamp: "1790000000",
          type: "reaction",
          reaction: { message_id: "wamid.x", emoji: "👍" },
        },
        {
          from_user_id: LEAD,
          id: "wamid.T019.sistema",
          timestamp: "1790000000",
          type: "system",
        },
      ],
    });

    for (const body of [
      fixture("inbound-history"),
      delivered,
      appState,
      ignored,
    ]) {
      expect(await parse(body)).toEqual({ output: [], logs: [] });
    }
  });

  test.each([
    ["a signature from another secret", { headerSecret: "outro-segredo" }],
    ["no signature header", { header: undefined }],
    ["a missing computed signature", { computed: undefined }],
  ])("rejects %s without reading the body", async (_case, variation) => {
    const request = signedRequest(
      fixture("inbound-text"),
      "headerSecret" in variation ? variation.headerSecret : SECRET,
    );
    if ("header" in variation) request.headers = {};
    if ("computed" in variation) request.computedSignature = undefined;

    const { output, logs } = await runCode("Parse events", [request]);

    expect(output).toEqual([]);
    expect(logs).toEqual(['{"event":"whatsapp_invalid_signature"}']);
  });

  test("rejects a signed body that is not a WhatsApp notification", async () => {
    expect(await parse({ object: "page", entry: [] })).toEqual({
      output: [],
      logs: ['{"event":"whatsapp_unexpected_payload"}'],
    });
  });

  test("drops messages without a valid BSUID or ID and payloads without the business number", async () => {
    const noLead = messagesChange({
      messages: [
        { from: PHONE, id: "wamid.x", type: "text", text: { body: "Oi" } },
      ],
    });
    const badLead = messagesChange({
      messages: [
        {
          from_user_id: "5500000000019",
          id: "wamid.x",
          type: "text",
          text: { body: "Oi" },
        },
      ],
    });
    const noId = messagesChange({
      messages: [{ from_user_id: LEAD, type: "text", text: { body: "Oi" } }],
    });
    const noMetadata = fixture("inbound-text");
    changeValue(noMetadata).metadata = {};

    for (const body of [noLead, badLead, noId]) {
      expect(await parse(body)).toEqual({
        output: [],
        logs: [
          '{"event":"whatsapp_invalid_message","phoneNumberId":"000000000019001"}',
        ],
      });
    }
    expect(await parse(noMetadata)).toEqual({
      output: [],
      logs: ['{"event":"whatsapp_invalid_payload"}'],
    });
  });

  test("reads every message of a batch, caps long text and fixes a bad timestamp", async () => {
    const body = messagesChange({
      contacts: [{ user_id: LEAD }],
      messages: [
        {
          from_user_id: LEAD,
          id: "wamid.T019.lote.0001",
          timestamp: "1790000000",
          type: "text",
          text: { body: "x".repeat(5000) },
        },
        {
          from_user_id: LEAD,
          id: "wamid.T019.lote.0002",
          timestamp: "não é número",
          type: "text",
          text: { body: "segunda" },
        },
      ],
    });

    const { output } = await parse(body);

    expect(output.map((item) => item.messageId)).toEqual([
      "wamid.T019.lote.0001",
      "wamid.T019.lote.0002",
    ]);
    expect(output[0].text).toHaveLength(4096);
    expect(Number.isNaN(Date.parse(output[1].receivedAt as string))).toBe(
      false,
    );
  });

  test("never logs personal data", async () => {
    const logs = (
      await Promise.all(
        [
          "inbound-status-failed",
          "inbound-text",
          "inbound-audio",
          "inbound-echo",
        ].map(async (name) => (await parse(fixture(name))).logs),
      )
    ).flat();

    for (const line of logs) {
      expect(line).not.toMatch(/5500000000019|BR\.0000|Paciente|implante/);
    }
  });
});

describe("Build event", () => {
  const parsed = {
    kind: "message",
    phoneNumberId: "000000000019001",
    messageId: "wamid.T019.texto.0001",
    leadId: LEAD,
    phone: PHONE,
    name: "Paciente Fictícia",
    type: "text",
    text: "Olá! Queria saber sobre implante dentário",
    replyId: null,
    receivedAt: "2026-09-21T14:13:20.000Z",
  };
  const config = { id: CLIENT, active: true };
  const found = { found: true, config, invalidConfigs: [] };

  test("builds the event from the documented format, with the client config", async () => {
    const { output, logs } = await runCode("Build event", [found], {
      "Is new message": [parsed],
    });

    expect(output).toEqual([
      {
        kind: "message",
        event: {
          clientId: CLIENT,
          channel: "whatsapp",
          leadId: LEAD,
          phone: PHONE,
          name: "Paciente Fictícia",
          messageIds: ["wamid.T019.texto.0001"],
          type: "text",
          text: "Olá! Queria saber sobre implante dentário",
          replyId: null,
          receivedAt: "2026-09-21T14:13:20.000Z",
        },
        config,
      },
    ]);
    expect(logs).toEqual([]);
  });

  test("turns a team echo into a pause key: the BSUID, or the phone when it is missing", async () => {
    const echo = {
      kind: "echo",
      phoneNumberId: "000000000019001",
      messageId: "wamid.T020.eco.0001",
      leadId: LEAD,
      phone: PHONE,
    };
    const { output, logs } = await runCode("Build event", [found, found], {
      "Is new message": [echo, { ...echo, leadId: null }],
    });

    expect(output).toEqual([
      { kind: "echo", clientId: CLIENT, leadKey: LEAD },
      { kind: "echo", clientId: CLIENT, leadKey: `tel:${PHONE}` },
    ]);
    expect(logs).toEqual([
      '{"event":"whatsapp_team_reply","clientId":"odontologia-demo"}',
      '{"event":"whatsapp_team_reply","clientId":"odontologia-demo"}',
    ]);
  });

  test("stops unknown clients and reports unreadable configs, without personal data", async () => {
    const { output, logs } = await runCode(
      "Build event",
      [
        { found: false, reason: "not_found", invalidConfigs: ["quebrado"] },
        { found: true, config, invalidConfigs: ["quebrado"] },
      ],
      { "Is new message": [parsed, parsed] },
    );

    expect(output).toHaveLength(1);
    expect(logs).toEqual([
      '{"event":"client_configs_invalid","folders":["quebrado"]}',
      '{"event":"whatsapp_unknown_client","phoneNumberId":"000000000019001","reason":"not_found"}',
      '{"event":"client_configs_invalid","folders":["quebrado"]}',
    ]);
  });
});

describe("bursts and pauses", () => {
  const config = { id: CLIENT };
  const event = (overrides: Json = {}) => ({
    clientId: CLIENT,
    channel: "whatsapp",
    leadId: LEAD,
    phone: PHONE,
    name: "Paciente Fictícia",
    messageIds: ["wamid.3"],
    type: "text",
    text: "terceira",
    replyId: null,
    receivedAt: "2026-09-25T12:00:09.000Z",
    ...overrides,
  });
  const row = (id: number, overrides: Json = {}) => ({
    id,
    clientId: CLIENT,
    leadId: LEAD,
    messageId: `wamid.${id}`,
    type: "text",
    text: `mensagem ${id}`,
    replyId: null,
    receivedAt: `2026-09-25T12:00:0${id}.000Z`,
    ...overrides,
  });
  const lead = (ownMaxId: number, leadId = LEAD) => ({
    clientId: CLIENT,
    leadId,
    ownMaxId,
  });

  async function group(
    rows: Json[],
    pauses: Json[] = [{}],
    leads: Json[] = [lead(3)],
    messages: Json[] = [{ kind: "message", event: event(), config }],
  ) {
    return runCode("Group burst", pauses, {
      "Read burst": rows.length > 0 ? rows : [{}],
      "Latest per lead": leads,
      "Build event": messages,
    });
  }

  test("keeps one entry per lead with the highest row this execution wrote", async () => {
    const other = "BR.0000000000000000020";
    const { output } = await runCode("Latest per lead", [
      row(1),
      row(4, { leadId: other }),
      row(2),
    ]);

    expect(output).toEqual([lead(2), lead(4, other)]);
  });

  test("answers the whole burst from the execution of the latest message", async () => {
    const { output, logs } = await group([row(2), row(1), row(3)]);

    expect(output).toEqual([
      {
        clientId: CLIENT,
        leadId: LEAD,
        maxRowId: 3,
        paused: false,
        event: event({
          messageIds: ["wamid.1", "wamid.2", "wamid.3"],
          text: "mensagem 1\nmensagem 2\nmensagem 3",
          receivedAt: "2026-09-25T12:00:03.000Z",
        }),
        config,
      },
    ]);
    expect(logs).toEqual([]);
  });

  test("stops an older execution when a newer message is waiting", async () => {
    expect(
      (await group([row(1), row(2), row(3)], [{}], [lead(2)])).output,
    ).toEqual([]);
  });

  test("stops when another execution already answered its rows", async () => {
    expect((await group([row(4)], [{}], [lead(3)])).output).toEqual([]);
    expect((await group([], [{}], [lead(3)])).output).toEqual([]);
  });

  test("uses the last button or list answer, and sends media to the team", async () => {
    const replies = await group([
      row(1, { type: "reply", text: "Implante", replyId: "implant" }),
      row(2),
      row(3, { type: "reply", text: "Sim, primeira vez", replyId: "new" }),
    ]);
    const media = await group([
      row(1, { type: "unsupported", text: null }),
      row(2, { type: "reply", text: "Implante", replyId: "implant" }),
      row(3),
    ]);

    expect(replies.output[0].event).toMatchObject({
      type: "reply",
      replyId: "new",
      text: "Implante\nmensagem 2\nSim, primeira vez",
    });
    expect(media.output[0].event).toMatchObject({
      type: "unsupported",
      replyId: null,
      text: "Implante\nmensagem 3",
    });
  });

  test.each([
    ["the BSUID", LEAD],
    ["the phone of an echo without BSUID", `tel:${PHONE}`],
  ])("marks the burst as paused by %s", async (_case, leadKey) => {
    const { output, logs } = await group(
      [row(1), row(3)],
      [{ clientId: CLIENT, leadKey, pausedUntil: "2026-09-26T12:00:00.000Z" }],
    );

    expect(output[0]).toMatchObject({ paused: true, maxRowId: 3 });
    expect(logs).toEqual([
      '{"event":"whatsapp_paused_lead","clientId":"odontologia-demo"}',
    ]);
  });

  test("ignores pauses of another lead or client, and the phone key when the phone is hidden", async () => {
    const pauses = [
      { clientId: "outra-clinica", leadKey: LEAD },
      { clientId: CLIENT, leadKey: "BR.0000000000000000020" },
      { clientId: CLIENT, leadKey: "tel:null" },
    ];
    const hidden = [{ kind: "message", event: event({ phone: null }), config }];

    expect((await group([row(3)], pauses)).output[0].paused).toBe(false);
    expect(
      (await group([row(3)], pauses, [lead(3)], hidden)).output[0].paused,
    ).toBe(false);
  });

  test("handles several leads in one execution", async () => {
    const other = "BR.0000000000000000020";
    const { output } = await group(
      [row(1), row(2, { leadId: other }), row(3)],
      [{}],
      [lead(3), lead(2, other)],
      [
        { kind: "message", event: event(), config },
        { kind: "echo", clientId: CLIENT, leadKey: LEAD },
        {
          kind: "message",
          event: event({ leadId: other, messageIds: ["wamid.2"] }),
          config,
        },
      ],
    );

    expect(
      output.map((item) => [item.leadId, (item.event as Json).messageIds]),
    ).toEqual([
      [LEAD, ["wamid.1", "wamid.3"]],
      [other, ["wamid.2"]],
    ]);
  });

  test("hands the conversation only the event and the config", async () => {
    const { output } = await runCode("Burst event", [
      {
        clientId: CLIENT,
        leadId: LEAD,
        maxRowId: 3,
        paused: false,
        event: event(),
        config,
      },
    ]);

    expect(output).toEqual([{ event: event(), config }]);
  });
});

test("the fixtures of the documented types reach the event format end to end", async () => {
  const names = [
    "inbound-text",
    "inbound-username",
    "inbound-button-reply",
    "inbound-list-reply",
    "inbound-audio",
  ];
  for (const name of names) {
    const { output: messages } = await parse(fixture(name));
    const { output } = await runCode(
      "Build event",
      messages.map(() => ({ found: true, config: { id: "cliente" } })),
      { "Is new message": messages },
    );

    expect(output).toHaveLength(1);
    expect(Object.keys(output[0].event as Json)).toEqual([
      "clientId",
      "channel",
      "leadId",
      "phone",
      "name",
      "messageIds",
      "type",
      "text",
      "replyId",
      "receivedAt",
    ]);
  }
});

test("a burst fixture becomes one event with the texts in order", async () => {
  const bodies = fixture<Json[]>("inbound-burst");
  const built: Json[] = [];
  for (const body of bodies) {
    const { output: messages } = await parse(body);
    const { output } = await runCode(
      "Build event",
      [{ found: true, config: { id: CLIENT } }],
      { "Is new message": messages },
    );
    built.push(...output);
  }
  const rows = built.map((item, index) => {
    const event = item.event as Json;
    return {
      id: index + 1,
      clientId: event.clientId,
      leadId: event.leadId,
      messageId: (event.messageIds as string[])[0],
      type: event.type,
      text: event.text,
      replyId: event.replyId,
      receivedAt: event.receivedAt,
    };
  });

  const { output } = await runCode("Group burst", [{}], {
    "Read burst": rows,
    "Latest per lead": [{ clientId: CLIENT, leadId: LEAD, ownMaxId: 2 }],
    "Build event": built,
  });

  expect(output).toHaveLength(1);
  expect(output[0].event).toMatchObject({
    messageIds: ["wamid.T020.rajada.0001", "wamid.T020.rajada.0002"],
    type: "text",
    text: "Oi\nQueria marcar uma avaliação",
  });
});
