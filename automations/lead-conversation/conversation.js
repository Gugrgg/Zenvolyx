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
    text(slot.label, 200)
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
  return {
    valid: true,
    event,
    config,
    state,
    stateError,
    isNew,
    question,
    directAnswer,
    now,
  };
}

export function aiRequest(context) {
  const { config, event, question } = context;
  if (
    context.stateError ||
    context.directAnswer !== null ||
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
    plan.readyForScheduling = true;
  }
  if (state.stage === "qualified") plan.readyForScheduling = true;
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
