import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { checkWorkflows, runCheck } from "../scripts/check-workflows.ts";

const fixtureDirectory = fileURLToPath(
  new URL("./fixtures/workflows/", import.meta.url),
);

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDirectory, name), "utf8"));
}

function workflow(parameters: unknown, extras = {}) {
  return {
    nodes: [
      {
        name: "NOME_FICTICIO_NAO_IMPRIMIR",
        type: "n8n-nodes-base.httpRequest",
        parameters,
        ...extras,
      },
    ],
    connections: {},
  };
}

test("accepts clean exports from the editor and CLI arrays", () => {
  const clean = fixture("clean.json");
  expect(checkWorkflows(clean)).toEqual([]);
  expect(checkWorkflows([clean, clean])).toEqual([]);
});

test("rejects pinned data without exposing its contents", () => {
  const issues = checkWorkflows(fixture("with-pin-data.json"));
  expect(issues).toEqual([
    {
      workflow: 1,
      node: null,
      reason: "Campo pindata proibido na exportação.",
    },
  ]);
  expect(JSON.stringify(issues)).not.toContain("DADO_FICTICIO_FIXADO");
});

test.each([{}, null])("rejects even empty pinData (%j)", (pinData) => {
  expect(checkWorkflows({ ...workflow({}), pinData })).toHaveLength(1);
});

test("rejects credential references and reports the node's position", () => {
  const issues = checkWorkflows([
    fixture("clean.json"),
    workflow({}, { credentials: { httpHeaderAuth: { id: "FAKE_ID" } } }),
  ]);
  expect(issues).toEqual([
    {
      workflow: 2,
      node: 1,
      reason: "Campo credentials proibido na exportação.",
    },
  ]);
});

test.each([
  { apiKey: "CHAVE_FICTICIA" },
  { nested: [{ client_secret: "SEGREDO_FICTICIO" }] },
  { name: "X-Api-Key", value: "CHAVE_FICTICIA" },
  { name: "access_token", value: "TOKEN_FICTICIO" },
  { name: "Cookie", value: "SESSION_FICTICIA" },
  { url: "https://example.invalid/?access_token=TOKEN_FICTICIO" },
  { url: "https://user:FICTICIO@example.invalid/" },
  { jsonBody: '{"password":"SENHA_FICTICIA"}' },
  { jsCode: 'const apiKey = "CHAVE_FICTICIA";' },
  { jsCode: 'return { header: "Bearer TOKEN_FICTICIO" };' },
  { content: "-----BEGIN PRIVATE KEY-----\nFICTICIA" },
  { content: "sk-ant-api03-CHAVE_FICTICIA_SEM_VALOR_REAL" },
])("detects literal secrets in parameters: %j", (parameters) => {
  const issues = checkWorkflows(workflow(parameters));
  expect(issues.length).toBeGreaterThan(0);
  expect(issues.every((issue) => issue.node === 1)).toBe(true);
  expect(JSON.stringify(issues)).not.toMatch(/FICTICI|NOME_FICTICIO/);
});

test("allows external references, blank fields and ordinary configuration", () => {
  expect(
    checkWorkflows(
      workflow({
        apiKey: "={{ $env.ANTHROPIC_API_KEY }}",
        jsonBody: '{"apiKey":"={{ $env.API_KEY }}"}',
        nested: { token: "={{ $credentials.apiKey }}" },
        headerParameters: {
          parameters: [{ name: "Authorization", value: "={{ $vars.AUTH }}" }],
        },
        password: "",
        secret: null,
        max_tokens: 2000,
        authentication: "predefinedCredentialType",
        url: "https://example.invalid/messages?page=1",
        jsCode: "return [{ json: { ok: true } }];",
      }),
    ),
  ).toEqual([]);
});

test("does not treat a literal wrapped in an expression as an external reference", () => {
  expect(
    checkWorkflows(workflow({ apiKey: '={{ "CHAVE_FICTICIA" }}' })).length,
  ).toBeGreaterThan(0);
});

test.each([null, [], {}, { nodes: [null], connections: {} }])(
  "rejects invalid exports: %j",
  (data) => {
    expect(checkWorkflows(data).length).toBeGreaterThan(0);
  },
);

test("CLI returns success for clean JSON and failure for unsafe fixtures", () => {
  const script = resolve("scripts/check-workflows.ts");
  const clean = spawnSync(
    process.execPath,
    [script, join(fixtureDirectory, "clean.json")],
    { encoding: "utf8", timeout: 10_000 },
  );
  expect(clean.status).toBe(0);
  const unsafe = spawnSync(process.execPath, [script, fixtureDirectory], {
    encoding: "utf8",
    timeout: 10_000,
  });
  expect(unsafe.status).toBe(1);
  expect(unsafe.stderr).toBe("");
  expect(unsafe.stdout).toContain("with-token.json");
  expect(unsafe.stdout).toContain("nó #1");
  expect(unsafe.stdout).toContain("with-pin-data.json");
  expect(unsafe.stdout).not.toMatch(
    /TOKEN_FICTICIO_TESTE|DADO_FICTICIO_FIXADO/,
  );
});

test("reports malformed JSON and missing paths without leaking parse errors", () => {
  const directory = mkdtempSync(join(tmpdir(), "zenvolyx-workflows-"));
  try {
    const file = join(directory, "invalid.json");
    writeFileSync(file, '{"password":"SENHA_FICTICIA", broken');
    const messages: string[] = [];
    expect(
      runCheck([file, join(directory, "missing")], (m) => messages.push(m)),
    ).toBe(1);
    expect(messages.join("\n")).toContain("JSON inválido");
    expect(messages.join("\n")).toContain("não foi possível ler o caminho");
    expect(messages.join("\n")).not.toContain("SENHA_FICTICIA");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("all exported workflows in the repository pass the check", () => {
  const messages: string[] = [];
  expect(
    runCheck(["automations", "integrations"], (message) =>
      messages.push(message),
    ),
    messages.join("\n"),
  ).toBe(0);
});

test("scans nested directories once and ignores non-JSON files", () => {
  const directory = mkdtempSync(join(tmpdir(), "zenvolyx-workflows-"));
  try {
    const nested = join(directory, "nested.json");
    mkdirSync(nested);
    const file = join(nested, "workflow.json");
    writeFileSync(file, JSON.stringify(fixture("clean.json")));
    writeFileSync(join(directory, "README.md"), "Texto fictício");
    const messages: string[] = [];
    expect(runCheck([directory, file], (m) => messages.push(m))).toBe(0);
    expect(messages).toEqual([
      "1 arquivo(s) verificado(s); nenhum problema detectado.",
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
