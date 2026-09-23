import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ClientConfigEntry,
  validateClientConfigs,
} from "./client-config-schema.ts";

export function checkClientDirectory(
  directory = "clients",
  log: (message: string) => void = console.log,
): number {
  const entries: ClientConfigEntry[] = [];
  let failed = false;
  let folders: string[];
  try {
    folders = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    log(
      `${JSON.stringify(directory)}: não foi possível ler a pasta de clientes.`,
    );
    return 1;
  }
  if (folders.length === 0) {
    log(`${JSON.stringify(directory)}: nenhuma pasta de cliente encontrada.`);
    return 1;
  }
  for (const folder of folders) {
    try {
      const config: unknown = JSON.parse(
        readFileSync(join(directory, folder, "config.json"), "utf8"),
      );
      entries.push({ directory: folder, config });
    } catch {
      log(
        `${JSON.stringify(join(directory, folder, "config.json"))}: arquivo ausente, ilegível ou JSON inválido.`,
      );
      failed = true;
    }
  }
  for (const issue of validateClientConfigs(entries)) {
    const file = JSON.stringify(
      join(directory, issue.directory, "config.json"),
    );
    const path = JSON.stringify(issue.path);
    log(`${file}: campo ${path}: ${issue.message}`);
    failed = true;
  }
  log(
    `${folders.length} configuração(ões) verificada(s); ${failed ? "corrija os problemas antes de ativar clientes" : "nenhum problema detectado"}.`,
  );
  return failed ? 1 : 0;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length > 1) {
    console.error("Uso: npm run check:clients -- [pasta-de-clientes]");
    process.exitCode = 1;
  } else {
    process.exitCode = checkClientDirectory(args[0]);
  }
}
