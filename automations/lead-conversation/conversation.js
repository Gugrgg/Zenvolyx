// Funções puras, também embutidas nos nós Code do workflow.
const DAY = 86_400_000;
const STAGES = [
  "talking",
  "qualified",
  "not_qualified",
  "scheduled",
  "with_team",
  "urgent",
  "stopped",
];
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, max = 4000) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const date = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const identifier = (value) => text(value, 100) && /^[a-z0-9_-]+$/i.test(value);
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function validQuestion(question) {
  if (
    !isObject(question) ||
    !identifier(question.id) ||
    !text(question.text, 1000)
  )
    return false;
  if (["text", "number"].includes(question.type)) return true;
  return (
    question.type === "choice" &&
    Array.isArray(question.options) &&
    question.options.length > 0 &&
    question.options.length <= 10 &&
    question.options.every(
      (option) =>
        isObject(option) && identifier(option.id) && text(option.label, 20),
    ) &&
    new Set(question.options.map((option) => option.id)).size ===
      question.options.length
  );
}

function validConfig(config) {
  if (
    !isObject(config) ||
    config.version !== 3 ||
    !identifier(config.id) ||
    config.active !== true ||
    !text(config.name, 200) ||
    !text(config.timezone, 100)
  )
    return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: config.timezone });
  } catch {
    return false;
  }
  if (
    !isObject(config.whatsapp) ||
    !/^\d+$/.test(config.whatsapp.phoneNumberId) ||
    !/^[a-z0-9]{16}$/i.test(config.whatsapp.gatewayWorkflowId)
  )
    return false;
  if (
    !isObject(config.crm) ||
    config.crm.provider !== "google-sheets" ||
    !text(config.crm.settings?.spreadsheetId, 200)
  )
    return false;
  if (
    !isObject(config.qualification) ||
    !Array.isArray(config.qualification.questions) ||
    !Array.isArray(config.qualification.rules)
  )
    return false;
  const questions = config.qualification.questions;
  if (
    questions.length > 30 ||
    !questions.every(validQuestion) ||
    new Set(questions.map((q) => q.id)).size !== questions.length
  )
    return false;
  if (
    !config.qualification.rules.every((rule) => {
      if (!isObject(rule)) return false;
      const q = questions.find((q) => q.id === rule.question);
      if (q?.type === "choice")
        return (
          Array.isArray(rule.in) &&
          rule.in.length > 0 &&
          rule.in.every((id) => q.options.some((o) => o.id === id))
        );
      return (
        q?.type === "number" &&
        (Number.isFinite(rule.min) || Number.isFinite(rule.max)) &&
        (rule.min === undefined || Number.isFinite(rule.min)) &&
        (rule.max === undefined || Number.isFinite(rule.max)) &&
        !(rule.min > rule.max)
      );
    })
  )
    return false;
  const messages = [
    "welcome",
    "handoff",
    "failure",
    "urgent",
    "notQualified",
    "stopped",
  ];
  if (config.calendar !== undefined) {
    if (
      !isObject(config.calendar) ||
      !text(config.calendar.provider, 50) ||
      !isObject(config.calendar.settings) ||
      !text(config.calendar.settings.calendarId, 1024) ||
      !isObject(config.scheduling) ||
      !Number.isInteger(config.scheduling.durationMinutes) ||
      config.scheduling.durationMinutes < 1 ||
      config.scheduling.durationMinutes > 1440
    )
      return false;
    messages.push("chooseSlot", "noSlots", "slotTaken", "booked");
    if (!config.messages?.booked?.includes?.("{slot}")) return false;
  }
  return (
    isObject(config.messages) &&
    messages.every((key) => text(config.messages[key], 1000))
  );
}

export function validInput(input) {
  if (!isObject(input) || !validConfig(input.config) || !isObject(input.event))
    return false;
  const e = input.event;
  return (
    e.clientId === input.config.id &&
    e.channel === "whatsapp" &&
    text(e.leadId, 200) &&
    (e.phone === null ||
      (typeof e.phone === "string" && /^\d{5,20}$/.test(e.phone))) &&
    (e.name === null || text(e.name, 200)) &&
    Array.isArray(e.messageIds) &&
    e.messageIds.length > 0 &&
    e.messageIds.length <= 100 &&
    e.messageIds.every((id) => text(id, 300)) &&
    date(e.receivedAt) &&
    ["text", "reply", "unsupported"].includes(e.type) &&
    (e.type === "unsupported" || text(e.text, 8000)) &&
    (e.type !== "reply" || text(e.replyId, 200))
  );
}

function validAnswer(question, answer) {
  if (question?.type === "choice")
    return question.options.some((o) => o.id === answer);
  if (question?.type === "number") return Number.isFinite(answer);
  return question?.type === "text" && text(answer, 400);
}

function freshState(now) {
  return {
    stage: "talking",
    questionIndex: 0,
    answers: {},
    failures: 0,
    offeredSlots: [],
    declined: false,
    appointment: null,
    firstContactAt: now,
    lastContactAt: now,
  };
}

function validSlot(slot) {
  return (
    isObject(slot) &&
    date(slot.start) &&
    date(slot.end) &&
    Date.parse(slot.start) < Date.parse(slot.end) &&
    text(slot.label, 24)
  );
}

function readState(row, config) {
  const state = JSON.parse(row.stateJson);
  if (
    !isObject(state) ||
    !STAGES.includes(state.stage) ||
    !Number.isInteger(state.questionIndex) ||
    state.questionIndex < 0 ||
    state.questionIndex > config.qualification.questions.length ||
    !Number.isInteger(state.failures) ||
    state.failures < 0 ||
    state.failures > 2 ||
    !isObject(state.answers) ||
    !Array.isArray(state.offeredSlots) ||
    state.offeredSlots.length > 9 ||
    !state.offeredSlots.every(validSlot) ||
    typeof state.declined !== "boolean" ||
    !date(state.firstContactAt) ||
    !date(state.lastContactAt)
  )
    throw new Error("invalid_state");
  if (
    state.appointment !== null &&
    state.appointment !== undefined &&
    (!isObject(state.appointment) ||
      !date(state.appointment.start) ||
      !date(state.appointment.end) ||
      Date.parse(state.appointment.start) >=
        Date.parse(state.appointment.end) ||
      !(
        state.appointment.service === null ||
        text(state.appointment.service, 200)
      ))
  )
    throw new Error("invalid_state");
  for (const [id, answer] of Object.entries(state.answers)) {
    if (
      !validAnswer(
        config.qualification.questions.find((q) => q.id === id),
        answer,
      )
    )
      throw new Error("invalid_state");
  }
  if (
    state.stage === "talking" &&
    config.qualification.questions
      .slice(0, state.questionIndex)
      .some((q) => !Object.hasOwn(state.answers, q.id))
  )
    throw new Error("invalid_state");
  // Não copiar colunas ou propriedades desconhecidas da tabela.
  return {
    ...freshState(state.firstContactAt),
    stage: state.stage,
    questionIndex: state.questionIndex,
    answers: state.answers,
    failures: state.failures,
    declined: state.declined,
    lastContactAt: state.lastContactAt,
    offeredSlots: state.offeredSlots.map(({ start, end, label }) => ({
      start,
      end,
      label,
    })),
    appointment: state.appointment
      ? {
          start: state.appointment.start,
          end: state.appointment.end,
          service: state.appointment.service,
        }
      : null,
  };
}

export function prepareConversation(input, rows, now) {
  if (!validInput(input) || !date(now))
    return {
      valid: false,
      logs: [{ event: "conversation_error", code: "invalid_input" }],
    };
  const { event, config } = input;
  const matches = rows.filter(
    (row) => row.clientId === config.id && row.leadId === event.leadId,
  );
  let state = freshState(now);
  let stateError = matches.length > 1;
  let isNew = matches.length === 0;
  if (matches.length === 1) {
    try {
      state = readState(matches[0], config);
    } catch {
      stateError = true;
    }
    if (
      !stateError &&
      Date.parse(state.lastContactAt) < Date.parse(now) - 30 * DAY
    ) {
      state = freshState(now);
      isNew = true;
    }
  }
  if (state.stage === "stopped") {
    state = { ...freshState(now), firstContactAt: state.firstContactAt };
    isNew = true;
  }
  const question =
    state.stage === "talking"
      ? (config.qualification.questions[state.questionIndex] ?? null)
      : null;
  const option =
    question?.type === "choice" && event.type === "reply"
      ? question.options.find((o) => `${question.id}:${o.id}` === event.replyId)
      : null;
  // Texto extra na rajada também precisa ser interpretado, mesmo quando contém botão.
  const directAnswer =
    option && event.messageIds.length === 1 && event.text === option.label
      ? option.id
      : null;
  const slotChoice =
    state.stage === "qualified" &&
    event.type === "reply" &&
    event.messageIds.length === 1
      ? (slotOptions(state).find(
          (o) => o.id === event.replyId && o.label === event.text,
        )?.id ?? null)
      : null;
  return {
    valid: true,
    event,
    config,
    state,
    stateError,
    isNew,
    question,
    directAnswer,
    slotChoice,
    now,
  };
}

export function aiRequest(context) {
  const { config, event, question } = context;
  if (
    context.stateError ||
    context.directAnswer !== null ||
    context.slotChoice != null ||
    event.type === "unsupported" ||
    config.ai?.enabled !== true ||
    config.ai.dataMode !== "synthetic"
  )
    return null;
  return {
    action: "interpret",
    clientId: config.id,
    dataMode: "synthetic",
    business: { name: config.name, knowledge: config.ai.knowledge },
    question,
    message: event.text,
  };
}

function whatsapp(context, action, fields) {
  return {
    action,
    clientId: context.config.id,
    ...context.config.whatsapp,
    leadId: context.event.leadId,
    ...fields,
  };
}

export function markReadRequest(context) {
  const { leadId: _leadId, ...request } = whatsapp(context, "markRead", {
    messageId: context.event.messageIds.at(-1),
  });
  return request;
}

function crmRequest(context, state) {
  const { config, event } = context;
  return {
    action: "upsertLead",
    clientId: config.id,
    timezone: config.timezone,
    crm: config.crm,
    lead: {
      id: event.leadId,
      phone: event.phone,
      name: event.name,
      channel: "whatsapp",
      stage: state.stage,
      answers: config.qualification.questions
        .filter((q) => Object.hasOwn(state.answers, q.id))
        .map((q) => ({
          question: q.text,
          answer:
            q.type === "choice"
              ? q.options.find((o) => o.id === state.answers[q.id]).label
              : String(state.answers[q.id]),
        })),
      appointment: state.appointment,
      firstContactAt: state.firstContactAt,
      lastContactAt: state.lastContactAt,
    },
  };
}

function qualified(config, answers) {
  return config.qualification.rules.every((r) =>
    r.in
      ? r.in.includes(answers[r.question])
      : Number.isFinite(answers[r.question]) &&
        (r.min === undefined || answers[r.question] >= r.min) &&
        (r.max === undefined || answers[r.question] <= r.max),
  );
}

function validInterpretation(result, question) {
  if (
    !isObject(result) ||
    result.ok !== true ||
    !["urgent", "stop", "human", "answer", "question", "other"].includes(
      result.intent,
    )
  )
    return false;
  if (["urgent", "stop"].includes(result.intent)) return true;
  return (
    (result.reply === null || text(result.reply, 400)) &&
    (result.answer === null || validAnswer(question, result.answer)) &&
    (result.intent !== "answer" || result.answer !== null)
  );
}

export function resolveConversation(context, interpretation = null) {
  const { config, event, now, question } = context;
  const state = JSON.parse(JSON.stringify(context.state));
  state.lastContactAt = now;
  const plan = {
    state,
    clientId: config.id,
    leadId: event.leadId,
    crm: [],
    outbound: null,
    pause: null,
    logs: [],
    readyForScheduling: false,
    calendarRequest: null,
    schedulingPrefix: null,
  };
  const record = () => plan.crm.push(crmRequest(context, state));
  const changeStage = (stage) => {
    if (state.stage !== stage) {
      state.stage = stage;
      record();
    }
  };
  const log = (code) =>
    plan.logs.push({
      event: "conversation_attention",
      clientId: config.id,
      code,
    });
  const send = (value) => {
    plan.outbound = whatsapp(context, "sendText", { text: value });
  };
  const handoff = (reason, message) => {
    const stage =
      reason === "stop"
        ? "stopped"
        : reason === "urgent"
          ? "urgent"
          : "with_team";
    state.declined = reason === "stop";
    state.failures = 0;
    changeStage(stage);
    plan.pause = {
      clientId: config.id,
      leadKey: event.leadId,
      pausedUntil: new Date(Date.parse(now) + DAY).toISOString(),
      reason,
    };
    send(message);
    log(reason);
  };
  if (context.isNew) record();
  if (context.stateError) {
    log("invalid_state");
    handoff("handoff", config.messages.failure);
    return plan;
  }
  if (event.type === "unsupported") {
    handoff("handoff", config.messages.handoff);
    return plan;
  }

  let answer = context.directAnswer;
  let reply = null;
  let failed = false;
  if (context.needsAI) {
    failed = !validInterpretation(interpretation, question);
    if (failed) log("ai_failed");
    else {
      const intent = interpretation.intent;
      if (intent === "urgent") {
        handoff("urgent", config.messages.urgent);
        return plan;
      }
      if (intent === "stop") {
        handoff("stop", config.messages.stopped);
        return plan;
      }
      if (intent === "human") {
        handoff(
          "handoff",
          [interpretation.reply, config.messages.handoff]
            .filter(Boolean)
            .join("\n\n"),
        );
        return plan;
      }
      answer = interpretation.answer;
      reply = interpretation.reply;
    }
  } else if (answer === null) {
    const value = normalize(event.text ?? "");
    if (
      /^(pare|parar|stop|sair|nao me envie mais mensagens|nao quero mais mensagens)[.! ]*$/.test(
        value,
      )
    ) {
      handoff("stop", config.messages.stopped);
      return plan;
    }
    if (
      /^(atendente|humano|quero falar com (uma pessoa|atendente)|cancelar|remarcar)[.! ]*$/.test(
        value,
      )
    ) {
      handoff("handoff", config.messages.handoff);
      return plan;
    }
    if (question?.type === "number" && /^-?\d+(?:[.,]\d+)?$/.test(value))
      answer = Number(value.replace(",", "."));
  }

  if (state.stage === "qualified")
    return scheduleConversation(context, plan, reply, failed);

  if (answer !== null && validAnswer(question, answer)) {
    state.answers = { ...state.answers, [question.id]: answer };
    state.questionIndex += 1;
    state.failures = 0;
  } else if (!question && reply) state.failures = 0;
  else if (failed || !context.isNew)
    state.failures = Math.min(2, state.failures + 1);

  if (state.failures >= 2 || (!question && failed)) {
    handoff(
      "handoff",
      failed ? config.messages.failure : config.messages.handoff,
    );
    return plan;
  }
  if (
    state.stage === "talking" &&
    state.questionIndex === config.qualification.questions.length
  ) {
    if (!qualified(config, state.answers)) {
      changeStage("not_qualified");
      send(config.messages.notQualified);
      return plan;
    }
    changeStage("qualified");
    if (!config.calendar) {
      handoff("handoff", config.messages.handoff);
      return plan;
    }
    return scheduleConversation(context, plan, reply, false);
  }
  const next =
    state.stage === "talking"
      ? config.qualification.questions[state.questionIndex]
      : null;
  const parts = [
    context.isNew ? config.messages.welcome : null,
    reply,
    next?.text,
  ].filter(Boolean);
  if (parts.length > 0) {
    const fields = { text: parts.join("\n\n") };
    if (next?.type === "choice") {
      fields.options = next.options.map((o) => ({
        id: `${next.id}:${o.id}`,
        label: o.label,
      }));
      if (next.options.length > 3) fields.listButton = "Ver opções";
      plan.outbound = whatsapp(
        context,
        next.options.length > 3 ? "sendList" : "sendButtons",
        fields,
      );
    } else send(fields.text);
  } else if (!plan.readyForScheduling)
    handoff("handoff", config.messages.handoff);
  return plan;
}

function slotId(slot) {
  return `slot:${Date.parse(slot.start)}:${Date.parse(slot.end)}`;
}

function slotOptions(state) {
  return state.offeredSlots.length === 0
    ? []
    : [
        ...state.offeredSlots.map((slot) => ({
          id: slotId(slot),
          label: slot.label,
        })),
        { id: "slot:none", label: "Nenhum desses" },
      ];
}

function calendarBase(context, action) {
  const { config } = context;
  return {
    action,
    clientId: config.id,
    timezone: config.timezone,
    calendar: config.calendar,
  };
}

function requestSlots(context, plan, prefix = null) {
  plan.calendarRequest = {
    ...calendarBase(context, "listSlots"),
    scheduling: context.config.scheduling,
    limit: 9,
  };
  plan.schedulingPrefix = prefix;
  plan.readyForScheduling = true;
  plan.outbound = null;
  return plan;
}

function offerSlots(context, plan) {
  plan.calendarRequest = null;
  plan.readyForScheduling = false;
  plan.outbound = whatsapp(context, "sendList", {
    text: [plan.schedulingPrefix, context.config.messages.chooseSlot]
      .filter(Boolean)
      .join("\n\n"),
    listButton: "Ver horários",
    options: slotOptions(plan.state),
  });
  return plan;
}

function schedulingHandoff(context, plan, message, code) {
  plan.state.stage = "with_team";
  plan.state.failures = 0;
  plan.state.offeredSlots = [];
  plan.calendarRequest = null;
  plan.readyForScheduling = false;
  plan.pause = {
    clientId: plan.clientId,
    leadKey: plan.leadId,
    pausedUntil: new Date(Date.parse(context.now) + DAY).toISOString(),
    reason: "handoff",
  };
  plan.crm.push(crmRequest(context, plan.state));
  plan.outbound = whatsapp(context, "sendText", { text: message });
  plan.logs.push({
    event: "conversation_attention",
    clientId: plan.clientId,
    code,
  });
  return plan;
}

function scheduleConversation(context, plan, reply, failed) {
  const { config, event } = context;
  if (!config.calendar)
    return schedulingHandoff(context, plan, config.messages.handoff, "handoff");
  if (context.slotChoice === "slot:none")
    return schedulingHandoff(
      context,
      plan,
      config.messages.handoff,
      "slots_declined",
    );
  const selected = plan.state.offeredSlots.find(
    (s) => slotId(s) === context.slotChoice,
  );
  if (selected && Date.parse(selected.start) > Date.parse(context.now)) {
    const serviceQuestion = config.qualification.questions.find(
      (q) => q.id === config.scheduling?.serviceQuestion && q.type === "choice",
    );
    const service =
      serviceQuestion?.options.find(
        (o) => o.id === plan.state.answers[serviceQuestion.id],
      )?.label ?? null;
    plan.state.failures = 0;
    plan.calendarRequest = {
      ...calendarBase(context, "book"),
      slot: { start: selected.start, end: selected.end },
      lead: { id: event.leadId, name: event.name, phone: event.phone },
      service,
    };
    plan.readyForScheduling = true;
    return plan;
  }
  if (reply) plan.state.failures = 0;
  else if (failed || (context.state.stage === "qualified" && !selected))
    plan.state.failures = Math.min(2, plan.state.failures + 1);
  if (plan.state.failures >= 2)
    return schedulingHandoff(
      context,
      plan,
      failed ? config.messages.failure : config.messages.handoff,
      "slot_choice_failed",
    );
  plan.schedulingPrefix = reply;
  if (
    !plan.state.offeredSlots.length ||
    selected ||
    plan.state.offeredSlots.some(
      (s) => Date.parse(s.start) <= Date.parse(context.now),
    )
  )
    return requestSlots(context, plan, reply);
  return offerSlots(context, plan);
}

function utc(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) &&
    date(value) &&
    new Date(value).toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

export function resolveCalendar(context, originalPlan, result) {
  const plan = JSON.parse(JSON.stringify(originalPlan));
  const request = plan.calendarRequest;
  const { config } = context;
  if (!request || plan.state.stage !== "qualified" || plan.pause !== null)
    return plan;
  const failure = (code) =>
    schedulingHandoff(context, plan, config.messages.failure, code);
  if (!isObject(result)) return failure("calendar_invalid_output");
  if (result.ok !== true) {
    if (
      result.ok === false &&
      result.error?.code === "slot_taken" &&
      request.action === "book"
    ) {
      plan.state.offeredSlots = [];
      return requestSlots(context, plan, config.messages.slotTaken);
    }
    return failure("calendar_failed");
  }
  if (request.action === "listSlots") {
    if (
      !Array.isArray(result.slots) ||
      result.slots.length > 10 ||
      !result.slots.every(
        (slot) =>
          validSlot(slot) &&
          utc(slot.start) &&
          utc(slot.end) &&
          text(slot.label, 24) &&
          Date.parse(slot.start) > Date.parse(context.now) &&
          Date.parse(slot.end) - Date.parse(slot.start) ===
            config.scheduling?.durationMinutes * 60000,
      ) ||
      new Set(result.slots.map((slot) => Date.parse(slot.start))).size !==
        result.slots.length
    )
      return failure("calendar_invalid_output");
    plan.state.offeredSlots = result.slots
      .slice()
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 9)
      .map(({ start, end, label }) => ({ start, end, label }));
    if (!plan.state.offeredSlots.length)
      return schedulingHandoff(
        context,
        plan,
        [plan.schedulingPrefix, config.messages.noSlots]
          .filter(Boolean)
          .join("\n\n"),
        "no_slots",
      );
    return offerSlots(context, plan);
  }
  const selected = plan.state.offeredSlots.find(
    (s) => s.start === request.slot?.start && s.end === request.slot?.end,
  );
  if (request.action !== "book" || !selected || !text(result.eventId, 1024))
    return failure("calendar_invalid_output");
  plan.state.appointment = {
    start: selected.start,
    end: selected.end,
    service: request.service,
  };
  plan.state.stage = "scheduled";
  plan.state.failures = 0;
  plan.state.offeredSlots = [];
  plan.crm.push(crmRequest(context, plan.state));
  plan.calendarRequest = null;
  plan.readyForScheduling = false;
  plan.outbound = whatsapp(context, "sendText", {
    text: config.messages.booked.replaceAll("{slot}", selected.label),
  });
  return plan;
}
