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
import { checkClientDirectory } from "../scripts/check-clients.ts";
import {
  clientConfigSchema,
  validateClientConfigs,
} from "../scripts/client-config-schema.ts";

const fixtures = fileURLToPath(new URL("./fixtures/clients/", import.meta.url));
function fixture(name = "valid") {
  return JSON.parse(
    readFileSync(join(fixtures, `${name}.json`), "utf8"),
  ) as unknown;
}
function validConfig() {
  return clientConfigSchema.parse(fixture());
}
function change(path: (string | number)[], value: unknown) {
  const config = validConfig();
  let target = config as unknown as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) {
    target = target[key] as Record<string | number, unknown>;
  }
  target[path[path.length - 1]] = value;
  return config;
}

test("accepts all three question types without changing the configuration", () => {
  expect(clientConfigSchema.parse(fixture())).toEqual(fixture());
});

test("accepts optional sections absent and empty rules", () => {
  const config = validConfig();
  delete config.calendar;
  delete config.scheduling;
  delete config.ai;
  config.qualification.rules = [];
  expect(clientConfigSchema.safeParse(config).success).toBe(true);
});

test.each(["duplicate-option", "unknown-option", "overlapping-hours"])(
  "rejects the invalid fixture %s",
  (name) => {
    expect(clientConfigSchema.safeParse(fixture(name)).success).toBe(false);
  },
);

const invalidFields: { path: (string | number)[]; value: unknown }[] = [
  { path: ["version"], value: 2 },
  { path: ["version"], value: "1" },
  { path: ["id"], value: "Cliente_invalido" },
  { path: ["name"], value: "  " },
  { path: ["active"], value: "false" },
  { path: ["timezone"], value: "America/Ficticia" },
  { path: ["timezone"], value: "+03:00" },
  { path: ["whatsapp", "phoneNumberId"], value: 123 },
  { path: ["whatsapp", "phoneNumberId"], value: " id-com-espacos " },
  { path: ["crm"], value: undefined },
  { path: ["crm", "provider"], value: "desconhecido" },
  { path: ["crm", "settings", "spreadsheetId"], value: "" },
  { path: ["calendar", "provider"], value: "desconhecido" },
  { path: ["calendar", "settings", "calendarId"], value: " " },
  { path: ["scheduling"], value: undefined },
  { path: ["scheduling", "durationMinutes"], value: 0 },
  { path: ["scheduling", "durationMinutes"], value: 1.5 },
  { path: ["scheduling", "minNoticeHours"], value: -1 },
  { path: ["scheduling", "daysAhead"], value: 0 },
  { path: ["scheduling", "daysAhead"], value: 1.5 },
  { path: ["scheduling", "serviceQuestion"], value: "inexistente" },
  { path: ["scheduling", "serviceQuestion"], value: "quantity" },
  { path: ["scheduling", "serviceQuestion"], value: "source" },
  { path: ["scheduling", "hours", "monday"], value: [] },
  { path: ["ai", "enabled"], value: "true" },
  { path: ["ai", "knowledge", 0, "topic"], value: "  " },
  { path: ["ai", "knowledge", 0, "text"], value: "" },
  {
    path: ["ai", "knowledge"],
    value: [{ topic: "a", text: "b".repeat(6000) }],
  },
  { path: ["messages", "booked"], value: "Sem marcador de horário" },
  { path: ["qualification", "questions", 0, "options"], value: [] },
  {
    path: ["qualification", "questions", 0, "options", 0, "label"],
    value: "a".repeat(21),
  },
  { path: ["qualification", "questions", 0, "options", 0, "id"], value: "" },
  { path: ["qualification", "questions", 1, "options"], value: [] },
  { path: ["qualification", "questions", 1, "id"], value: "service" },
  { path: ["qualification", "rules", 0, "question"], value: "inexistente" },
  { path: ["qualification", "rules", 0, "question"], value: "source" },
  { path: ["qualification", "rules", 0, "in"], value: undefined },
  { path: ["qualification", "rules", 0, "in"], value: [] },
  { path: ["qualification", "rules", 0, "min"], value: 0 },
  { path: ["qualification", "rules", 0, "max"], value: 5 },
  { path: ["qualification", "rules", 1], value: { question: "quantity" } },
  { path: ["qualification", "rules", 1, "in"], value: ["demo"] },
  { path: ["qualification", "rules", 1, "min"], value: 11 },
  { path: ["qualification", "rules", 1, "min"], value: Number.NaN },
  {
    path: ["qualification", "rules", 1, "max"],
    value: Number.POSITIVE_INFINITY,
  },
  { path: ["qualification", "rules", 1, "min"], value: "0" },
  { path: ["apiKey"], value: "SEGREDO_FICTICIO" },
  { path: ["crm", "settings", "token"], value: "SEGREDO_FICTICIO" },
];

test.each(invalidFields)("rejects invalid field $path", ({ path, value }) => {
  expect(clientConfigSchema.safeParse(change(path, value)).success).toBe(false);
});

test.each(Object.keys(validConfig().messages))("requires message %s", (key) => {
  expect(
    clientConfigSchema.safeParse(change(["messages", key], undefined)).success,
  ).toBe(false);
  expect(
    clientConfigSchema.safeParse(change(["messages", key], " ")).success,
  ).toBe(false);
});

test.each(
  [
    ["9:00-12:00"],
    ["24:00-25:00"],
    ["09:60-12:00"],
    ["12:00-09:00"],
    ["09:00-09:00"],
    ["22:00-02:00"],
    ["14:00-18:00", "09:00-12:00"],
  ].map((hours) => ({ hours })),
)("rejects invalid hours $hours", ({ hours }) => {
  expect(
    clientConfigSchema.safeParse(change(["scheduling", "hours", "mon"], hours))
      .success,
  ).toBe(false);
});

test("accepts adjacent ranges, days closed and fractional notice", () => {
  const config = validConfig();
  if (!config.scheduling) throw new Error("Fixture exige scheduling");
  config.scheduling.hours = { mon: ["00:00-12:00", "12:00-23:59"], sun: [] };
  config.scheduling.minNoticeHours = 0.5;
  delete config.scheduling.serviceQuestion;
  config.timezone = "UTC";
  expect(clientConfigSchema.safeParse(config).success).toBe(true);
});

test.each([
  { min: 0 },
  { max: 0 },
  { min: -0.5, max: 0.5 },
  { min: 2, max: 2 },
])("accepts valid number bounds %j", (bounds) => {
  const config = change(["qualification", "rules", 1], {
    question: "quantity",
    ...bounds,
  });
  expect(clientConfigSchema.safeParse(config).success).toBe(true);
});

test("limits options to ten and labels to twenty characters", () => {
  const options = Array.from({ length: 10 }, (_, i) => ({
    id: i === 0 ? "demo" : `option-${i}`,
    label: "a".repeat(20),
  }));
  expect(
    clientConfigSchema.safeParse(
      change(["qualification", "questions", 0, "options"], options),
    ).success,
  ).toBe(true);
  options.push({ id: "extra", label: "Extra" });
  expect(
    clientConfigSchema.safeParse(
      change(["qualification", "questions", 0, "options"], options),
    ).success,
  ).toBe(false);
});

test("counts topics and texts across the whole AI knowledge base", () => {
  const knowledge = [
    { topic: "a", text: "b".repeat(2999) },
    { topic: "c", text: "d".repeat(2999) },
  ];
  expect(
    clientConfigSchema.safeParse(change(["ai", "knowledge"], knowledge))
      .success,
  ).toBe(true);
  knowledge[1].text += "e";
  expect(
    clientConfigSchema.safeParse(change(["ai", "knowledge"], knowledge))
      .success,
  ).toBe(false);
});

test.each([
  ["whatsapp", "phoneNumberId"],
  ["crm", "settings", "spreadsheetId"],
  ["calendar", "settings", "calendarId"],
])("allows PREENCHER only while inactive (%j)", (...path) => {
  const config = change(path, "PREENCHER");
  expect(clientConfigSchema.safeParse(config).success).toBe(false);
  config.active = false;
  expect(clientConfigSchema.safeParse(config).success).toBe(true);
});

test("requires template configs to be inactive and IDs to match directories", () => {
  const config = validConfig();
  config.id = "_template";
  expect(clientConfigSchema.safeParse(config).success).toBe(false);
  config.active = false;
  expect(validateClientConfigs([{ directory: "_template", config }])).toEqual(
    [],
  );
  expect(validateClientConfigs([{ directory: "other", config }])).toEqual([
    {
      directory: "other",
      path: ["id"],
      message: "ID deve ser igual ao nome da pasta.",
    },
  ]);
  expect(
    validateClientConfigs([
      { directory: "_template", config: validConfig() },
    ]).some((issue) => issue.path[0] === "active"),
  ).toBe(true);
});

test("requires unique phone IDs only among active clients", () => {
  const first = validConfig();
  const second = { ...validConfig(), id: "outro-ficticio" };
  const entries = [
    { directory: first.id, config: first },
    { directory: second.id, config: second },
  ];
  expect(validateClientConfigs(entries)).toEqual([
    {
      directory: second.id,
      path: ["whatsapp", "phoneNumberId"],
      message: "ID do WhatsApp repetido entre clientes ativos.",
    },
  ]);
  second.active = false;
  expect(validateClientConfigs(entries)).toEqual([]);
  first.active = false;
  expect(validateClientConfigs(entries)).toEqual([]);
});

test("reports invalid input without disclosing values", () => {
  const issues = validateClientConfigs([
    {
      directory: "cliente-ficticio",
      config: change(["active"], "VALOR_FICTICIO_PRIVADO"),
    },
  ]);
  expect(issues.length).toBeGreaterThan(0);
  expect(JSON.stringify(issues)).not.toContain("VALOR_FICTICIO_PRIVADO");
});

test("CLI checks folders, rejects missing or malformed configs and uses exit codes", () => {
  const directory = mkdtempSync(join(tmpdir(), "zenvolyx-clients-"));
  try {
    const client = join(directory, "cliente-ficticio");
    mkdirSync(client);
    const script = resolve("scripts/check-clients.ts");
    const run = () =>
      spawnSync(process.execPath, [script, directory], {
        encoding: "utf8",
        timeout: 10_000,
      });
    writeFileSync(join(client, "config.json"), JSON.stringify(fixture()));
    expect(run().status).toBe(0);
    writeFileSync(
      join(client, "config.json"),
      JSON.stringify(fixture("unknown-option")),
    );
    const invalid = run();
    expect(invalid.status).toBe(1);
    expect(invalid.stdout).toContain("qualification");
    expect(invalid.stdout).not.toContain("opcao-inexistente");
    writeFileSync(
      join(client, "config.json"),
      '{"private":"VALOR_FICTICIO_PRIVADO"',
    );
    mkdirSync(join(directory, "missing-config"));
    const malformed = run();
    expect(malformed.status).toBe(1);
    expect(malformed.stdout).toContain("JSON inválido");
    expect(malformed.stdout).toContain("missing-config");
    expect(malformed.stdout).not.toContain("VALOR_FICTICIO_PRIVADO");
    expect(malformed.stderr).toBe("");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("fails for missing or empty client directories", () => {
  const directory = mkdtempSync(join(tmpdir(), "zenvolyx-empty-clients-"));
  try {
    const messages: string[] = [];
    expect(checkClientDirectory(directory, (m) => messages.push(m))).toBe(1);
    expect(
      checkClientDirectory(join(directory, "missing"), (m) => messages.push(m)),
    ).toBe(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("all clients/*/config.json in the repository match version 1", () => {
  const messages: string[] = [];
  expect(
    checkClientDirectory("clients", (m) => messages.push(m)),
    messages.join("\n"),
  ).toBe(0);
});
