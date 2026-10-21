import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

export type Row = Record<string, unknown>;
type Item = { json: Row };
type Parameters = {
  jsCode?: string;
  conditions?: {
    combinator: string;
    conditions: {
      leftValue: string;
      operator: { operation: string; type: string };
    }[];
  };
  resource?: string;
  operation?: string;
  tableName?: string;
  dataTableId?: { value: string };
  matchType?: string;
  filters?: {
    conditions: { keyName: string; condition: string; keyValue: unknown }[];
  };
  columns?: { value: Row };
  workflowId?: { value: string };
  source?: string;
  mode?: string;
};
type Workflow = {
  nodes: {
    name: string;
    type: string;
    alwaysOutputData?: boolean;
    parameters: Parameters;
  }[];
  connections: Record<string, { main: { node: string }[][] }>;
};
const workflow = JSON.parse(
  readFileSync(
    new URL("../automations/lead-conversation/workflow.json", import.meta.url),
    "utf8",
  ),
) as Workflow;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// Apenas o caminho sequencial da conversa: não substitui o motor n8n nem testa concorrência.
// Nós/operadores desconhecidos falham; não há implementação de HTTP ou conectores reais.
export class ScenarioWorkflow {
  readonly tables = new Map<string, Row[]>();
  readonly logs: string[] = [];
  private nextId = 1;
  private execution = 0;

  private readonly connector: (workflowId: string, request: Row) => Row;

  constructor(connector: (workflowId: string, request: Row) => Row) {
    this.connector = connector;
  }

  rows(name: string): Row[] {
    const rows = this.tables.get(name);
    if (!rows) throw new Error(`Tabela não criada: ${name}`);
    return rows;
  }

  run(input: Row): Row {
    this.execution++;
    const outputs = new Map<string, Item[]>();
    let items: Item[] = [{ json: clone(input) }];
    let current: string | undefined = "Start";
    let visited = 0;
    while (current) {
      if (++visited > 120) throw new Error("Ciclo inesperado no cenário");
      const node = workflow.nodes.find((entry) => entry.name === current);
      if (!node) throw new Error(`Nó ausente: ${current}`);
      const p = node.parameters;
      const access = (values: Item[]) => ({
        first: () => values[0],
        all: () => values,
      });
      const bindings = {
        Date,
        $json: items[0]?.json,
        $input: access(items),
        $execution: { id: `scenario-${this.execution}` },
        $now: { toISO: () => new Date().toISOString() },
        $: (name: string) => {
          const result = outputs.get(name);
          if (!result) throw new Error(`Nó ainda não executado: ${name}`);
          return access(result);
        },
        console: { log: (value: string) => this.logs.push(value) },
      };
      const evaluate = (value: unknown): unknown =>
        typeof value === "string" &&
        value.startsWith("={{") &&
        value.endsWith("}}")
          ? runInNewContext(`(${value.slice(3, -2)})`, bindings, {
              timeout: 1000,
            })
          : value;
      let branch = 0;
      switch (node.type) {
        case "n8n-nodes-base.executeWorkflowTrigger":
          break;
        case "n8n-nodes-base.code":
          if (!p.jsCode) throw new Error("Code vazio");
          items = clone(
            runInNewContext(`(function(){${p.jsCode}\n})()`, bindings, {
              timeout: 1000,
            }),
          );
          break;
        case "n8n-nodes-base.if": {
          const condition = p.conditions?.conditions[0];
          if (
            p.conditions?.combinator !== "and" ||
            p.conditions.conditions.length !== 1 ||
            condition?.operator.type !== "boolean" ||
            condition.operator.operation !== "true"
          )
            throw new Error(`Condição não suportada: ${current}`);
          branch = evaluate(condition.leftValue) === true ? 0 : 1;
          break;
        }
        case "n8n-nodes-base.dataTable": {
          if (
            p.resource === "table" &&
            p.operation === "create" &&
            p.tableName
          ) {
            if (!this.tables.has(p.tableName)) this.tables.set(p.tableName, []);
            items = [{ json: { name: p.tableName } }];
            break;
          }
          if (p.resource !== "row" || !p.dataTableId)
            throw new Error("Tabela não suportada");
          if (p.matchType && p.matchType !== "allConditions")
            throw new Error("Filtro não suportado");
          const rows = this.rows(p.dataTableId.value);
          const matching = rows.filter((row) =>
            (p.filters?.conditions ?? []).every((filter) => {
              const expected = evaluate(filter.keyValue);
              const actual = row[filter.keyName];
              if (filter.condition === "eq") return actual === expected;
              if (
                filter.condition === "gt" &&
                typeof actual === "string" &&
                typeof expected === "string"
              )
                return actual > expected;
              throw new Error(`Operador não suportado: ${filter.condition}`);
            }),
          );
          if (p.operation === "get")
            items = matching.map((json) => ({ json: clone(json) }));
          else if (p.operation === "insert" || p.operation === "upsert") {
            if (!p.columns?.value) throw new Error("Colunas ausentes");
            const values = Object.fromEntries(
              Object.entries(p.columns.value).map(([key, value]) => [
                key,
                evaluate(value),
              ]),
            );
            const row = p.operation === "upsert" ? matching[0] : undefined;
            if (row) Object.assign(row, clone(values));
            else
              rows.push({
                id: this.nextId++,
                createdAt: new Date().toISOString(),
                ...clone(values),
              });
            items = [{ json: clone(row ?? rows[rows.length - 1]) }];
          } else if (p.operation === "deleteRows") {
            this.tables.set(
              p.dataTableId.value,
              rows.filter((row) => !matching.includes(row)),
            );
            items = [{ json: { success: true } }];
          } else throw new Error(`Operação não suportada: ${p.operation}`);
          break;
        }
        case "n8n-nodes-base.executeWorkflow": {
          const id = p.workflowId?.value;
          if (!id || p.source !== "database" || p.mode !== "each")
            throw new Error("Subworkflow não suportado");
          items = items.map(({ json }) => ({
            json: clone(this.connector(id, clone(json))),
          }));
          break;
        }
        default:
          throw new Error(`Tipo não suportado: ${node.type}`);
      }
      if (items.length === 0 && node.alwaysOutputData) items = [{ json: {} }];
      outputs.set(current, clone(items));
      const next: { node: string }[] =
        workflow.connections[current]?.main[branch] ?? [];
      if (next.length > 1)
        throw new Error("Ramificação paralela não suportada");
      current = items.length ? next[0]?.node : undefined;
    }
    if (!outputs.has("Report")) throw new Error("Fluxo terminou sem Report");
    return items[0].json;
  }
}
