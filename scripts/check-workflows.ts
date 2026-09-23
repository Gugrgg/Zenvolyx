import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

type JsonObject = Record<string, unknown>;
export type WorkflowIssue = {
  workflow: number;
  node: number | null;
  reason: string;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:token|password|passwd|secret|apikey|privatekey|authorization|cookie)$/.test(
    normalized,
  );
}

function isExternalReference(value: string): boolean {
  return /^=?\{\{\s*\$(?:env|vars|credentials)(?:\.[A-Za-z_][\w]*|\[['"][\w]+['"]\])\s*\}\}$/.test(
    value.trim(),
  );
}

function hasLiteralValue(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    !(typeof value === "string" && isExternalReference(value))
  );
}

function hasEmbeddedSecret(value: string): boolean {
  return (
    /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/i.test(value) ||
    /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/.test(value) ||
    /\b(?:sk-(?:ant-)?[\w-]{16,}|EA[A-Za-z0-9]{30,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(
      value,
    ) ||
    /https?:\/\/[^\s/@:]+:[^\s/@]+@/i.test(value) ||
    /[?&](?:[\w-]*(?:token|secret|password)|api[_-]?key|key|signature|sig)=[^\s&#'"}]+/i.test(
      value,
    ) ||
    /\b(?:[\w-]*(?:token|password|secret)|api[_-]?key|authorization)['"]?\s*[:=]\s*['"][^'"\r\n]+['"]/i.test(
      value,
    )
  );
}

/** Verificação estática: mensagens nunca incluem valores ou nomes dos nós. */
export function checkWorkflows(data: unknown): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const workflows = Array.isArray(data) ? data : [data];
  if (workflows.length === 0) {
    return [{ workflow: 1, node: null, reason: "Exportação vazia." }];
  }

  workflows.forEach((workflow, workflowIndex) => {
    const report = (node: number | null, reason: string) => {
      issues.push({ workflow: workflowIndex + 1, node, reason });
    };
    if (
      !isObject(workflow) ||
      !Array.isArray(workflow.nodes) ||
      !workflow.nodes.every(
        (node) =>
          isObject(node) &&
          typeof node.name === "string" &&
          typeof node.type === "string",
      ) ||
      !isObject(workflow.connections)
    ) {
      report(null, "Estrutura de workflow inválida (nodes/connections).");
      return;
    }

    const visit = (value: unknown, node: number | null): void => {
      if (typeof value === "string") {
        // HTTP Request pode guardar um corpo JSON como texto.
        let decoded: unknown;
        try {
          decoded = JSON.parse(value);
        } catch {
          // Texto livre não precisa ser JSON; os padrões abaixo também o verificam.
        }
        if (isObject(decoded) || Array.isArray(decoded)) {
          visit(decoded, node);
        } else if (hasEmbeddedSecret(value)) {
          report(node, "Possível segredo embutido em texto, código ou URL.");
        }
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) visit(item, node);
        return;
      }
      if (!isObject(value)) return;

      // Headers, query parameters e body parameters do HTTP Request.
      if (
        typeof value.name === "string" &&
        isSensitiveKey(value.name) &&
        hasLiteralValue(value.value)
      ) {
        report(node, "Parâmetro sensível contém valor literal.");
      }
      for (const [key, child] of Object.entries(value)) {
        const normalized = key.toLowerCase();
        if (normalized === "credentials" || normalized === "pindata") {
          report(node, `Campo ${normalized} proibido na exportação.`);
          continue;
        }
        if (isSensitiveKey(key) && hasLiteralValue(child)) {
          report(node, "Campo sensível contém valor literal.");
        }
        visit(child, node);
      }
    };

    for (const [key, value] of Object.entries(workflow)) {
      if (key === "nodes") {
        workflow.nodes.forEach((node, index) => {
          visit(node, index + 1);
        });
      } else {
        visit({ [key]: value }, null);
      }
    }
  });
  return issues;
}

function collectFiles(path: string): string[] {
  if (statSync(path).isFile() && extname(path).toLowerCase() === ".json") {
    return [path];
  }
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return collectFiles(child);
    return entry.isFile() && extname(entry.name).toLowerCase() === ".json"
      ? [child]
      : [];
  });
}

export function runCheck(
  paths: string[],
  log: (message: string) => void = console.log,
): number {
  const files = new Set<string>();
  let failed = false;
  for (const path of paths) {
    try {
      for (const file of collectFiles(resolve(path))) files.add(file);
    } catch {
      log(`${JSON.stringify(path)}: não foi possível ler o caminho.`);
      failed = true;
    }
  }
  for (const file of [...files].sort()) {
    const label = JSON.stringify(relative(process.cwd(), file));
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      log(`${label}: arquivo ilegível ou JSON inválido.`);
      failed = true;
      continue;
    }
    for (const issue of checkWorkflows(data)) {
      const location =
        issue.node === null ? "raiz do workflow" : `nó #${issue.node}`;
      log(
        `${label}: workflow #${issue.workflow}, ${location}: ${issue.reason}`,
      );
      failed = true;
    }
  }
  log(
    `${files.size} arquivo(s) verificado(s); ${failed ? "corrija os problemas antes de commitar" : "nenhum problema detectado"}.`,
  );
  return failed ? 1 : 0;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  process.exitCode = runCheck(
    args.length > 0 ? args : ["automations", "integrations"],
  );
}
