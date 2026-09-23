import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

type WorkflowNode = {
  name: string;
  type: string;
  alwaysOutputData?: boolean;
  parameters: Record<string, unknown>;
};

type Workflow = {
  id: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<string, { main: { node: string }[][] }>;
};

type Entry = { folder: string; text: string };

type Item = {
  json: Record<string, unknown>;
  binary?: { data: { directory: string; fileName: string } };
};

type Selection = {
  found: boolean;
  reason?: string;
  config?: { id: string };
  clientIds?: string[];
  invalidConfigs: string[];
};

type CodeRunner = (...args: unknown[]) => Promise<unknown>;

const INPUT_NODE = "When Executed by Another Workflow";
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => CodeRunner;

const workflow = JSON.parse(
  readFileSync(
    new URL("../automations/load-client-config/workflow.json", import.meta.url),
    "utf8",
  ),
) as Workflow;
const fixtureDirectory = fileURLToPath(
  new URL("./fixtures/load-client-config/", import.meta.url),
);

function nodeOfType(type: string): WorkflowNode {
  const node = workflow.nodes.find((candidate) => candidate.type === type);
  if (node === undefined) {
    throw new Error(`Nó ausente: ${type}`);
  }
  return node;
}

function fixtureEntries(): Entry[] {
  const clientsDirectory = join(fixtureDirectory, "clients");
  return readdirSync(clientsDirectory)
    .sort()
    .map((folder) => ({
      folder,
      text: readFileSync(join(clientsDirectory, folder, "config.json"), "utf8"),
    }));
}

async function selectClient(
  entries: Entry[],
  input: Record<string, unknown>,
): Promise<Selection> {
  const items: Item[] = entries.map((entry) => ({
    json: {},
    binary: {
      data: {
        directory: `/files/clients/${entry.folder}`,
        fileName: "config.json",
      },
    },
  }));
  if (items.length === 0) {
    items.push({ json: {} });
  }
  const $input = { all: () => items };
  const $ = (name: string) => {
    if (name !== INPUT_NODE) {
      throw new Error(`Nó inesperado: ${name}`);
    }
    return { first: () => ({ json: input }) };
  };
  const helpers = {
    getBinaryDataBuffer: async (index: number) =>
      Buffer.from(entries[index].text, "utf8"),
  };
  const jsCode = nodeOfType("n8n-nodes-base.code").parameters.jsCode as string;
  const run = new AsyncFunction("$input", "$", jsCode);
  const output = (await run.call({ helpers }, $input, $)) as {
    json: Selection;
  }[];
  expect(output).toHaveLength(1);
  return output[0].json;
}

test("keeps the stable ID, the published state and the node chain", () => {
  const trigger = nodeOfType("n8n-nodes-base.executeWorkflowTrigger");
  const reader = nodeOfType("n8n-nodes-base.readWriteFile");
  const code = nodeOfType("n8n-nodes-base.code");

  expect(workflow.id).toBe("loadClientConfig");
  expect(workflow.active).toBe(true);
  expect(trigger.name).toBe(INPUT_NODE);
  expect(trigger.parameters.inputSource).toBe("passthrough");
  expect(reader.parameters.fileSelector).toBe("/files/clients/*/config.json");
  expect(reader.alwaysOutputData).toBe(true);
  expect(workflow.connections[trigger.name].main[0][0].node).toBe(reader.name);
  expect(workflow.connections[reader.name].main[0][0].node).toBe(code.name);
});

test("finds the active client for the example input", async () => {
  const input = JSON.parse(
    readFileSync(join(fixtureDirectory, "input.json"), "utf8"),
  ) as Record<string, unknown>;

  const result = await selectClient(fixtureEntries(), input);

  expect(result.found).toBe(true);
  expect(result.config?.id).toBe("ativo");
  expect(result.invalidConfigs).toEqual([]);
});

test.each([
  ["inactive client", "000000000016002"],
  ["template folder, even if active", "000000000016004"],
  ["unknown number", "999999999999999"],
])("ignores %s", async (_case, phoneNumberId) => {
  const result = await selectClient(fixtureEntries(), { phoneNumberId });

  expect(result).toEqual({
    found: false,
    reason: "not_found",
    invalidConfigs: [],
  });
});

test("reports duplicated active numbers instead of choosing one", async () => {
  const result = await selectClient(fixtureEntries(), {
    phoneNumberId: "000000000016003",
  });

  expect(result).toEqual({
    found: false,
    reason: "duplicate",
    clientIds: ["dup-a", "dup-b"],
    invalidConfigs: [],
  });
});

test("lists broken configs without stopping the lookup", async () => {
  const entries = [
    ...fixtureEntries(),
    { folder: "quebrado", text: '{ "id": "quebrado", ' },
    {
      folder: "pasta-errada",
      text: JSON.stringify({
        id: "outro-id",
        active: true,
        whatsapp: { phoneNumberId: "000000000016001" },
      }),
    },
  ];

  const result = await selectClient(entries, {
    phoneNumberId: "000000000016001",
  });

  expect(result.found).toBe(true);
  expect(result.config?.id).toBe("ativo");
  expect(result.invalidConfigs).toEqual(["quebrado", "pasta-errada"]);
});

test.each([
  ["missing", {}],
  ["empty", { phoneNumberId: "" }],
  ["blank", { phoneNumberId: "   " }],
  ["not a string", { phoneNumberId: 16001 }],
])("rejects a %s phoneNumberId", async (_case, input) => {
  const result = await selectClient(fixtureEntries(), input);

  expect(result).toEqual({
    found: false,
    reason: "invalid_input",
    invalidConfigs: [],
  });
});

test("returns not_found when no config file exists", async () => {
  const result = await selectClient([], { phoneNumberId: "000000000016001" });

  expect(result).toEqual({
    found: false,
    reason: "not_found",
    invalidConfigs: [],
  });
});
