import type { Alert, Campground, Notice } from "@/lib/types";

const CLOSURE_LANGUAGE = /\b(is|are|remains|remain|temporarily|currently)\s+closed\b|\bclosed\s+for\b|\bclosure\b|\bunavailable\b/i;

export function campgroundNotices(campgrounds: Campground[], alerts: Alert[], today: string | null): Notice[] {
  const notices: Notice[] = [];
  for (const camp of campgrounds) {
    for (const exception of camp.schedule?.activeExceptions ?? []) {
      if (today && (exception.startDate > today || exception.endDate < today)) continue;
      notices.push({
        id: `${camp.id}-${exception.name}`,
        title: exception.name,
        detail: exception.hours ? `Listed hours during this exception: ${exception.hours}.` : "A schedule exception covers today.",
        place: camp.name,
      });
    }
    if (camp.regulations && CLOSURE_LANGUAGE.test(camp.regulations)) {
      notices.push({
        id: `${camp.id}-regulations`,
        title: "Campground notice",
        detail: camp.regulations.length > 320 ? `${camp.regulations.slice(0, 319).trimEnd()}…` : camp.regulations,
        place: camp.name,
      });
    }
  }
  for (const alert of alerts) {
    if (!/campground/i.test(`${alert.title} ${alert.description}`)) continue;
    notices.push({
      id: `alert-${alert.id}`,
      title: alert.title,
      detail: alert.description.length > 320 ? `${alert.description.slice(0, 319).trimEnd()}…` : alert.description,
      place: null,
    });
  }
  const seen = new Set<string>();
  return notices.filter((notice) => {
    const key = `${notice.place ?? ""}:${notice.title}:${notice.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
