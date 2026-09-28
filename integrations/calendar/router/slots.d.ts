export type TimeRange = { start: string; end: string };
export type Slot = TimeRange & { label: string };
export type SlotInput = {
  timezone: string;
  scheduling: {
    durationMinutes: number;
    minNoticeHours: number;
    daysAhead: number;
    hours: Partial<
      Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string[]>
    >;
  };
  busy: TimeRange[];
  now: string;
  limit: number;
};
export function calculateSlots(input: SlotInput): Slot[];
