import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  calculateSlots,
  type SlotInput,
} from "../integrations/calendar/router/slots.js";

type Json = Record<string, unknown>;
type Request = SlotInput & {
  action: string;
  clientId: string;
  calendar: { provider: string; settings: { calendarId: string } };
  slot: { start: string; end: string };
  lead: { id: string; name: string | null; phone: string | null };
  service: string | null;
};
type EventBody = {
  id: string;
  summary: string;
  description: string;
  start: { dateTime: string };
  end: { dateTime: string };
  extendedProperties: { private: Record<string, string> };
  attendees?: unknown;
};
type NodeOutput = Request & {
  valid: boolean;
  window: { now: string; timeMin: string; timeMax: string };
  providerWorkflowId: string;
  eventId: string;
  eventUrl: string;
  eventBody: EventBody;
  secret?: unknown;
  retry: boolean;
  queryBusy: boolean;
  create: boolean;
  recover: boolean;
  result: {
    ok: boolean;
    error: { code: string; retryable: boolean };
    eventId: string;
  };
};
type WorkflowNode = {
  name: string;
  type: string;
  credentials?: unknown;
  parameters: { jsCode: string } & Json;
};
type Workflow = {
  id: string;
  nodes: WorkflowNode[];
  connections: Record<string, { main: { node: string }[][] }>;
};
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const router = JSON.parse(
  read("../integrations/calendar/router/workflow.json"),
) as Workflow;
const google = JSON.parse(
  read("../integrations/calendar/google-calendar/workflow.json"),
) as Workflow;
const fixture = (
  name: string,
): { request: Request; now: string; busy: SlotInput["busy"] } =>
  JSON.parse(read(`./fixtures/calendar/${name}.json`));
const node = (workflow: Workflow, name: string) => {
  const result = workflow.nodes.find((item) => item.name === name);
  if (!result) throw new Error(`Nó não encontrado: ${name}`);
  return result;
};
const NOW = "2026-09-28T10:00:00.000Z";
afterEach(() => vi.useRealTimers());

function run(
  workflow: Workflow,
  name: string,
  values: (Json | NodeOutput)[],
  previous: (Json | NodeOutput)[] = [],
  prevName = "Call provider",
) {
  const logs: string[] = [];
  const fn = new Function(
    "$input",
    "$",
    "$prevNode",
    "console",
    node(workflow, name).parameters.jsCode,
  );
  const output = fn(
    { all: () => values.map((json) => ({ json })) },
    () => ({ itemMatching: (index: number) => ({ json: previous[index] }) }),
    { name: prevName },
    { log: (m: string) => logs.push(m) },
  ) as { json: NodeOutput }[];
  return { items: output.map((item) => item.json), logs };
}
function validate(request: Json | Request) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  return run(router, "Validate request", [request as unknown as Json]).items[0];
}
function preparedBooking() {
  const request = validate(fixture("slot-taken").request);
  request.eventId = createHash("sha256")
    .update(
      JSON.stringify([
        request.clientId,
        request.calendar.settings.calendarId,
        request.lead.id,
        request.slot.start,
        request.slot.end,
      ]),
    )
    .digest("hex");
  return run(google, "Prepare request", [request]).items[0];
}
function listInput(name = "office-hours"): SlotInput {
  const f = fixture(name);
  return { ...f.request, now: f.now, busy: f.busy } as SlotInput;
}

describe("slot calculation", () => {
  test("uses local office hours, skips lunch and respects the requested limit", () => {
    const slots = calculateSlots(listInput());
    expect(slots).toHaveLength(10);
    expect(slots[0]).toEqual({
      start: "2026-09-28T12:00:00.000Z",
      end: "2026-09-28T13:00:00.000Z",
      label: "Seg 28/09 09:00",
    });
    expect(slots.map((slot) => slot.start)).not.toContain(
      "2026-09-28T15:00:00.000Z",
    );
    expect(slots.every((slot) => slot.label.length <= 24)).toBe(true);
  });
  test("removes every overlapping block, but allows touching boundaries", () => {
    const slots = calculateSlots(listInput("busy-period"));
    expect(slots.map((s) => s.label)).not.toContain("Seg 28/09 10:00");
    expect(slots.map((s) => s.label)).not.toContain("Seg 28/09 11:00");
    expect(slots[0].label).toBe("Seg 28/09 09:00");
    const input = listInput();
    input.busy = [
      { start: "2026-09-28T13:00:00Z", end: "2026-09-28T14:00:00Z" },
    ];
    expect(
      calculateSlots(input)
        .slice(0, 2)
        .map((s) => s.label),
    ).toEqual(["Seg 28/09 09:00", "Seg 28/09 11:00"]);
  });
  test("starts on the office grid after minimum notice, without shifting the grid", () => {
    expect(calculateSlots(listInput("minimum-notice"))[0].label).toBe(
      "Seg 28/09 14:00",
    );
  });
  test("limits the entire appointment to the rolling horizon", () => {
    const input = listInput();
    input.scheduling.daysAhead = 1;
    expect(calculateSlots(input)).toHaveLength(7);
    input.scheduling.minNoticeHours = 25;
    expect(calculateSlots(input)).toEqual([]);
  });
  test("closed days and full-day busy blocks return no slots", () => {
    const input = listInput();
    input.scheduling.hours = {};
    expect(calculateSlots(input)).toEqual([]);
    const occupied = listInput();
    occupied.busy = [{ start: NOW, end: "2026-10-01T00:00:00Z" }];
    expect(calculateSlots(occupied)).toEqual([]);
  });
  test("does not offer partial blocks at the end of a range", () => {
    const input = listInput();
    input.scheduling.hours = { mon: ["09:00-10:30"] };
    expect(calculateSlots(input)).toHaveLength(1);
  });
  test("handles half-hour offsets without the machine timezone", () => {
    const input = listInput();
    input.timezone = "Asia/Kolkata";
    input.now = "2026-09-28T00:00:00Z";
    input.scheduling.minNoticeHours = 0;
    expect(calculateSlots(input)[0].start).toBe("2026-09-28T03:30:00.000Z");
  });
  test.each([
    {
      now: "2026-03-08T05:00:00Z",
      expected: ["Dom 08/03 00:00", "Dom 08/03 03:00"],
    },
    {
      now: "2026-11-01T04:00:00Z",
      expected: ["Dom 01/11 02:00", "Dom 01/11 03:00"],
    },
  ])(
    "skips missing or ambiguous DST wall times ($now)",
    ({ now, expected }) => {
      const input = listInput();
      input.now = now;
      input.timezone = "America/New_York";
      input.scheduling = {
        durationMinutes: 60,
        minNoticeHours: 0,
        daysAhead: 1,
        hours: { sun: ["00:00-04:00"] },
      };
      expect(calculateSlots(input).map((s) => s.label)).toEqual(expected);
    },
  );
  test("fails closed for malformed busy intervals", () => {
    const input = listInput();
    input.busy = [{ start: "invalid", end: "invalid" }];
    expect(() => calculateSlots(input)).toThrow("ocupação inválido");
  });
  test("embeds the exact same pure function in the n8n node", () => {
    const source = read("../integrations/calendar/router/slots.js").replace(
      "export function calculateSlots",
      "function calculateSlots",
    );
    expect(
      node(router, "Calculate slots").parameters.jsCode.startsWith(source),
    ).toBe(true);
    const input = listInput();
    expect(
      run(router, "Calculate slots", [
        {
          request: fixture("office-hours").request,
          result: { ok: true, busy: input.busy, now: input.now },
        },
      ]).items[0],
    ).toEqual({ ok: true, slots: calculateSlots(input) });
  });
});

describe("router validation and retry", () => {
  test("validates the contract, removes untrusted extras and ignores a caller clock", () => {
    const request = fixture("office-hours").request;
    const result = validate({
      ...request,
      now: "2000-01-01",
      providerWorkflowId: "another-client",
      secret: "FAKE",
    });
    expect(result.valid).toBe(true);
    expect(result.window.now).toBe(NOW);
    expect(result.providerWorkflowId).toBe("googleCalendar01");
    expect(result.secret).toBeUndefined();
    expect(validate(fixture("slot-taken").request).valid).toBe(true);
  });
  test.each([
    { action: "remove" },
    { clientId: "../other" },
    { timezone: "Fake/Zone" },
    { timezone: "+03:00" },
    { limit: 0 },
    { limit: 11 },
    { limit: 1.5 },
    { calendar: { provider: "__proto__", settings: { calendarId: "fake" } } },
    {
      calendar: {
        provider: "google-calendar",
        settings: { calendarId: "PREENCHER" },
      },
    },
    {
      scheduling: {
        durationMinutes: 0,
        minNoticeHours: 0,
        daysAhead: 1,
        hours: {},
      },
    },
    {
      scheduling: {
        durationMinutes: 60,
        minNoticeHours: -1,
        daysAhead: 1,
        hours: {},
      },
    },
    {
      scheduling: {
        durationMinutes: 60,
        minNoticeHours: 0,
        daysAhead: 367,
        hours: {},
      },
    },
    {
      scheduling: {
        durationMinutes: 60,
        minNoticeHours: 0,
        daysAhead: 1,
        hours: { fake: [] },
      },
    },
    {
      scheduling: {
        durationMinutes: 60,
        minNoticeHours: 0,
        daysAhead: 1,
        hours: { mon: ["12:00-10:00"] },
      },
    },
    {
      scheduling: {
        durationMinutes: 60,
        minNoticeHours: 0,
        daysAhead: 1,
        hours: { mon: ["09:00-12:00", "11:00-13:00"] },
      },
    },
  ])("rejects invalid list input %j", (patch) => {
    expect(
      validate({ ...fixture("office-hours").request, ...patch }).valid,
    ).toBe(false);
  });
  test.each([
    { slot: { start: "2026-02-30T12:00:00Z", end: "2026-03-01T13:00:00Z" } },
    { slot: { start: "2026-09-28T12:00:00Z", end: "2026-09-28T11:00:00Z" } },
    { slot: { start: "2026-09-28T09:00:00Z", end: "2026-09-28T11:00:00Z" } },
    { lead: { id: "", name: null, phone: null } },
    { lead: { id: "fake", name: null, phone: "not-a-phone" } },
    { service: 42 },
  ])("rejects invalid book input %j", (patch) =>
    expect(validate({ ...fixture("slot-taken").request, ...patch }).valid).toBe(
      false,
    ),
  );
  test("retries a temporary failure once, preserving the same client request", () => {
    const request = validate(fixture("office-hours").request);
    const failure = {
      ok: false,
      error: { code: "rate_limited", retryable: true },
    };
    const first = run(router, "Classify", [failure], [request]);
    expect(first.items[0]).toMatchObject({
      retry: true,
      clientId: request.clientId,
    });
    const retry = run(
      router,
      "Classify",
      [failure],
      [request],
      "Call provider (retry)",
    );
    expect(retry.items[0]).toMatchObject({ retry: false, result: failure });
    expect(retry.logs.join()).not.toContain(
      request.calendar.settings.calendarId,
    );
  });
  test("does not retry business errors and refuses malformed success", () => {
    const request = validate(fixture("slot-taken").request);
    expect(
      run(
        router,
        "Classify",
        [{ ok: false, error: { code: "slot_taken", retryable: false } }],
        [request],
      ).items[0].retry,
    ).toBe(false);
    expect(
      run(router, "Classify", [{ ok: true }], [request]).items[0].result.error
        .code,
    ).toBe("provider_error");
    expect(
      run(router, "Classify", [{ error: "workflow not active" }], [request])
        .items[0].result.error.code,
    ).toBe("no_provider");
  });
});

describe("Google connector", () => {
  test("constructs a private identity per client, lead, calendar and slot, with no guests", () => {
    const p = preparedBooking();
    expect(p.eventId).toMatch(/^[0-9a-f]{64}$/);
    expect(p.eventBody).toMatchObject({
      summary: "Avaliação – Paciente Fictícia",
      extendedProperties: {
        private: { leadId: p.lead.id, clientId: p.clientId, zenvolyx: "true" },
      },
    });
    expect(p.eventBody.attendees).toBeUndefined();
    expect(p.eventBody.description).not.toContain(p.lead.id);
    expect(p.eventUrl).toContain(
      encodeURIComponent(p.calendar.settings.calendarId),
    );
  });
  test("maps an existing matching event to success without another write", () => {
    const p = preparedBooking();
    const output = run(
      google,
      "Existing result",
      [{ statusCode: 200, body: p.eventBody }],
      [p],
    ).items[0];
    expect(output).toEqual({
      queryBusy: false,
      result: { ok: true, eventId: p.eventId },
    });
    expect(
      run(google, "Existing result", [{ statusCode: 404, body: {} }], [p])
        .items[0].queryBusy,
    ).toBe(true);
  });
  test.each(["clientId", "leadId"])(
    "never accepts another %s as the same booking",
    (key) => {
      const p = preparedBooking();
      const event = structuredClone(p.eventBody);
      event.extendedProperties.private[key] = "other";
      expect(
        run(google, "Existing result", [{ statusCode: 200, body: event }], [p])
          .items[0].result.error.code,
      ).toBe("event_conflict");
    },
  );
  test("does not confirm cancelled or moved events", () => {
    const p = preparedBooking();
    for (const event of [
      { ...p.eventBody, status: "cancelled" },
      { ...p.eventBody, start: { dateTime: "2026-09-28T14:00:00Z" } },
    ])
      expect(
        run(google, "Existing result", [{ statusCode: 200, body: event }], [p])
          .items[0].result.ok,
      ).toBe(false);
  });
  test("checks busy periods before insert and detects a slot taken after listing", () => {
    const p = preparedBooking();
    const calendars = {
      [p.calendar.settings.calendarId]: { busy: fixture("slot-taken").busy },
    };
    expect(
      run(
        google,
        "Check availability",
        [{ statusCode: 200, body: { calendars } }],
        [p],
      ).items[0],
    ).toEqual({
      create: false,
      result: { ok: false, error: { code: "slot_taken", retryable: false } },
    });
    calendars[p.calendar.settings.calendarId].busy = [];
    expect(
      run(
        google,
        "Check availability",
        [{ statusCode: 200, body: { calendars } }],
        [p],
      ).items[0].create,
    ).toBe(true);
  });
  test("does not confuse missing or another calendar's busy data with availability", () => {
    const p = preparedBooking();
    for (const calendars of [
      { other: { busy: [] } },
      { [p.calendar.settings.calendarId]: {} },
      {
        [p.calendar.settings.calendarId]: {
          busy: [{ start: "invalid", end: "invalid" }],
        },
      },
    ])
      expect(
        run(
          google,
          "Check availability",
          [{ statusCode: 200, body: { calendars } }],
          [p],
        ).items[0].result.error.code,
      ).toBe("provider_error");
  });
  test("handles per-calendar errors even inside HTTP 200", () => {
    const p = preparedBooking();
    const result = run(
      google,
      "Check availability",
      [
        {
          statusCode: 200,
          body: {
            calendars: {
              [p.calendar.settings.calendarId]: {
                errors: [{ reason: "notFound" }],
              },
            },
          },
        },
      ],
      [p],
    ).items[0];
    expect(result.result.error.code).toBe("not_found");
  });
  test.each([
    [401, "auth", false],
    [403, "forbidden", false],
    [404, "not_found", false],
    [429, "rate_limited", true],
    [503, "unavailable", true],
    [400, "provider_error", false],
  ])("maps HTTP %i", (status, code, retryable) => {
    const p = preparedBooking();
    expect(
      run(google, "Check availability", [{ statusCode: status, body: {} }], [p])
        .items[0].result,
    ).toEqual({ ok: false, error: { code, retryable } });
  });
  test("handles Google auth failures and network timeouts without leaking input", () => {
    const p = preparedBooking();
    expect(
      run(
        google,
        "Insert result",
        [{ error: { message: "invalid_grant" } }],
        [p],
      ).items[0].result.error.code,
    ).toBe("auth");
    expect(
      run(google, "Insert result", [{ error: "timeout" }], [p]).items[0].result,
    ).toEqual({ ok: false, error: { code: "unavailable", retryable: true } });
  });
  test("recovers 409 by fetching and checking the event", () => {
    const p = preparedBooking();
    expect(
      run(google, "Insert result", [{ statusCode: 409, body: {} }], [p])
        .items[0].recover,
    ).toBe(true);
    expect(
      run(
        google,
        "Recovered result",
        [{ statusCode: 200, body: p.eventBody }],
        [p],
      ).items[0].result,
    ).toEqual({ ok: true, eventId: p.eventId });
  });
});

test("workflow connections are valid and HTTP nodes use the shared credential type", () => {
  for (const workflow of [router, google]) {
    expect(workflow.id).toMatch(/^[A-Za-z0-9]{16}$/);
    for (const group of Object.values(workflow.connections))
      for (const output of group.main)
        for (const edge of output)
          expect(workflow.nodes.some((n) => n.name === edge.node)).toBe(true);
    for (const n of workflow.nodes) {
      expect(n.credentials).toBeUndefined();
      if (n.type === "n8n-nodes-base.httpRequest")
        expect(n.parameters).toMatchObject({
          authentication: "predefinedCredentialType",
          nodeCredentialType: "googleApi",
          options: {
            timeout: 15000,
            response: { response: { neverError: true, fullResponse: true } },
          },
        });
    }
  }
  expect(google.connections["Check availability"].main[0][0].node).toBe(
    "Create event",
  );
  expect(google.connections["Create event"].main[0][0].node).toBe(
    "Insert event",
  );
  expect(google.connections["Create event"].main[1][0].node).toBe("Result");
});
