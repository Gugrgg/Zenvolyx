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
const TABLE = "whatsapp_processed_messages";
const LEAD = "BR.0000000000000000019";
const PHONE = "5500000000019";

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

function fixture(name: string): Json {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/whatsapp/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as Json;
}

async function runCode(
  name: string,
  inputs: Json[],
  matching: Json[] = [],
): Promise<{ output: Json[]; logs: string[] }> {
  const logs: string[] = [];
  const jsCode = node(name).parameters.jsCode as string;
  const $input = { all: () => inputs.map((json) => ({ json })) };
  const $ = (target: string) => {
    if (target !== "Is new message") {
      throw new Error(`Nó inesperado: ${target}`);
    }
    return { itemMatching: (index: number) => ({ json: matching[index] }) };
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

  test("wires both verification triggers and the POST path", () => {
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
  });

  test("creates the table before deduplicating and records before loading the client", () => {
    // Com executionOrder v1, o ramo de cima roda inteiro antes do de baixo.
    expect(targets("Parse events")).toEqual([
      "Ensure message table",
      "Is new message",
    ]);
    expect(above("Ensure message table", "Is new message")).toBe(true);
    expect(targets("Is new message")).toEqual([
      "Record message",
      "Load client config",
    ]);
    expect(above("Record message", "Load client config")).toBe(true);
    expect(targets("Every day")).toEqual([
      "Ensure message table (daily)",
      "Delete old message IDs",
    ]);
    expect(
      above("Ensure message table (daily)", "Delete old message IDs"),
    ).toBe(true);
    expect(node("Ensure message table").executeOnce).toBe(true);
  });

  test("uses one Data table by name, created on demand and cleaned after 7 days", () => {
    const tables = workflow.nodes.filter(
      (item) => item.type === "n8n-nodes-base.dataTable",
    );

    expect(tables).toHaveLength(5);
    for (const name of [
      "Ensure message table",
      "Ensure message table (daily)",
    ]) {
      expect(node(name).parameters).toEqual({
        resource: "table",
        operation: "create",
        tableName: TABLE,
        columns: { column: [{ name: "messageId", type: "string" }] },
        options: { createIfNotExists: true },
      });
    }
    for (const name of [
      "Is new message",
      "Record message",
      "Delete old message IDs",
    ]) {
      expect(node(name).parameters.dataTableId).toEqual({
        __rl: true,
        value: TABLE,
        mode: "name",
      });
    }
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
    expect(node("Delete old message IDs").parameters).toMatchObject({
      operation: "deleteRows",
      filters: {
        conditions: [
          {
            keyName: "createdAt",
            condition: "lt",
            keyValue: "={{ $now.minus({ days: 7 }).toISO() }}",
          },
        ],
      },
    });
    expect(node("Every day").parameters).toEqual({
      rule: { interval: [{ field: "days", triggerAtHour: 3 }] },
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

  test("logs a failed status with codes only", async () => {
    const { output, logs } = await parse(fixture("inbound-status-failed"));

    expect(output).toEqual([]);
    expect(logs).toEqual([
      '{"event":"whatsapp_failed_status","phoneNumberId":"000000000019001","errorCodes":[131026]}',
    ]);
  });

  test("drops history, echoes, other statuses, reactions and system messages silently", async () => {
    const delivered = messagesChange({
      statuses: [{ id: "wamid.x", status: "delivered", recipient_id: PHONE }],
    });
    const echo = fixture("inbound-text");
    const echoChange = (echo.entry as Json[])[0].changes as Json[];
    echoChange[0].field = "smb_message_echoes";
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

    for (const body of [fixture("inbound-history"), delivered, echo, ignored]) {
      expect(await parse(body)).toEqual({ output: [], logs: [] });
    }
  });

  test.each([
    ["a signature from another secret", { headerSecret: "outro-segredo" }],
    ["no signature header", { header: undefined }],
    ["a missing computed signature", { computed: undefined }],
  ])("rejects %s without reading the body", async (_case, change) => {
    const request = signedRequest(
      fixture("inbound-text"),
      "headerSecret" in change ? change.headerSecret : SECRET,
    );
    if ("header" in change) request.headers = {};
    if ("computed" in change) request.computedSignature = undefined;

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
    const noMetadataValue = (
      (noMetadata.entry as Json[])[0].changes as Json[]
    )[0].value as Json;
    noMetadataValue.metadata = {};

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
        ["inbound-status-failed", "inbound-text", "inbound-audio"].map(
          async (name) => (await parse(fixture(name))).logs,
        ),
      )
    ).flat();

    for (const line of logs) {
      expect(line).not.toMatch(/5500000000019|BR\.0000|Paciente|implante/);
    }
  });
});

describe("Build event", () => {
  const parsed = {
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
  const config = { id: "odontologia-demo", active: true };

  test("builds the event from the documented format, with the client config", async () => {
    const { output, logs } = await runCode(
      "Build event",
      [{ found: true, config, invalidConfigs: [] }],
      [parsed],
    );

    expect(output).toEqual([
      {
        event: {
          clientId: "odontologia-demo",
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

  test("stops unknown clients and reports unreadable configs, without personal data", async () => {
    const { output, logs } = await runCode(
      "Build event",
      [
        { found: false, reason: "not_found", invalidConfigs: ["quebrado"] },
        { found: true, config, invalidConfigs: ["quebrado"] },
      ],
      [parsed, parsed],
    );

    expect(output).toHaveLength(1);
    expect(logs).toEqual([
      '{"event":"client_configs_invalid","folders":["quebrado"]}',
      '{"event":"whatsapp_unknown_client","phoneNumberId":"000000000019001","reason":"not_found"}',
      '{"event":"client_configs_invalid","folders":["quebrado"]}',
    ]);
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
      messages,
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
