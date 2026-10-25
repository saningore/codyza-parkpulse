import { finiteCoordinate } from "@/lib/geo";
import { resolveSchedule, type Weekday } from "@/lib/hours";
import { UpstreamError } from "@/lib/errors";
import { fetchJson } from "@/lib/http";
import { htmlToText, textOrNull } from "@/lib/text";
import type { Campground, Fee, HourSchedule, ParkImage, VisitorCenter } from "@/lib/types";
import { httpsUrl } from "@/lib/url";
import { REVALIDATE } from "@/lib/runtime";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const TEN_MINUTES = 10 * 60 * 1000;
const CACHE_LIMIT = 40;

type Cache = { expires: number; body: unknown };
const cache = new Map<string, Cache>();

export type StructuredPark = {
  description: string | null;
  directions: string | null;
  directionsUrl: string | null;
  weatherOverview: string | null;
  phone: string | null;
  url: string | null;
  images: ParkImage[];
  schedules: HourSchedule[];
  fees: Fee[];
  campgrounds: Campground[];
  visitorCenters: VisitorCenter[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const row = record(value);
  return row ? Object.values(row) : [];
}

function flag(value: unknown): boolean {
  return value === 1 || value === true || value === "1" || value === "true";
}

function npsUrl(value: unknown): string | null {
  const text = textOrNull(value);
  if (!text) return null;
  const absolute = text.startsWith("/")
    ? `https://www.nps.gov${text}`
    : text.replace(/^http:\/\/((?:www\.)?nps\.gov)\b/i, "https://$1");
  return httpsUrl(absolute);
}

function hoursText(row: Record<string, unknown>): string | null {
  if (flag(row.is_closed)) return "Closed";
  const sunrise = flag(row.sunrise_open);
  const sunset = flag(row.sunset_close);
  const open = textOrNull(row.time_open);
  const close = textOrNull(row.time_close);
  if (sunrise && sunset) return "Sunrise to sunset";
  if (sunrise && close) return `Sunrise - ${close}`;
  if (sunset && open) return `${open} - sunset`;
  if (open && close && /^12:00\s*am$/i.test(open) && /^11:59\s*pm$/i.test(close)) return "All day";
  if (open && close) return `${open} - ${close}`;
  return open ?? close;
}

function weekFrom(value: unknown): Partial<Record<Weekday, string>> {
  const days: Partial<Record<Weekday, string>> = {};
  for (const item of asList(value)) {
    const row = record(item);
    if (!row) continue;
    const index = Number(row.dayOfWeek) - 1;
    const day = WEEKDAYS[index];
    const text = day ? hoursText(row) : null;
    if (day && text) days[day] = text;
  }
  return days;
}

function monthDay(row: Record<string, unknown>, named: unknown, monthKey: string, dayKey: string): { month: number; day: number } | null {
  const month = Number(row[monthKey]);
  const day = Number(row[dayKey]);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  const text = textOrNull(named);
  const match = text?.match(/^([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return null;
  const namedMonth = MONTHS.indexOf(match[1].toLowerCase()) + 1;
  const namedDay = Number(match[2]);
  if (!namedMonth || namedDay < 1 || namedDay > 31) return null;
  return { month: namedMonth, day: namedDay };
}

function realDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function exceptionWindow(row: Record<string, unknown>, today: string): { startDate: string; endDate: string } | null {
  const start = monthDay(row, row.date_start, "month_start_unformatted", "day_start_unformatted");
  const end = monthDay(row, row.date_end, "month_end_unformatted", "day_end_unformatted");
  if (!start || !end) return null;
  const year = Number(today.slice(0, 4));
  const todayKey = Number(today.slice(5, 7)) * 100 + Number(today.slice(8, 10));
  const startKey = start.month * 100 + start.day;
  const endKey = end.month * 100 + end.day;
  const sameYear = startKey <= endKey;
  const covers = sameYear ? todayKey >= startKey && todayKey <= endKey : todayKey >= startKey || todayKey <= endKey;
  if (!covers) return null;
  const startYear = sameYear || todayKey >= startKey ? year : year - 1;
  const endYear = sameYear || todayKey <= endKey ? year : year + 1;
  const startDate = realDate(startYear, start.month, start.day);
  const endDate = realDate(endYear, end.month, end.day);
  return startDate && endDate ? { startDate, endDate } : null;
}

function scheduleFrom(value: unknown, today: { date: string; weekday: Weekday } | null): HourSchedule | null {
  const row = record(value);
  if (!row) return null;
  const name = htmlToText(row.name) ?? htmlToText(row.label);
  if (!name) return null;
  const exceptions = [];
  if (today) {
    for (const item of asList(row.exceptions)) {
      const exception = record(item);
      if (!exception) continue;
      const window = exceptionWindow(exception, today.date);
      if (!window) continue;
      exceptions.push({
        name: htmlToText(exception.name) ?? "Schedule exception",
        startDate: window.startDate,
        endDate: window.endDate,
        exceptionHours: weekFrom(exception.schedule),
      });
    }
  }
  return resolveSchedule({
    name,
    description: htmlToText(row.description),
    standardHours: weekFrom(row.hours),
    exceptions,
  }, today);
}

function schedulesFrom(value: unknown, today: { date: string; weekday: Weekday } | null): HourSchedule[] {
  return asList(value).flatMap((item) => {
    const schedule = scheduleFrom(item, today);
    return schedule ? [schedule] : [];
  });
}

function parkWide(schedules: HourSchedule[]): HourSchedule[] {
  const allPark = schedules.filter((schedule) => /^all park\b/i.test(schedule.name));
  if (allPark.length) return allPark;
  const general = schedules.filter((schedule) => !/^(visitor center|campground)\b/i.test(schedule.name));
  return general.length ? general : schedules.slice(0, 1);
}

function feesFrom(value: unknown, kind: "fee" | "pass"): Fee[] {
  return asList(value).flatMap((item) => {
    const fee = record(item);
    if (!fee) return [];
    const title = htmlToText(fee.title);
    if (!title) return [];
    const cost = textOrNull(fee.cost) ?? (typeof fee.cost === "number" ? String(fee.cost) : null);
    return [{ title, cost, description: htmlToText(fee.description), kind }];
  });
}

function imagesFrom(value: unknown): ParkImage[] {
  return asList(value).flatMap((item) => {
    const image = record(item);
    const url = image ? npsUrl(image.url) : null;
    if (!image || !url) return [];
    return [{
      url,
      alt: htmlToText(image.altText) ?? htmlToText(image.title) ?? "National Park Service photograph",
      caption: htmlToText(image.caption),
      credit: htmlToText(image.credit),
    }];
  }).slice(0, 8);
}

function point(value: unknown): { latitude: number | null; longitude: number | null } {
  const row = record(value);
  return {
    latitude: finiteCoordinate(row?.latitude ?? row?.lat, 90),
    longitude: finiteCoordinate(row?.longitude ?? row?.lng, 180),
  };
}

function idText(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return textOrNull(value) ?? fallback;
}

function fact(label: string, value: unknown): { label: string; value: string }[] {
  if (typeof value === "number") return value > 0 ? [{ label, value: String(value) }] : [];
  const text = htmlToText(value);
  return text ? [{ label, value: text }] : [];
}

function campgroundsFrom(value: unknown, today: { date: string; weekday: Weekday } | null): Campground[] {
  return asList(value).flatMap((item, index) => {
    const camp = record(item);
    if (!camp) return [];
    const name = htmlToText(camp.name);
    if (!name) return [];
    const place = point(camp.location ?? camp);
    const schedules = schedulesFrom(camp.operatingHours, today);
    return [{
      id: idText(camp.campgroundID, `camp-${index}`),
      name,
      description: htmlToText(camp.description),
      url: npsUrl(camp.detailURL) ?? npsUrl(camp.url),
      reservationUrl: httpsUrl(camp.reservationURL, ["recreation.gov", "nps.gov"]),
      latitude: place.latitude,
      longitude: place.longitude,
      totalSites: textOrNull(camp.totalSites) ?? (typeof camp.totalSites === "number" ? String(camp.totalSites) : null),
      regulations: htmlToText(camp.regulations),
      schedule: schedules[0] ?? null,
      accessibility: [
        ...fact("Accessibility notes", camp.accessibility),
        ...fact("Wheelchair access", camp.wheelchairInfo),
        ...fact("Fire and stove policy", camp.fireStovePolicy),
        ...fact("RV maximum length", camp.rvMaxLength),
        ...fact("Trailer maximum length", camp.trailerMaxLength),
        ...fact("Cell phone", camp.cellPhoneInfo),
      ],
    }];
  });
}

function centersFrom(value: unknown, today: { date: string; weekday: Weekday } | null): VisitorCenter[] {
  return asList(value).flatMap((item, index) => {
    const center = record(item);
    if (!center) return [];
    const name = htmlToText(center.name);
    if (!name) return [];
    const place = point(center.location ?? center);
    const amenities = asList(center.amenities).flatMap((amenity) => {
      if (typeof amenity === "string") return amenity.trim() ? [amenity.trim()] : [];
      const label = htmlToText(record(amenity)?.name);
      return label ? [label] : [];
    });
    const schedules = schedulesFrom(center.operatingHours, today);
    return [{
      id: idText(center.visitorCenterID, `center-${index}`),
      name,
      description: htmlToText(center.description),
      url: npsUrl(center.siteURL) ?? npsUrl(center.url),
      phone: textOrNull(center.telephoneNumberVoice),
      latitude: place.latitude,
      longitude: place.longitude,
      directions: htmlToText(center.directions),
      schedule: schedules[0] ?? null,
      amenities,
    }];
  });
}

export function parseStructuredPark(body: unknown, today: { date: string; weekday: Weekday } | null): StructuredPark | null {
  const park = record(body);
  if (!park) return null;
  const schedules = schedulesFrom(park.operatingHours, today);
  return {
    description: htmlToText(park.description),
    directions: htmlToText(park.directions),
    directionsUrl: npsUrl(park.directionsURL) ?? npsUrl(park.directionsUrl),
    weatherOverview: htmlToText(park.weatherText) ?? htmlToText(park.weatherInfo),
    phone: textOrNull(park.telephoneNumberVoice),
    url: npsUrl(park.url),
    images: imagesFrom(park.images),
    schedules: parkWide(schedules),
    fees: [...feesFrom(park.entranceFees, "fee"), ...feesFrom(park.entrancePasses, "pass")],
    campgrounds: campgroundsFrom(park.campgrounds, today),
    visitorCenters: centersFrom(park.visitorCenters, today),
  };
}

export async function publicStructuredRecord(parkCode: string): Promise<unknown> {
  const code = parkCode.toLowerCase();
  if (!/^[a-z]{4}$/.test(code)) throw new UpstreamError("The park code is not valid.");
  if (!process.env.VITEST) {
    const hit = cache.get(code);
    if (hit && hit.expires > Date.now()) return hit.body;
  }
  const response = await fetchJson(`https://www.nps.gov/${code}/structured_data_${code}.json`, REVALIDATE.park, undefined, 20_000);
  if (response.status !== 200 || !record(response.body)) {
    throw new UpstreamError("The National Park Service park page record could not be loaded.");
  }
  if (!process.env.VITEST) {
    cache.delete(code);
    cache.set(code, { expires: Date.now() + TEN_MINUTES, body: response.body });
    while (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }
  return response.body;
}
