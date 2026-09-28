// Funções puras; este arquivo também é embutido no Code node Calculate slots.
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const LABEL_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function localParts(time, formatter) {
  return Object.fromEntries(
    formatter
      .formatToParts(new Date(time))
      .map((part) => [part.type, part.value]),
  );
}

function wallClock(parts) {
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
}

// Pode haver zero ou dois instantes para um horário local na transição de DST.
function instant(local, formatter, offsets) {
  const matches = [...offsets]
    .map((offset) => local - offset)
    .filter(
      (candidate) => wallClock(localParts(candidate, formatter)) === local,
    );
  return matches.length === 1 ? matches[0] : null;
}

export function calculateSlots({ timezone, scheduling, busy, now, limit }) {
  const current = Date.parse(now);
  const earliest = current + scheduling.minNoticeHours * 60 * MINUTE;
  const horizon = current + scheduling.daysAhead * DAY;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const first = localParts(current, formatter);
  const last = localParts(horizon, formatter);
  const firstDay = Date.UTC(+first.year, +first.month - 1, +first.day);
  const lastDay = Date.UTC(+last.year, +last.month - 1, +last.day);
  const occupied = busy.map((range) => ({
    start: Date.parse(range.start),
    end: Date.parse(range.end),
  }));
  if (
    occupied.some(
      (range) =>
        !Number.isFinite(range.start) ||
        !Number.isFinite(range.end) ||
        range.end <= range.start,
    )
  ) {
    throw new Error("Intervalo de ocupação inválido.");
  }
  const slots = [];
  for (let day = firstDay; day <= lastDay; day += DAY) {
    const weekday = new Date(day).getUTCDay();
    const offsets = new Set(
      [-36, -12, 0, 12, 36].map((hours) => {
        const sample = day + hours * 60 * MINUTE;
        return wallClock(localParts(sample, formatter)) - sample;
      }),
    );
    for (const range of scheduling.hours[WEEKDAYS[weekday]] ?? []) {
      const [startHour, startMinute, endHour, endMinute] = range
        .split(/[:-]/)
        .map(Number);
      const from = startHour * 60 + startMinute;
      const until = endHour * 60 + endMinute;
      for (
        let minute = from;
        minute + scheduling.durationMinutes <= until;
        minute += scheduling.durationMinutes
      ) {
        const start = instant(day + minute * MINUTE, formatter, offsets);
        const end = instant(
          day + (minute + scheduling.durationMinutes) * MINUTE,
          formatter,
          offsets,
        );
        if (
          start === null ||
          end === null ||
          end - start !== scheduling.durationMinutes * MINUTE
        )
          continue;
        if (start < earliest || end > horizon) continue;
        if (occupied.some((range) => start < range.end && end > range.start))
          continue;
        const parts = localParts(start, formatter);
        slots.push({
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          label: `${LABEL_DAYS[weekday]} ${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`,
        });
      }
    }
    if (slots.length >= limit) break;
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start)).slice(0, limit);
}
