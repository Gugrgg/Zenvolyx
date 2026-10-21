import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  Context,
  Slot,
  State,
} from "../automations/lead-conversation/conversation.js";
import { type Row, ScenarioWorkflow } from "./scenario-workflow.ts";

type Step = {
  text?: string;
  select?: string;
  ai?: { intent: string; answer?: string; reply?: string };
  stage: string;
  question?: string;
  message?: string;
  occupy?: boolean;
  skipped?: boolean;
  burst?: boolean;
};
type Scenario = {
  id: number;
  name: string;
  service?: string;
  pause?: string;
  crmStages: string[];
  steps: Step[];
};
type Outbound = Row & {
  action: string;
  text: string;
  options?: { id: string; label: string }[];
};
const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/scenarios/demo.json", import.meta.url),
    "utf8",
  ),
) as Scenario[];
const NOW = "2026-10-21T12:00:00.000Z";
const LEAD = "BR.0000000000000000041";
const NAME = "Pessoa Fictícia T041";
const slots: Slot[] = [
  {
    start: "2026-10-22T12:00:00.000Z",
    end: "2026-10-22T13:00:00.000Z",
    label: "Qui 22/10 09:00",
  },
  {
    start: "2026-10-22T13:00:00.000Z",
    end: "2026-10-22T14:00:00.000Z",
    label: "Qui 22/10 10:00",
  },
  {
    start: "2026-10-22T14:00:00.000Z",
    end: "2026-10-22T15:00:00.000Z",
    label: "Qui 22/10 11:00",
  },
];

function demoConfig(): Context["config"] {
  const config = JSON.parse(
    readFileSync(
      new URL("../clients/odontologia-demo/config.json", import.meta.url),
      "utf8",
    ),
  ) as Context["config"];
  config.active = true;
  config.whatsapp = {
    phoneNumberId: "000000000041001",
    gatewayWorkflowId: "demoGateway00001",
  };
  config.crm = {
    provider: "google-sheets",
    settings: { spreadsheetId: "planilha-ficticia-t041" },
  };
  config.calendar = {
    provider: "google-calendar",
    settings: { calendarId: "agenda-ficticia-t041" },
  };
  if (!config.ai) throw new Error("Demo sem base da IA");
  config.ai.enabled = true;
  return config;
}

function runScenario(scenario: Scenario) {
  const config = demoConfig();
  const calls: { id: string; request: Row }[] = [];
  const sent: Outbound[] = [];
  const crm: Row[] = [];
  const booked: Row[] = [];
  const occupied = new Set<string>();
  let pendingAI: Step["ai"];
  let lastState: State | undefined;
  const engine = new ScenarioWorkflow((id, request) => {
    calls.push({ id, request });
    expect(request.clientId).toBe(config.id);
    switch (id) {
      case "aiGeminiDemo0001": {
        if (!pendingAI)
          throw new Error("Chamada de IA não prevista no cenário");
        expect(request).toMatchObject({
          action: "interpret",
          dataMode: "synthetic",
          business: { knowledge: config.ai?.knowledge },
        });
        expect(JSON.stringify(request)).not.toContain(LEAD);
        expect(JSON.stringify(request)).not.toContain(NAME);
        const result = { ok: true, answer: null, reply: null, ...pendingAI };
        pendingAI = undefined;
        return result;
      }
      case "crmUpsertRouter1":
        expect(request).toMatchObject({
          action: "upsertLead",
          crm: config.crm,
          lead: { id: LEAD, name: NAME },
        });
        crm.push(request.lead as Row);
        return { ok: true };
      case "calendarRouter01": {
        expect(request.calendar).toEqual(config.calendar);
        if (request.action === "listSlots") {
          expect(request).toMatchObject({
            limit: 9,
            scheduling: config.scheduling,
            timezone: config.timezone,
          });
          return {
            ok: true,
            slots: slots.filter((slot) => !occupied.has(slot.start)),
          };
        }
        expect(request.action).toBe("book");
        const slot = request.slot as Slot;
        expect(
          slots.some(
            (offered) =>
              offered.start === slot.start && offered.end === slot.end,
          ),
        ).toBe(true);
        expect(request).toMatchObject({
          service: scenario.service,
          lead: { id: LEAD, name: NAME, phone: null },
        });
        if (occupied.has(slot.start))
          return { ok: false, error: { code: "slot_taken" } };
        occupied.add(slot.start);
        booked.push(request);
        return { ok: true, eventId: `evento-ficticio-${booked.length}` };
      }
      case "whatsappCloudApi":
        expect(request).toMatchObject(config.whatsapp);
        if (request.action === "markRead") return { ok: true };
        expect(["sendText", "sendButtons", "sendList"]).toContain(
          request.action,
        );
        expect(request.leadId).toBe(LEAD);
        sent.push(request as Outbound);
        return { ok: true };
      default:
        throw new Error(`Conector não simulado: ${id}`);
    }
  });

  for (const [index, step] of scenario.steps.entries()) {
    if (step.skipped) vi.setSystemTime(Date.parse(NOW) + (24 * 60 - 1) * 60000);
    const previous = sent.at(-1);
    const option =
      step.select === "firstSlot"
        ? previous?.options?.find(
            (item) => item.id.startsWith("slot:") && item.id !== "slot:none",
          )
        : previous?.options?.find((item) => item.id === step.select);
    if (step.select && !option)
      throw new Error(`Opção não oferecida: ${step.select}`);
    if (step.occupy) {
      if (!option) throw new Error("Conflito sem horário escolhido");
      occupied.add(new Date(Number(option.id.split(":")[1])).toISOString());
    }
    const event: Context["event"] = {
      clientId: config.id,
      channel: "whatsapp",
      leadId: LEAD,
      phone: null,
      name: NAME,
      messageIds: [
        `wamid.T041.${index}`,
        ...(step.burst ? [`wamid.T041.${index}.extra`] : []),
      ],
      type: option ? "reply" : "text",
      text: step.text ?? option?.label ?? null,
      replyId: option?.id ?? null,
      receivedAt: new Date().toISOString(),
    };
    pendingAI = step.ai;
    const callStart = calls.length;
    const sentStart = sent.length;
    const bookStart = booked.length;
    const result = engine.run({ config, event });
    const turnCalls = calls.slice(callStart);
    expect(
      pendingAI,
      `IA não consultada no passo ${index + 1}`,
    ).toBeUndefined();
    expect(result).toMatchObject({ ok: true, skipped: step.skipped ?? false });
    lastState = JSON.parse(
      String(engine.rows("lead_conversations")[0].stateJson),
    ) as State;
    expect(lastState.stage).toBe(step.stage);
    expect(engine.rows("lead_conversation_turns")).toEqual([]);
    if (step.skipped) {
      expect(result.stage).toBeNull();
      expect(turnCalls).toEqual([]);
      expect(sent.length).toBe(sentStart);
      continue;
    }
    expect(result.stage).toBe(step.stage);
    expect(
      sent.length - sentStart,
      "Uma resposta por turno, inclusive rajadas",
    ).toBe(1);
    expect(
      turnCalls
        .filter((call) => call.request.action === "markRead")
        .map((call) => call.request.messageId),
    ).toEqual([event.messageIds.at(-1)]);
    const outbound = sent[sentStart];
    if (step.ai?.reply && !["urgent", "stop"].includes(step.ai.intent))
      expect(outbound.text).toContain(step.ai.reply);
    if (step.question) {
      const question = config.qualification.questions.find(
        (item) => item.id === step.question,
      );
      if (question?.type !== "choice") throw new Error("Pergunta ausente");
      expect(outbound.text).toContain(question.text);
      expect(outbound.action).toBe(
        question.options.length > 3 ? "sendList" : "sendButtons",
      );
      expect(outbound.options).toEqual(
        question.options.map((item) => ({
          id: `${question.id}:${item.id}`,
          label: item.label,
        })),
      );
      expect(lastState.questionIndex).toBe(
        config.qualification.questions.indexOf(question),
      );
    }
    if (step.message) {
      const template = (config.messages as Record<string, string>)[
        step.message
      ];
      expect(template).toBeDefined();
      expect(outbound.text).toContain(
        step.message === "booked"
          ? template.replaceAll("{slot}", option?.label ?? "MISSING")
          : template,
      );
    }
    if (["urgent", "stopped", "not_qualified"].includes(step.stage)) {
      expect(outbound.action).toBe("sendText");
      expect(outbound.options).toBeUndefined();
      expect(outbound.text).toBe(
        (config.messages as Record<string, string>)[step.message ?? ""],
      );
      expect(
        turnCalls.filter((call) => call.id === "calendarRouter01"),
      ).toEqual([]);
    }
    if (step.stage === "qualified") {
      expect(outbound.action).toBe("sendList");
      expect(lastState.offeredSlots).toEqual(
        slots.filter((slot) => !occupied.has(slot.start)),
      );
      expect(outbound.options).toEqual([
        ...lastState.offeredSlots.map((slot) => ({
          id: `slot:${Date.parse(slot.start)}:${Date.parse(slot.end)}`,
          label: slot.label,
        })),
        { id: "slot:none", label: "Nenhum desses" },
      ]);
    }
    if (step.occupy) {
      expect(booked.length).toBe(bookStart);
      expect(outbound.options?.some((item) => item.id === option?.id)).toBe(
        false,
      );
      expect(
        turnCalls
          .filter((call) => call.id === "calendarRouter01")
          .map((call) => call.request.action),
      ).toEqual(["book", "listSlots"]);
      expect(lastState.appointment).toBeNull();
      expect(crm.some((lead) => lead.stage === "scheduled")).toBe(false);
      expect(outbound.text).not.toContain(
        config.messages.booked.split("{slot}")[0],
      );
    }
    if (step.stage === "scheduled") {
      expect(booked.length - bookStart).toBe(1);
      expect(lastState.appointment).toEqual({
        ...(booked.at(-1)?.slot as Row),
        service: scenario.service,
      });
      expect(crm.at(-1)).toMatchObject({
        stage: "scheduled",
        appointment: lastState.appointment,
      });
      expect(
        turnCalls
          .filter((call) => call.request.action !== "markRead")
          .map((call) => call.request.action),
      ).toEqual(["book", "upsertLead", "sendText"]);
    }
  }

  expect(crm.map((lead) => lead.stage)).toEqual(scenario.crmStages);
  expect(booked).toHaveLength(scenario.service ? 1 : 0);
  if (scenario.service) {
    expect(crm.at(-1)?.answers).toEqual([
      {
        question: config.qualification.questions[0].text,
        answer: scenario.service,
      },
      {
        question: config.qualification.questions[1].text,
        answer: "Sim, primeira vez",
      },
    ]);
  }
  if (scenario.pause) {
    expect(engine.rows("whatsapp_lead_pauses")).toEqual([
      expect.objectContaining({
        clientId: config.id,
        leadKey: LEAD,
        reason: scenario.pause,
        pausedUntil: new Date(Date.parse(NOW) + 86400000).toISOString(),
      }),
    ]);
  } else expect(engine.rows("whatsapp_lead_pauses")).toEqual([]);
  if (scenario.pause === "stop") expect(lastState?.declined).toBe(true);
  const persisted = JSON.stringify([
    crm,
    booked,
    engine.rows("lead_conversations"),
    engine.logs,
  ]);
  for (const step of scenario.steps) {
    if (step.text && step.text.length > 15)
      expect(persisted).not.toContain(step.text);
  }
  const messages = sent.map((message) => message.text).join("\n");
  expect(messages).not.toMatch(
    /R\$|cinco tons|abscesso|anti-inflamatório|faça compressa|TEXTO_QUE_NAO_DEVE_SER_ENVIADO/,
  );
  for (const log of engine.logs) {
    expect(Object.keys(JSON.parse(log))).toEqual(
      expect.arrayContaining(["event", "clientId", "code"]),
    );
    expect(
      Object.keys(JSON.parse(log)).every((key) =>
        ["event", "clientId", "code"].includes(key),
      ),
    ).toBe(true);
    expect(log).not.toContain(LEAD);
    expect(log).not.toContain(NAME);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("cenários documentados da demo no workflow exportado, com conectores simulados", () => {
  test("fixtures cobrem os 12 IDs do roteiro", () => {
    const document = readFileSync(
      new URL("../docs/arquitetura/demo-cenarios.md", import.meta.url),
      "utf8",
    );
    const ids = [...document.matchAll(/^## (\d+)\./gm)].map((match) =>
      Number(match[1]),
    );
    expect(fixtures.map((scenario) => scenario.id)).toEqual(ids);
    expect(ids).toHaveLength(12);
  });
  test.each(fixtures)("$id. $name", runScenario);
  test.each([1, 2, 3])(
    "urgência após %i etapas, inclusive junto de um clique na rajada",
    (prefixLength) => {
      const guided = fixtures.find((scenario) => scenario.id === 10);
      const urgency = fixtures.find((scenario) => scenario.id === 7);
      if (!guided || !urgency) throw new Error("Fixtures ausentes");
      runScenario({
        ...urgency,
        crmStages:
          prefixLength === 3
            ? ["talking", "qualified", "urgent"]
            : ["talking", "urgent"],
        steps: [
          ...guided.steps.slice(0, prefixLength),
          {
            ...urgency.steps[0],
            select:
              prefixLength === 3
                ? "firstSlot"
                : prefixLength === 2
                  ? "patient:new"
                  : "procedure:implant",
            burst: true,
          },
          urgency.steps[1],
        ],
      });
    },
  );
});
