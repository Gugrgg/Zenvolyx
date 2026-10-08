import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  aiRequest,
  type Context,
  type Event,
  type Plan,
  prepareConversation,
  resolveCalendar,
  resolveConversation,
  type Slot,
  validInput,
} from "../automations/lead-conversation/conversation.js";

const NOW = "2026-10-08T12:00:00.000Z";
const fixture = () =>
  JSON.parse(
    readFileSync(
      new URL("./fixtures/conversation/scheduling.json", import.meta.url),
      "utf8",
    ),
  ) as Pick<Context, "event" | "config">;
const slots: Slot[] = Array.from({ length: 10 }, (_, i) => ({
  start: new Date(
    Date.parse("2026-10-12T12:00:00Z") + i * 3600000,
  ).toISOString(),
  end: new Date(Date.parse("2026-10-12T13:00:00Z") + i * 3600000).toISOString(),
  label: `Seg 12/10 ${String(9 + i).padStart(2, "0")}:00`,
}));
function context(previous?: Plan, event: Partial<Event> = {}) {
  const input = fixture();
  Object.assign(input.event, event);
  return prepareConversation(
    input,
    previous
      ? [
          {
            clientId: input.config.id,
            leadId: input.event.leadId,
            stateJson: JSON.stringify(previous.state),
          },
        ]
      : [],
    NOW,
  );
}
const click = (id: string, text: string): Partial<Event> => ({
  type: "reply",
  replyId: id,
  text,
});
function qualified() {
  let plan = resolveConversation(context());
  plan = resolveConversation(
    context(plan, click("procedure:implant", "Implante")),
  );
  const ctx = context(plan, click("patient:new", "Sim, primeira vez"));
  return { ctx, plan: resolveConversation(ctx) };
}
function offered() {
  const { ctx, plan } = qualified();
  return resolveCalendar(ctx, plan, { ok: true, slots });
}
function booking(previous = offered(), index = 0) {
  const option = previous.outbound?.options?.[index];
  if (!option) throw new Error("Opção ausente");
  const ctx = context(previous, click(option.id, option.label));
  return { ctx, plan: resolveConversation(ctx) };
}

describe("agendamento na conversa", () => {
  test("qualificado consulta config da agenda e pede nove opções", () => {
    const { plan } = qualified();
    expect(plan.calendarRequest).toEqual({
      action: "listSlots",
      clientId: fixture().config.id,
      timezone: fixture().config.timezone,
      calendar: fixture().config.calendar,
      scheduling: fixture().config.scheduling,
      limit: 9,
    });
    expect(plan.crm.at(-1)).toMatchObject({
      lead: { stage: "qualified", appointment: null },
    });
    expect(plan.outbound).toBeNull();
  });
  test("oferece apenas nove horários guardados mais Nenhum desses", () => {
    const p = offered();
    expect(p.state.offeredSlots).toEqual(slots.slice(0, 9));
    expect(p.outbound).toMatchObject({
      action: "sendList",
      listButton: "Ver horários",
    });
    expect(p.outbound?.options).toHaveLength(10);
    expect(p.outbound?.options?.at(-1)).toEqual({
      id: "slot:none",
      label: "Nenhum desses",
    });
    expect(p.calendarRequest).toBeNull();
  });
  test("reserva recupera intervalo guardado e serviço da resposta da config", () => {
    const { ctx, plan } = booking();
    expect(aiRequest(ctx)).toBeNull();
    expect(plan.calendarRequest).toEqual({
      action: "book",
      clientId: ctx.config.id,
      timezone: ctx.config.timezone,
      calendar: ctx.config.calendar,
      slot: { start: slots[0].start, end: slots[0].end },
      lead: {
        id: ctx.event.leadId,
        name: ctx.event.name,
        phone: ctx.event.phone,
      },
      service: "Implante",
    });
    expect(plan.calendarRequest).not.toHaveProperty("scheduling");
  });
  test("confirma somente após sucesso e grava scheduled com appointment completo", () => {
    const { ctx, plan } = booking();
    expect(plan.state.appointment).toBeNull();
    const p = resolveCalendar(ctx, plan, { ok: true, eventId: "ficticio" });
    expect(p.state.stage).toBe("scheduled");
    expect(p.state.appointment).toEqual({
      start: slots[0].start,
      end: slots[0].end,
      service: "Implante",
    });
    expect(p.crm.at(-1)).toMatchObject({
      lead: { stage: "scheduled", appointment: p.state.appointment },
    });
    expect(p.outbound?.text).toBe(
      ctx.config.messages.booked.replace("{slot}", slots[0].label),
    );
    expect(p.state.offeredSlots).toEqual([]);
    expect(p.pause).toBeNull();
  });
  test("sem serviceQuestion envia serviço nulo, nunca texto do lead", () => {
    const { ctx } = booking();
    delete ctx.config.scheduling?.serviceQuestion;
    expect(resolveConversation(ctx).calendarRequest?.service).toBeNull();
  });
  test("horário ocupado limpa opções antigas e pede uma única nova listagem", () => {
    const { ctx, plan } = booking();
    const p = resolveCalendar(ctx, plan, {
      ok: false,
      error: { code: "slot_taken" },
    });
    expect(p.state.appointment).toBeNull();
    expect(p.state.stage).toBe("qualified");
    expect(p.state.offeredSlots).toEqual([]);
    expect(p.outbound).toBeNull();
    expect(p.calendarRequest?.action).toBe("listSlots");
    const refreshed = resolveCalendar(ctx, p, {
      ok: true,
      slots: slots.slice(1, 3),
    });
    expect(refreshed.outbound?.text).toContain(ctx.config.messages.slotTaken);
    expect(refreshed.outbound?.text).not.toContain(
      ctx.config.messages.booked.split("{slot}")[0],
    );
    expect(refreshed.state.offeredSlots).toEqual(slots.slice(1, 3));
    const stale = context(
      refreshed,
      click(offered().outbound?.options?.[0].id ?? "", "Seg 12/10 09:00"),
    );
    expect(resolveConversation(stale).calendarRequest?.action).not.toBe("book");
  });
  test.each(["none", "empty"])(
    "%s chama a equipe sem criar reserva",
    (mode) => {
      const base = offered();
      const p =
        mode === "none"
          ? resolveConversation(
              context(base, click("slot:none", "Nenhum desses")),
            )
          : resolveCalendar(qualified().ctx, qualified().plan, {
              ok: true,
              slots: [],
            });
      expect(p.state.stage).toBe("with_team");
      expect(p.pause?.reason).toBe("handoff");
      expect(p.calendarRequest).toBeNull();
      expect(p.state.appointment).toBeNull();
      expect(p.outbound?.text).toBe(
        fixture().config.messages[mode === "none" ? "handoff" : "noSlots"],
      );
    },
  );
  test("lista vazia após slot_taken informa ocupação e falta de opções", () => {
    const { ctx, plan } = booking();
    const taken = resolveCalendar(ctx, plan, {
      ok: false,
      error: { code: "slot_taken" },
    });
    const p = resolveCalendar(ctx, taken, { ok: true, slots: [] });
    expect(p.outbound?.text).toContain(ctx.config.messages.slotTaken);
    expect(p.outbound?.text).toContain(ctx.config.messages.noSlots);
    expect(p.pause).not.toBeNull();
  });
  test.each([
    undefined,
    { ok: false, error: { code: "auth" } },
    { ok: false, error: { code: "event_conflict" } },
    { ok: false, error: { code: "unavailable" } },
    { error: "SEGREDO_FICTICIO" },
    { ok: true },
  ])(
    "falha de reserva %j não confirma, pausa e registra erro seguro",
    (result) => {
      const { ctx, plan } = booking();
      const p = resolveCalendar(ctx, plan, result);
      expect(p.state.stage).toBe("with_team");
      expect(p.outbound?.text).toBe(ctx.config.messages.failure);
      expect(p.state.appointment).toBeNull();
      expect(JSON.stringify(p.logs)).not.toContain("SEGREDO_FICTICIO");
    },
  );
  test.each([
    null,
    {},
    [{ ...slots[0], label: "x".repeat(25) }],
    [{ ...slots[0], start: "2026-01-01T00:00:00Z" }],
    [slots[0], slots[0]],
    [{ ...slots[0], end: slots[0].start }],
    [{ ...slots[0], start: "12/10/2026" }],
    Array(11).fill(slots[0]),
  ])("listagem inválida %j não é oferecida", (value) => {
    const { ctx, plan } = qualified();
    const p = resolveCalendar(ctx, plan, { ok: true, slots: value });
    expect(p.state.stage).toBe("with_team");
    expect(p.state.offeredSlots).toEqual([]);
    expect(p.outbound?.action).toBe("sendText");
  });
  test("rótulo de 24 caracteres é aceito e propriedades extras não são persistidas", () => {
    const { ctx, plan } = qualified();
    const p = resolveCalendar(ctx, plan, {
      ok: true,
      slots: [{ ...slots[0], label: "x".repeat(24), private: "segredo" }],
    });
    expect(p.state.offeredSlots[0].label).toHaveLength(24);
    expect(JSON.stringify(p.state)).not.toContain("segredo");
  });
  test("data livre e ID inventado não criam reserva; duas falhas chamam equipe", () => {
    const p = resolveConversation(
      context(offered(), click("slot:inventado", "Qualquer horário")),
    );
    expect(p.calendarRequest).toBeNull();
    expect(p.state.stage).toBe("qualified");
    const second = resolveConversation(context(p, { text: slots[0].start }));
    expect(second.state.stage).toBe("with_team");
    expect(second.calendarRequest).toBeNull();
  });
  test("escolha expirada pede novos horários sem chamar book", () => {
    const { ctx } = booking();
    ctx.now = "2026-10-13T12:00:00Z";
    const p = resolveConversation(ctx);
    expect(p.calendarRequest?.action).toBe("listSlots");
    expect(p.state.appointment).toBeNull();
  });
  test("IA não pode inventar data nem escolher por texto livre", () => {
    const ctx = context(offered(), { text: "reserve amanhã às nove" });
    ctx.needsAI = true;
    const p = resolveConversation(ctx, {
      ok: true,
      intent: "answer",
      answer: slots[0].start,
      reply: null,
    });
    expect(p.calendarRequest?.action).not.toBe("book");
    expect(p.state.appointment).toBeNull();
  });
  test.each(["urgent", "stop", "human"])(
    "rajada com horário e %s respeita intenção prioritária",
    (intent) => {
      const { ctx } = booking();
      ctx.event.messageIds.push("wamid.extra");
      ctx.event.text += "\nmensagem adicional";
      const fresh = prepareConversation(
        { event: ctx.event, config: ctx.config },
        [
          {
            clientId: ctx.config.id,
            leadId: ctx.event.leadId,
            stateJson: JSON.stringify(ctx.state),
          },
        ],
        NOW,
      );
      expect(fresh.slotChoice).toBeNull();
      fresh.needsAI = true;
      const p = resolveConversation(fresh, {
        ok: true,
        intent,
        answer: null,
        reply: null,
      });
      expect(p.calendarRequest).toBeNull();
      expect(p.state.stage).toBe(
        intent === "urgent"
          ? "urgent"
          : intent === "stop"
            ? "stopped"
            : "with_team",
      );
    },
  );
  test("dúvida administrativa responde e reapresenta horários sem nova consulta", () => {
    const ctx = context(offered());
    ctx.needsAI = true;
    const p = resolveConversation(ctx, {
      ok: true,
      intent: "question",
      answer: null,
      reply: "Endereço fictício.",
    });
    expect(p.outbound?.text).toContain("Endereço fictício.");
    expect(p.outbound?.options).toHaveLength(10);
    expect(p.calendarRequest).toBeNull();
    expect(p.state.failures).toBe(0);
  });
  test("duas falhas de IA na escolha encaminham para equipe", () => {
    const ctx = context(offered());
    ctx.needsAI = true;
    const first = resolveConversation(ctx, { ok: false });
    expect(first.state.stage).toBe("qualified");
    expect(first.outbound?.action).toBe("sendList");
    const second = context(first);
    second.needsAI = true;
    expect(resolveConversation(second, { ok: false }).state.stage).toBe(
      "with_team",
    );
  });
  test("mensagem após scheduled não consulta agenda nem repete reserva", () => {
    const { ctx, plan } = booking();
    const scheduled = resolveCalendar(ctx, plan, {
      ok: true,
      eventId: "ficticio",
    });
    const p = resolveConversation(
      context(
        scheduled,
        click(offered().outbound?.options?.[0].id ?? "", "Seg 12/10 09:00"),
      ),
    );
    expect(p.calendarRequest).toBeNull();
    expect(p.state.appointment).toEqual(scheduled.state.appointment);
  });
  test("não altera plano ou contexto durante resposta do calendário", () => {
    const { ctx, plan } = booking();
    const before = structuredClone({ ctx, plan });
    resolveCalendar(ctx, plan, { ok: true, eventId: "ficticio" });
    expect({ ctx, plan }).toEqual(before);
  });
  test("rejeita config com agenda sem duração ou mensagem de confirmação", () => {
    const i = fixture();
    delete i.config.scheduling;
    expect(validInput(i)).toBe(false);
    const j = fixture();
    j.config.messages.booked = "Sem marcador";
    expect(validInput(j)).toBe(false);
  });
});

describe("workflow de agenda", () => {
  const workflow = JSON.parse(
    readFileSync(
      new URL(
        "../automations/lead-conversation/workflow.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const node = (name: string) =>
    workflow.nodes.find((n: { name: string }) => n.name === name);
  test("chama o roteador com captura de falhas e no máximo uma relistagem", () => {
    for (const name of ["Call calendar", "Refresh slots"]) {
      expect(node(name).parameters).toMatchObject({
        mode: "each",
        source: "database",
        workflowId: { value: "calendarRouter01" },
      });
      expect(node(name).onError).toBe("continueRegularOutput");
    }
    expect(workflow.connections["Refresh result"].main[0][0].node).toBe(
      "Final plan",
    );
  });
  test("confere pausa antes da consulta e novamente antes do envio, guardando resultado da reserva", () => {
    expect(workflow.connections["May respond"].main[0][0].node).toBe(
      "Needs calendar",
    );
    expect(workflow.connections["Final plan"].main[0][0].node).toBe(
      "Check delivery pause",
    );
    expect(workflow.connections["Delivery pause status"].main[0][0].node).toBe(
      "Save state",
    );
  });
  test("handlers embutem exatamente as funções testadas", () => {
    const core = readFileSync(
      new URL(
        "../automations/lead-conversation/conversation.js",
        import.meta.url,
      ),
      "utf8",
    ).replaceAll("export function ", "function ");
    for (const name of ["Calendar result", "Refresh result"])
      expect(node(name).parameters.jsCode.startsWith(core)).toBe(true);
  });
});
