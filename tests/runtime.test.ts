import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

test("runs TypeScript ESM imports in Node without a build or loader", () => {
  const directory = mkdtempSync(join(tmpdir(), "zenvolyx-runtime-"));

  try {
    writeFileSync(join(directory, "package.json"), '{"type":"module"}');
    writeFileSync(
      join(directory, "settings.ts"),
      'export type Settings = { project: string };\nexport const project: string = "zenvolyx";\n',
    );
    writeFileSync(
      join(directory, "main.ts"),
      [
        'import { project, type Settings } from "./settings.ts";',
        "const settings: Settings = { project };",
        "console.log(JSON.stringify(settings));",
      ].join("\n"),
    );

    const output = execFileSync(
      process.execPath,
      [join(directory, "main.ts")],
      {
        encoding: "utf8",
        timeout: 10_000,
      },
    );

    expect(JSON.parse(output)).toEqual({ project: "zenvolyx" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
