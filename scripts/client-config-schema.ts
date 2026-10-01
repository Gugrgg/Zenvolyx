import { z } from "zod";

const nonBlank = z.string().refine((value) => value.trim().length > 0, {
  message: "Texto não pode ficar vazio.",
});
const identifier = nonBlank.refine((value) => value === value.trim(), {
  message: "ID não pode começar ou terminar com espaços.",
});
const N8N_WORKFLOW_ID = /^[A-Za-z0-9]{16}$/;
const questionFields = { id: identifier, text: nonBlank };
const questionSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...questionFields, type: z.literal("text") }),
  z.strictObject({ ...questionFields, type: z.literal("number") }),
  z.strictObject({
    ...questionFields,
    type: z.literal("choice"),
    options: z
      .array(z.strictObject({ id: identifier, label: nonBlank.max(20) }))
      .min(1)
      .max(10),
  }),
]);

const ruleSchema = z.strictObject({
  question: identifier,
  in: z.array(identifier).min(1).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

const timeRangeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/)
  .refine((value) => value.slice(0, 5) < value.slice(6), {
    message: "O início da faixa deve ser anterior ao fim.",
  });
const dailyHoursSchema = z.array(timeRangeSchema).superRefine((ranges, ctx) => {
  ranges.forEach((range, index) => {
    if (index > 0 && range.slice(0, 5) < ranges[index - 1].slice(6)) {
      ctx.addIssue({
        code: "custom",
        path: [index],
        message: "As faixas devem estar em ordem crescente e sem sobreposição.",
      });
    }
  });
});

const schedulingSchema = z.strictObject({
  durationMinutes: z.number().int().positive(),
  minNoticeHours: z.number().nonnegative(),
  daysAhead: z.number().int().positive(),
  serviceQuestion: identifier.optional(),
  hours: z.strictObject({
    mon: dailyHoursSchema.optional(),
    tue: dailyHoursSchema.optional(),
    wed: dailyHoursSchema.optional(),
    thu: dailyHoursSchema.optional(),
    fri: dailyHoursSchema.optional(),
    sat: dailyHoursSchema.optional(),
    sun: dailyHoursSchema.optional(),
  }),
});

function isTimeZone(value: string): boolean {
  // Intl também aceita offsets; aqui o contrato exige um nome IANA.
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const clientConfigSchema = z
  .strictObject({
    version: z.literal(3),
    id: identifier.regex(/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: nonBlank,
    active: z.boolean(),
    timezone: nonBlank.refine(isTimeZone, { message: "Fuso IANA inválido." }),
    whatsapp: z.strictObject({
      phoneNumberId: identifier,
      gatewayWorkflowId: identifier,
    }),
    crm: z.strictObject({
      provider: z.literal("google-sheets"),
      settings: z.strictObject({ spreadsheetId: identifier }),
    }),
    calendar: z
      .strictObject({
        provider: z.literal("google-calendar"),
        settings: z.strictObject({ calendarId: identifier }),
      })
      .optional(),
    scheduling: schedulingSchema.optional(),
    qualification: z.strictObject({
      questions: z.array(questionSchema),
      rules: z.array(ruleSchema),
    }),
    ai: z
      .strictObject({
        enabled: z.boolean(),
        dataMode: z.literal("synthetic").optional(),
        knowledge: z
          .array(z.strictObject({ topic: nonBlank, text: nonBlank }))
          .refine(
            (items) =>
              items.reduce(
                (total, item) =>
                  total + [...item.topic].length + [...item.text].length,
                0,
              ) <= 6000,
            { message: "A base da IA excede 6.000 caracteres (topic + text)." },
          ),
      })
      .optional(),
    messages: z.strictObject({
      welcome: nonBlank,
      handoff: nonBlank,
      failure: nonBlank,
      urgent: nonBlank,
      notQualified: nonBlank,
      chooseSlot: nonBlank,
      noSlots: nonBlank,
      slotTaken: nonBlank,
      booked: nonBlank.refine((text) => text.includes("{slot}"), {
        message: "A confirmação deve conter {slot}.",
      }),
      stopped: nonBlank,
    }),
  })
  .superRefine((config, ctx) => {
    const report = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: "custom", path, message });
    };
    if (config.id.startsWith("_") && config.active) {
      report(["active"], "Config de modelo deve permanecer inativa.");
    }
    if (config.active) {
      const resourceIds = [
        {
          path: ["whatsapp", "phoneNumberId"],
          value: config.whatsapp.phoneNumberId,
        },
        {
          path: ["whatsapp", "gatewayWorkflowId"],
          value: config.whatsapp.gatewayWorkflowId,
        },
        {
          path: ["crm", "settings", "spreadsheetId"],
          value: config.crm.settings.spreadsheetId,
        },
        {
          path: ["calendar", "settings", "calendarId"],
          value: config.calendar?.settings.calendarId,
        },
      ];
      for (const { path, value } of resourceIds) {
        if (value?.toUpperCase().includes("PREENCHER")) {
          report(path, "Substitua PREENCHER antes de ativar o cliente.");
        }
      }
      if (!N8N_WORKFLOW_ID.test(config.whatsapp.gatewayWorkflowId)) {
        report(
          ["whatsapp", "gatewayWorkflowId"],
          "ID da porta deve ter 16 letras e números, o formato que o n8n consegue chamar.",
        );
      }
    }
    const questions = config.qualification.questions;
    const questionIds = new Set<string>();
    questions.forEach((question, index) => {
      const path = ["qualification", "questions", index];
      if (questionIds.has(question.id)) {
        report([...path, "id"], "ID de pergunta repetido.");
      }
      questionIds.add(question.id);
      if (question.type === "choice") {
        const optionIds = new Set<string>();
        question.options.forEach((option, optionIndex) => {
          if (optionIds.has(option.id)) {
            report(
              [...path, "options", optionIndex, "id"],
              "ID de opção repetido nesta pergunta.",
            );
          }
          optionIds.add(option.id);
        });
      }
    });
    config.qualification.rules.forEach((rule, index) => {
      const path = ["qualification", "rules", index];
      const question = questions.find((item) => item.id === rule.question);
      if (!question) {
        report(
          [...path, "question"],
          "A regra deve apontar para uma pergunta existente.",
        );
      } else if (question.type === "text") {
        report(
          [...path, "question"],
          "Pergunta text não pode participar de regra.",
        );
      } else if (question.type === "choice") {
        if (!rule.in)
          report([...path, "in"], "Regra choice exige opções em in.");
        rule.in?.forEach((optionId, optionIndex) => {
          if (!question.options.some((option) => option.id === optionId)) {
            report(
              [...path, "in", optionIndex],
              "Opção não existe nesta pergunta.",
            );
          }
        });
        if (rule.min !== undefined || rule.max !== undefined) {
          report(path, "min/max só podem ser usados em pergunta number.");
        }
      } else {
        if (rule.in !== undefined)
          report([...path, "in"], "Regra number não aceita in.");
        if (rule.min === undefined && rule.max === undefined) {
          report(path, "Regra number exige min e/ou max.");
        }
        if (
          rule.min !== undefined &&
          rule.max !== undefined &&
          rule.min > rule.max
        ) {
          report(path, "min não pode ser maior que max.");
        }
      }
    });
    if (config.calendar && !config.scheduling) {
      report(["scheduling"], "Config com calendar exige scheduling.");
    }
    if (config.scheduling?.serviceQuestion !== undefined) {
      const question = questions.find(
        (item) => item.id === config.scheduling?.serviceQuestion,
      );
      if (question?.type !== "choice") {
        report(
          ["scheduling", "serviceQuestion"],
          "O serviço deve apontar para uma pergunta choice existente.",
        );
      }
    }
  });

export type ClientConfig = z.infer<typeof clientConfigSchema>;

export type ClientConfigEntry = { directory: string; config: unknown };
export type ClientConfigIssue = {
  directory: string;
  path: PropertyKey[];
  message: string;
};

export function validateClientConfigs(
  entries: ClientConfigEntry[],
): ClientConfigIssue[] {
  const issues: ClientConfigIssue[] = [];
  const activeNumbers = new Set<string>();
  for (const { directory, config } of entries) {
    const result = clientConfigSchema.safeParse(config);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          directory,
          path: issue.path,
          // Mensagens internas do Zod podem conter chaves recebidas na entrada.
          message:
            issue.code === "custom"
              ? issue.message
              : `Campo inválido (${issue.code}).`,
        });
      }
      continue;
    }
    if (result.data.id !== directory) {
      issues.push({
        directory,
        path: ["id"],
        message: "ID deve ser igual ao nome da pasta.",
      });
    }
    if (result.data.active) {
      if (directory.startsWith("_")) {
        issues.push({
          directory,
          path: ["active"],
          message: "Pasta de modelo deve permanecer inativa.",
        });
      }
      const phoneNumberId = result.data.whatsapp.phoneNumberId;
      if (activeNumbers.has(phoneNumberId)) {
        issues.push({
          directory,
          path: ["whatsapp", "phoneNumberId"],
          message: "ID do WhatsApp repetido entre clientes ativos.",
        });
      }
      activeNumbers.add(phoneNumberId);
    }
  }
  return issues;
}
