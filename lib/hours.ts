const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

const LABELS: Record<Weekday, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parkLocalParts(timeZone: string, now = new Date()): { date: string; weekday: Weekday } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = read("weekday").toLowerCase() as Weekday;
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    weekday: WEEKDAYS.includes(weekday) ? weekday : "sunday",
  };
}

export function formatParkDate(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
}

export function hoursKind(value: string | null | undefined): "open" | "closed" | "unknown" {
  if (!value) return "unknown";
  const text = value.trim();
  if (/^closed$/i.test(text)) return "closed";
  if (/all day|sunrise|sunset|\d/i.test(text)) return "open";
  return "unknown";
}

type RawSchedule = {
  name?: unknown;
  description?: unknown;
  standardHours?: unknown;
  exceptions?: unknown;
};

function dayMap(value: unknown): Partial<Record<Weekday, string>> {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const days: Partial<Record<Weekday, string>> = {};
  for (const day of WEEKDAYS) {
    const hours = record[day];
    if (typeof hours === "string" && hours.trim()) days[day] = hours.trim();
  }
  return days;
}

export function resolveSchedule(raw: RawSchedule, today: { date: string; weekday: Weekday } | null) {
  const standard = dayMap(raw.standardHours);
  const exceptions = Array.isArray(raw.exceptions) ? raw.exceptions : [];
  let hours = standard;
  const active = [];
  if (today) {
    for (const item of exceptions) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const start = typeof record.startDate === "string" ? record.startDate : "";
      const end = typeof record.endDate === "string" ? record.endDate : "";
      if (!isIsoDate(start) || !isIsoDate(end) || start > today.date || end < today.date) continue;
      const override = dayMap(record.exceptionHours);
      hours = { ...hours, ...override };
      const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Schedule exception";
      active.push({
        name,
        startDate: start,
        endDate: end,
        hours: override[today.weekday] ?? null,
      });
    }
  }
  const todayText = today ? hours[today.weekday] ?? null : null;
  return {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Hours",
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : null,
    today: today ? hoursKind(todayText) : "unknown" as const,
    todayText,
    week: WEEKDAYS.map((day) => ({ day: LABELS[day], hours: hours[day] ?? "Not listed" })),
    activeExceptions: active,
  };
}

export function preferredSchedule<T extends { name: string }>(schedules: T[]): T | null {
  return schedules.find((schedule) => /park/i.test(schedule.name)) ?? schedules[0] ?? null;
}
