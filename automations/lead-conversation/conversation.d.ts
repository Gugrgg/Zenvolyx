import type { clientConfigSchema } from "../../scripts/client-config-schema.ts";
export type Config = ReturnType<typeof clientConfigSchema.parse>;
export type Event = {
  clientId: string;
  channel: string;
  leadId: string;
  phone: string | null;
  name: string | null;
  messageIds: string[];
  type: "text" | "reply" | "unsupported";
  text: string | null;
  replyId: string | null;
  receivedAt: string;
};
export type State = {
  stage: string;
  questionIndex: number;
  answers: Record<string, string | number>;
  failures: number;
  offeredSlots: unknown[];
  declined: boolean;
  appointment: unknown;
  firstContactAt: string;
  lastContactAt: string;
};
export type Context = {
  valid: boolean;
  event: Event;
  config: Config;
  state: State;
  stateError: boolean;
  isNew: boolean;
  question: Config["qualification"]["questions"][number] | null;
  directAnswer: string | null;
  now: string;
  needsAI?: boolean;
};
export type Request = Record<string, unknown>;
export type Plan = {
  state: State;
  clientId: string;
  leadId: string;
  crm: Request[];
  outbound:
    | (Request & { text: string; options?: { id: string; label: string }[] })
    | null;
  pause: {
    clientId: string;
    leadKey: string;
    pausedUntil: string;
    reason: string;
  } | null;
  logs: Request[];
  readyForScheduling: boolean;
};
export function validInput(input: unknown): boolean;
export function prepareConversation(
  input: unknown,
  rows: Request[],
  now: string,
): Context;
export function markReadRequest(context: Context): Request;
export function resolveConversation(
  context: Context,
  interpretation?: unknown,
): Plan;
export function safeLog(code: string, clientId: string): Request;
