import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

type WorkflowNode = {
  name: string;
  parameters: Record<string, unknown>;
  credentials?: unknown;
};

type Workflow = {
  id: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<string, { main: { node: string }[][] }>;
};

type CodeRunner = (...args: unknown[]) => Promise<unknown>;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => CodeRunner;

const workflow = JSON.parse(
  readFileSync(
    new URL(
      "../integrations/whatsapp/client-gateway/workflow.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Workflow;

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
  inputs: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const jsCode = node(name).parameters.jsCode as string;
  const $input = { all: () => inputs.map((json) => ({ json })) };
  const output = (await new AsyncFunction("$input", jsCode)($input)) as {
    json: Record<string, unknown>;
  }[];
  return output.map((item) => item.json);
}

test("keeps a callable ID, no credential and the fixed Graph API base", () => {
  const http = node("Call Graph API");

  expect(workflow.id).toMatch(/^[A-Za-z0-9]{16}$/);
  expect(workflow.active).toBe(false);
  expect(workflow.nodes.some((item) => item.credentials !== undefined)).toBe(
    false,
  );
  expect(http.parameters.url).toBe(
    "=https://graph.facebook.com/v25.0{{ $json.path }}",
  );
  expect(http.parameters.genericAuthType).toBe("httpHeaderAuth");
  expect(http.parameters.options).toMatchObject({
    response: { response: { fullResponse: true, neverError: true } },
  });
  expect(next("When Executed by Another Workflow")).toBe("Validate request");
  expect(next("Validate request")).toBe("Is valid");
  expect(next("Is valid", 0)).toBe("Call Graph API");
  expect(next("Is valid", 1)).toBe("Rejected");
  expect(next("Call Graph API")).toBe("Shape response");
});

test("accepts Graph API paths with query and body", async () => {
  const [post, get] = await runCode("Validate request", [
    {
      method: "post",
      path: "/000000000016001/messages",
      body: { messaging_product: "whatsapp" },
    },
    {
      method: "GET",
      path: "/000000000016010/phone_numbers",
      query: { fields: "id" },
    },
  ]);

  expect(post).toEqual({
    valid: true,
    method: "POST",
    path: "/000000000016001/messages",
    query: {},
    body: { messaging_product: "whatsapp" },
  });
  expect(get).toEqual({
    valid: true,
    method: "GET",
    path: "/000000000016010/phone_numbers",
    query: { fields: "id" },
    body: null,
  });
});

test.each([
  ["invalid_method", { method: "PATCH", path: "/me" }],
  ["invalid_method", { path: "/me" }],
  ["invalid_path", { method: "GET", path: "//evil.example.com/x" }],
  ["invalid_path", { method: "GET", path: "/../../etc" }],
  ["invalid_path", { method: "GET", path: "https://evil.example.com" }],
  ["invalid_path", { method: "GET", path: "/me?fields=id" }],
  ["invalid_path", { method: "GET", path: `/${"a".repeat(200)}` }],
  ["invalid_path", { method: "GET" }],
  ["invalid_query", { method: "GET", path: "/me", query: { limit: 10 } }],
  ["invalid_query", { method: "GET", path: "/me", query: ["fields"] }],
  ["invalid_body", { method: "POST", path: "/me", body: ["x"] }],
  ["invalid_body", { method: "POST", path: "/me", body: "texto" }],
])("rejects %s (%j)", async (rejected, input) => {
  const [result] = await runCode("Validate request", [input]);

  expect(result).toEqual({ valid: false, rejected });
});

test("returns status and body, or the rejection reason", async () => {
  expect(
    await runCode("Shape response", [
      { statusCode: 401, headers: {}, body: { error: { code: 190 } } },
      { statusCode: 200 },
    ]),
  ).toEqual([
    { status: 401, body: { error: { code: 190 } } },
    { status: 200, body: null },
  ]);
  expect(
    await runCode("Rejected", [{ valid: false, rejected: "invalid_path" }]),
  ).toEqual([{ status: 0, body: null, rejected: "invalid_path" }]);
});
