import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  aiRequest,
  type Context,
  markReadRequest,
  type Plan,
  prepareConversation,
  resolveConversation,
  type State,
  validInput,
} from "../automations/lead-conversation/conversation.js";

const NOW = "2026-09-30T12:00:00.000Z";
const workflow = JSON.parse(
  readFileSync(
    new URL("../automations/lead-conversation/workflow.json", import.meta.url),
    "utf8",
  ),
) as {
  nodes: {
    name: string;
    type: string;
    onError?: string;
    parameters: Record<string, unknown>;
  }[];
  connections: Record<string, { main: { node: string }[][] }>;
  settings: Record<string, unknown>;
};
const workflowNode = (name: string) => {
  const found = workflow.nodes.find((n) => n.name === name);
  if (!found) throw new Error(`Nó ausente: ${name}`);
  return found;
};
function input() {
  return JSON.parse(
    readFileSync(
      new URL("./fixtures/conversation/input.json", import.meta.url),
      "utf8",
    ),
  ) as Pick<Context, "event" | "config">;
}
function row(
  state: State,
  clientId = "odontologia-demo",
  leadId = input().event.leadId,
) {
  return { clientId, leadId, stateJson: JSON.stringify(state) };
}
function prepare(
  previous?: Plan,
  modify?: (request: ReturnType<typeof input>) => void,
) {
  const request = input();
  modify?.(request);
  return prepareConversation(
    request,
    previous ? [row(previous.state)] : [],
    NOW,
  );
}
function ai(
  context: Context,
  intent: string,
  answer: unknown = null,
  reply: unknown = null,
) {
  return resolveConversation(
    { ...context, needsAI: true },
    { ok: true, intent, answer, reply },
  );
}
function choose(previous: Plan, id: string, label: string) {
  return resolveConversation(
    prepare(previous, (i) =>
      Object.assign(i.event, { type: "reply", replyId: id, text: label }),
    ),
  );
}
const first = () => resolveConversation(prepare());

describe("autorização da IA na demo", () => {
  const synthetic = () =>
    prepare(undefined, (i) => {
      i.config.ai = { enabled: true, dataMode: "synthetic", knowledge: [] };
    });
  test("exige enabled e indicação explícita de dados fictícios", () => {
    const ctx = synthetic();
    expect(aiRequest(ctx)).toMatchObject({
      action: "interpret",
      dataMode: "synthetic",
    });
    if (!ctx.config.ai) throw new Error("Config AI ausente");
    delete ctx.config.ai.dataMode;
    expect(aiRequest(ctx)).toBeNull();
    ctx.config.ai.dataMode = "synthetic";
    ctx.config.ai.enabled = false;
    expect(aiRequest(ctx)).toBeNull();
    delete ctx.config.ai;
    expect(aiRequest(ctx)).toBeNull();
  });
  test("envia somente o contrato administrativo sem identidade nem histórico", () => {
    const ctx = synthetic();
    expect(aiRequest(ctx)).toEqual({
      action: "interpret",
      clientId: ctx.config.id,
      dataMode: "synthetic",
      business: { name: ctx.config.name, knowledge: [] },
      question: ctx.question,
      message: ctx.event.text,
    });
  });
  test("botão isolado, mídia e estado inválido não chamam IA", () => {
    const ctx = synthetic();
    ctx.directAnswer = "implant";
    expect(aiRequest(ctx)).toBeNull();
    ctx.directAnswer = null;
    ctx.event.type = "unsupported";
    expect(aiRequest(ctx)).toBeNull();
    ctx.event.type = "text";
    ctx.stateError = true;
    expect(aiRequest(ctx)).toBeNull();
  });
  test("não aceita uma config antiga no ponto de entrada", () => {
    const request = input();
    Object.assign(request.config, { version: 2 });
    expect(validInput(request)).toBe(false);
  });
});

describe("conversa guiada", () => {
  test("primeiro contato cria CRM talking e uma lista com boas-vindas", () => {
    const plan = first();
    expect(plan.state.stage).toBe("talking");
    expect(plan.state.failures).toBe(0);
    expect(plan.crm).toHaveLength(1);
    expect(plan.outbound).toMatchObject({
      action: "sendList",
      listButton: "Ver opções",
    });
    expect(plan.outbound?.text).toContain(input().config.messages.welcome);
    expect(plan.outbound?.options?.[0].id).toBe("procedure:implant");
  });
  test("botão avança sem IA e apresenta a pergunta de três opções ou menos", () => {
    const plan = choose(first(), "procedure:implant", "Implante");
    expect(plan.state.answers).toEqual({ procedure: "implant" });
    expect(plan.state.questionIndex).toBe(1);
    expect(plan.outbound?.action).toBe("sendButtons");
    expect(plan.outbound?.text).not.toContain(input().config.messages.welcome);
    expect(plan.crm).toHaveLength(0);
  });
  test("botão antigo não responde outra pergunta", () => {
    const second = choose(first(), "procedure:implant", "Implante");
    const plan = choose(second, "procedure:implant", "Implante");
    expect(plan.state.questionIndex).toBe(1);
    expect(plan.state.failures).toBe(1);
    expect(plan.state.answers).not.toHaveProperty("patient");
  });
  test("mensagem inicial que responde pula a primeira pergunta", () => {
    const plan = ai(
      prepare(),
      "answer",
      "cleaning",
      "Nosso endereço é fictício.",
    );
    expect(plan.state.answers).toEqual({ procedure: "cleaning" });
    expect(plan.outbound?.text).toContain("Nosso endereço é fictício.");
    expect(plan.outbound?.text).toContain("primeira consulta");
  });
  test("qualificado sem agenda registra qualified e encaminha para a equipe", () => {
    const plan = choose(
      choose(first(), "procedure:implant", "Implante"),
      "patient:new",
      "Sim, primeira vez",
    );
    expect(plan.crm.map((r) => (r.lead as { stage: string }).stage)).toEqual([
      "qualified",
      "with_team",
    ]);
    expect(plan.pause?.reason).toBe("handoff");
    expect(plan.state.answers).toEqual({
      procedure: "implant",
      patient: "new",
    });
  });
  test("paciente recorrente encerra como not_qualified", () => {
    const plan = choose(
      choose(first(), "procedure:implant", "Implante"),
      "patient:returning",
      "Já sou paciente",
    );
    expect(plan.state.stage).toBe("not_qualified");
    expect(plan.outbound?.text).toBe(input().config.messages.notQualified);
    expect(plan.pause).toBeNull();
  });
  test("com agenda, qualificação entrega o ponto de continuação da T029 sem inventar horários", () => {
    const previous = choose(first(), "procedure:implant", "Implante");
    const ctx = prepare(previous, (i) => {
      Object.assign(i.event, {
        type: "reply",
        replyId: "patient:new",
        text: "Sim, primeira vez",
      });
      i.config.calendar = {
        provider: "google-calendar",
        settings: { calendarId: "agenda-ficticia" },
      };
      i.config.scheduling = {
        durationMinutes: 60,
        minNoticeHours: 2,
        daysAhead: 14,
        hours: { mon: ["09:00-12:00"] },
      };
    });
    const plan = resolveConversation(ctx);
    expect(plan.state.stage).toBe("qualified");
    expect(plan.readyForScheduling).toBe(true);
    expect(plan.state.offeredSlots).toEqual([]);
    expect(plan.outbound).toBeNull();
  });
  test("regras numéricas são inclusivas e o CRM recebe texto", () => {
    for (const value of [9, 10, 20, 21]) {
      const ctx = prepare(undefined, (i) => {
        i.config.qualification = {
          questions: [
            { id: "amount", type: "number", text: "Quantas unidades?" },
          ],
          rules: [{ question: "amount", min: 10, max: 20 }],
        };
        i.event.text = String(value);
      });
      const plan = resolveConversation(ctx);
      expect(plan.state.answers.amount).toBe(value);
      expect(plan.state.stage).toBe(
        value >= 10 && value <= 20 ? "with_team" : "not_qualified",
      );
      expect(
        (
          plan.crm[plan.crm.length - 1].lead as {
            answers: { answer: string }[];
          }
        ).answers[0].answer,
      ).toBe(String(value));
    }
  });
});

describe("saúde, parada e fallback", () => {
  test.each([
    "talking",
    "qualified",
    "not_qualified",
    "scheduled",
    "with_team",
    "urgent",
  ])("urgência interrompe a etapa %s sem texto da IA", (stage) => {
    const previous = first();
    previous.state.stage = stage;
    const plan = ai(
      prepare(previous),
      "urgent",
      "Dado sensível",
      "Texto clínico indevido",
    );
    expect(plan.outbound?.text).toBe(input().config.messages.urgent);
    expect(plan.outbound?.options).toBeUndefined();
    expect(plan.state.stage).toBe("urgent");
    expect(plan.pause).toMatchObject({
      reason: "urgent",
      pausedUntil: "2026-10-01T12:00:00.000Z",
    });
    expect(JSON.stringify(plan)).not.toContain("Texto clínico indevido");
  });
  test("stop descarta answer/reply e registra recusa", () => {
    const plan = ai(prepare(), "stop", "qualquer", "não enviar");
    expect(plan.state.declined).toBe(true);
    expect(plan.state.stage).toBe("stopped");
    expect(plan.outbound?.text).toBe(input().config.messages.stopped);
    expect(plan.pause?.reason).toBe("stop");
  });
  test("human inclui a ausência da informação e a mensagem fixa", () => {
    const plan = ai(prepare(), "human", null, "Não tenho essa informação.");
    expect(plan.state.stage).toBe("with_team");
    expect(plan.outbound?.text).toContain("Não tenho essa informação.");
    expect(plan.outbound?.text).toContain(input().config.messages.handoff);
  });
  test("áudio e mídia vão direto para a equipe", () => {
    const plan = resolveConversation(
      prepare(undefined, (i) => {
        i.event.type = "unsupported";
        i.event.text = null;
      }),
    );
    expect(plan.state.stage).toBe("with_team");
  });
  test("duas falhas de IA consecutivas encaminham com texto fixo", () => {
    const one = resolveConversation(
      { ...prepare(), needsAI: true },
      { ok: false, error: { code: "unavailable" } },
    );
    expect(one.state.failures).toBe(1);
    expect(one.outbound?.action).toBe("sendList");
    const two = resolveConversation(
      { ...prepare(one), needsAI: true },
      { ok: false },
    );
    expect(two.state.stage).toBe("with_team");
    expect(two.outbound?.text).toBe(input().config.messages.failure);
  });
  test("duas respostas sem escolha encaminham, resposta válida zera falhas", () => {
    const one = ai(prepare(first()), "other");
    expect(one.state.failures).toBe(1);
    expect(ai(prepare(one), "other").state.stage).toBe("with_team");
    expect(choose(one, "procedure:implant", "Implante").state.failures).toBe(0);
  });
  test.each([
    undefined,
    { ok: true, intent: "answer", answer: "inventado", reply: null },
    { ok: true, intent: "question", answer: null, reply: "x".repeat(401) },
  ])("saída de IA inválida usa fallback sem vazar resposta", (value) => {
    const plan = resolveConversation({ ...prepare(), needsAI: true }, value);
    expect(plan.state.failures).toBe(1);
    expect(plan.state.answers).toEqual({});
  });
  test("rajada com botão e texto de urgência não pula IA", () => {
    const ctx = prepare(first(), (i) =>
      Object.assign(i.event, {
        type: "reply",
        replyId: "procedure:implant",
        text: "Implante\nEstou com muita dor",
        messageIds: ["wamid.1", "wamid.2"],
      }),
    );
    expect(ctx.directAnswer).toBeNull();
    expect(markReadRequest(ctx).messageId).toBe("wamid.2");
    expect(ai(ctx, "urgent").state.stage).toBe("urgent");
  });
  test.each(["pare", "PARAR!", "não quero mais mensagens"])(
    "pedido explícito %s funciona sem IA",
    (message) => {
      const plan = resolveConversation(
        prepare(undefined, (i) => {
          i.event.text = message;
        }),
      );
      expect(plan.state.stage).toBe("stopped");
    },
  );
});

describe("estado, isolamento e dados", () => {
  test("não usa estado de outro cliente ou outro lead", () => {
    const state = first().state;
    state.stage = "urgent";
    const ctx = prepareConversation(
      input(),
      [row(state, "outro"), row(state, "odontologia-demo", "outro")],
      NOW,
    );
    expect(ctx.isNew).toBe(true);
    expect(ctx.state.stage).toBe("talking");
  });
  test("estado expirado recomeça após 30 dias", () => {
    const state = first().state;
    state.lastContactAt = "2026-08-01T00:00:00Z";
    expect(prepareConversation(input(), [row(state)], NOW).isNew).toBe(true);
  });
  test("recusa anterior permite novo contato entregue após a pausa", () => {
    const stopped = ai(prepare(), "stop");
    const plan = resolveConversation(prepare(stopped));
    expect(plan.state.stage).toBe("talking");
    expect(plan.state.declined).toBe(false);
  });
  test("após encerramento responde dúvidas sem reabrir questionário", () => {
    const prior = first();
    prior.state.stage = "not_qualified";
    const plan = ai(
      prepare(prior),
      "question",
      null,
      "Funcionamos em horário fictício.",
    );
    expect(plan.outbound?.action).toBe("sendText");
    expect(plan.state.stage).toBe("not_qualified");
    expect(plan.state.failures).toBe(0);
  });
  test("estado corrompido ou duplicado chama equipe e não expõe conteúdo", () => {
    const request = input();
    for (const rows of [
      [
        {
          clientId: request.config.id,
          leadId: request.event.leadId,
          stateJson: "segredo",
        },
      ],
      [row(first().state), row(first().state)],
    ]) {
      const plan = resolveConversation(prepareConversation(request, rows, NOW));
      expect(plan.state.stage).toBe("with_team");
      expect(JSON.stringify(plan)).not.toContain("segredo");
    }
  });
  test("texto bruto, nome, telefone e ID do lead não entram no estado/logs", () => {
    const ctx = prepare(undefined, (i) => {
      i.event.text = "mensagem privada";
      i.event.name = "Pessoa Fictícia";
      i.event.phone = "5500000000028";
    });
    const plan = ai(ctx, "urgent");
    const saved = JSON.stringify({ state: plan.state, logs: plan.logs });
    for (const value of [
      ctx.event.text,
      ctx.event.name,
      ctx.event.phone,
      ctx.event.leadId,
    ])
      expect(saved).not.toContain(value);
    expect(plan.crm[0]).toMatchObject({
      lead: { phone: "5500000000028", name: "Pessoa Fictícia" },
    });
  });
  test.each(["clientId", "leadId", "channel", "receivedAt", "messageIds"])(
    "rejeita evento com %s inválido",
    (key) => {
      const request = input();
      Object.assign(request.event, { [key]: null });
      expect(validInput(request)).toBe(false);
    },
  );
  test("não modifica entrada nem estado anterior", () => {
    const ctx = prepare(first());
    const before = structuredClone(ctx);
    ai(ctx, "answer", "implant");
    expect(ctx).toEqual(before);
  });
});

describe("workflow n8n", () => {
  test("entrada chama a conversa após juntar a rajada e não persiste execuções", () => {
    const inbound = JSON.parse(
      readFileSync(
        new URL(
          "../automations/whatsapp-inbound/workflow.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(inbound.connections["Burst event"].main[0][0].node).toBe(
      "Lead conversation",
    );
    expect(
      inbound.nodes.find(
        (n: { name: string }) => n.name === "Lead conversation",
      ).parameters.workflowId.value,
    ).toBe("leadConversation");
    expect(inbound.settings).toMatchObject({
      saveDataErrorExecution: "none",
      saveDataSuccessExecution: "none",
      saveManualExecutions: false,
      saveExecutionProgress: false,
    });
  });
  test("funções executadas no n8n são as mesmas testadas", () => {
    const source = readFileSync(
      new URL(
        "../automations/lead-conversation/conversation.js",
        import.meta.url,
      ),
      "utf8",
    ).replaceAll("export function ", "function ");
    for (const name of [
      "Validate",
      "Prepare",
      "Resolve",
      "Failed delivery CRM",
    ]) {
      expect(
        String(workflowNode(name).parameters.jsCode).startsWith(source),
      ).toBe(true);
    }
  });
  test("não salva nenhuma execução e não contém credenciais", () => {
    expect(workflow.settings).toMatchObject({
      saveDataErrorExecution: "none",
      saveDataSuccessExecution: "none",
      saveManualExecutions: false,
      saveExecutionProgress: false,
    });
    for (const node of workflow.nodes)
      expect(node).not.toHaveProperty("credentials");
  });
  test("conectores capturam falhas e tabelas são isoladas por cliente/lead", () => {
    for (const name of ["Mark read", "Interpret", "Update CRM", "Send message"])
      expect(workflowNode(name).onError).toBe("continueRegularOutput");
    for (const name of ["Read state", "Save state"]) {
      const node = workflowNode(name);
      expect(node.parameters.matchType).toBe("allConditions");
      expect(node.parameters.filters).toMatchObject({
        conditions: [{ keyName: "clientId" }, { keyName: "leadId" }],
      });
    }
  });
  test("falha de estado interrompe efeitos; falha de envio grava pausa e CRM", () => {
    expect(workflow.connections["State saved"].main[1][0].node).toBe(
      "Storage failure",
    );
    expect(workflow.connections.Delivered.main[1][0].node).toBe(
      "Save failed delivery",
    );
    expect(workflow.connections["Failed pause request"].main[0][0].node).toBe(
      "Pause failed delivery",
    );
    expect(workflow.connections["Failed CRM request"].main[0][0].node).toBe(
      "Update failed delivery CRM",
    );
  });
  test("limpeza filtra pela última interação e não apaga registros recentes", () => {
    expect(workflowNode("Delete old conversations").parameters.filters).toEqual(
      {
        conditions: [
          {
            keyName: "lastContactAt",
            condition: "lt",
            keyValue: "={{ $now.minus({days:30}).toISO() }}",
          },
        ],
      },
    );
  });
});
