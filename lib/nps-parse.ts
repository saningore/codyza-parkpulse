import { finiteCoordinate } from "@/lib/geo";
import { preferredSchedule, resolveSchedule, type Weekday } from "@/lib/hours";
import { clip, htmlToText, textOrNull } from "@/lib/text";
import type {
  AccessibilityFact,
  Activity,
  Alert,
  Campground,
  FeatureCollection,
  Fee,
  ParkDetail,
  ParkEvent,
  ParkImage,
  ParkSummary,
  RoadEvent,
  VisitorCenter,
} from "@/lib/types";
import { httpsUrl } from "@/lib/url";

export function pageInfo(body: unknown): { total: number; data: unknown[] } {
  if (!body || typeof body !== "object") return { total: 0, data: [] };
  const record = body as Record<string, unknown>;
  const data = Array.isArray(record.data) ? record.data : [];
  const total = Number(record.total);
  return { total: Number.isFinite(total) ? total : data.length, data };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function idOf(value: Record<string, unknown>, fallback: string): string {
  const id = textOrNull(value.id);
  return id ?? fallback;
}

export function parseImage(value: unknown): ParkImage | null {
  const image = record(value);
  if (!image) return null;
  const url = httpsUrl(image.url, ["nps.gov"]);
  if (!url) return null;
  return {
    url,
    alt: htmlToText(image.altText) ?? htmlToText(image.title) ?? "National Park Service photograph",
    caption: htmlToText(image.caption),
    credit: htmlToText(image.credit),
  };
}

function schedulesFrom(value: unknown, today: { date: string; weekday: Weekday } | null) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => resolveSchedule(record(item) ?? {}, today));
}

function feesFrom(value: unknown, kind: "fee" | "pass"): Fee[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const fee = record(item);
    if (!fee) return [];
    const title = htmlToText(fee.title) ?? htmlToText(fee.entranceFeeType);
    if (!title) return [];
    const cost = textOrNull(fee.cost) ?? (typeof fee.cost === "number" ? String(fee.cost) : null);
    return [{ title, cost, description: htmlToText(fee.description), kind }];
  });
}

export function parsePark(value: unknown, today: { date: string; weekday: Weekday } | null): ParkDetail | null {
  const park = record(value);
  if (!park) return null;
  const parkCode = textOrNull(park.parkCode)?.toLowerCase();
  const fullName = htmlToText(park.fullName);
  if (!parkCode || !fullName || !/^[a-z]{4}$/.test(parkCode)) return null;
  const phoneList = record(park.contacts);
  const numbers = Array.isArray(phoneList?.phoneNumbers) ? phoneList.phoneNumbers : [];
  const phone = textOrNull(record(numbers[0])?.phoneNumber);
  const activities = Array.isArray(park.activities)
    ? park.activities.flatMap((item) => {
      const name = htmlToText(record(item)?.name);
      return name ? [name] : [];
    })
    : [];
  return {
    parkCode,
    fullName,
    designation: htmlToText(park.designation),
    states: textOrNull(park.states),
    description: htmlToText(park.description),
    url: httpsUrl(park.url),
    latitude: finiteCoordinate(park.latitude, 90),
    longitude: finiteCoordinate(park.longitude, 180),
    directions: htmlToText(park.directionsInfo),
    directionsUrl: httpsUrl(park.directionsUrl),
    weatherOverview: htmlToText(park.weatherInfo),
    phone,
    images: Array.isArray(park.images) ? park.images.flatMap((item) => {
      const image = parseImage(item);
      return image ? [image] : [];
    }) : [],
    activities,
    schedules: schedulesFrom(park.operatingHours, today),
    fees: [...feesFrom(park.entranceFees, "fee"), ...feesFrom(park.entrancePasses, "pass")],
  };
}

export function toSummary(park: ParkDetail): ParkSummary {
  return {
    parkCode: park.parkCode,
    fullName: park.fullName,
    designation: park.designation,
    states: park.states,
    latitude: park.latitude,
    longitude: park.longitude,
    description: clip(park.description, 180),
    imageUrl: park.images[0]?.url ?? null,
    imageAlt: park.images[0]?.alt ?? null,
    distanceMiles: null,
  };
}

export function parseAlerts(rows: unknown[]): Alert[] {
  return rows.flatMap((item, index) => {
    const alert = record(item);
    if (!alert) return [];
    const title = htmlToText(alert.title);
    const description = htmlToText(alert.description);
    if (!title || !description) return [];
    return [{
      id: idOf(alert, `alert-${index}`),
      title,
      description,
      category: textOrNull(alert.category) ?? "Information",
      url: httpsUrl(alert.url),
      lastIndexed: textOrNull(alert.lastIndexedDate),
    }];
  });
}

const ACCESS_LABELS: Record<string, string> = {
  wheelchairAccess: "Wheelchair access",
  rvAllowed: "RV access",
  rvInfo: "RV details",
  rvMaxLength: "RV maximum length",
  trailerMaxLength: "Trailer maximum length",
  trailerAllowed: "Trailer access",
  additionalInfo: "Additional access notes",
  adaInfo: "Accessibility notes",
  accessRoads: "Access roads",
  classifications: "Classifications",
  internetInfo: "Internet",
  cellPhoneInfo: "Cell phone",
  fireStovePolicy: "Fire and stove policy",
};

export function parseCampgrounds(rows: unknown[], today: { date: string; weekday: Weekday } | null): Campground[] {
  return rows.flatMap((item, index) => {
    const camp = record(item);
    if (!camp) return [];
    const name = htmlToText(camp.name);
    if (!name) return [];
    const sites = record(camp.campsites);
    const access = record(camp.accessibility);
    const accessibility = access
      ? Object.entries(ACCESS_LABELS).flatMap(([key, label]) => {
        const value = htmlToText(access[key]);
        return value ? [{ label, value }] : [];
      })
      : [];
    const schedules = schedulesFrom(camp.operatingHours, today);
    return [{
      id: idOf(camp, `camp-${index}`),
      name,
      description: htmlToText(camp.description),
      url: httpsUrl(camp.url),
      reservationUrl: httpsUrl(camp.reservationUrl, ["recreation.gov", "nps.gov"]),
      latitude: finiteCoordinate(camp.latitude, 90),
      longitude: finiteCoordinate(camp.longitude, 180),
      totalSites: textOrNull(sites?.totalSites) ?? (typeof sites?.totalSites === "number" ? String(sites.totalSites) : null),
      regulations: htmlToText(camp.regulationsOverview),
      schedule: schedules[0] ?? null,
      accessibility,
    }];
  });
}

export function parseVisitorCenters(rows: unknown[], today: { date: string; weekday: Weekday } | null): VisitorCenter[] {
  return rows.flatMap((item, index) => {
    const center = record(item);
    if (!center) return [];
    const name = htmlToText(center.name);
    if (!name) return [];
    const contacts = record(center.contacts);
    const numbers = Array.isArray(contacts?.phoneNumbers) ? contacts.phoneNumbers : [];
    const amenities = Array.isArray(center.amenities)
      ? center.amenities.flatMap((amenity) => {
        if (typeof amenity === "string") return amenity.trim() ? [amenity.trim()] : [];
        const label = htmlToText(record(amenity)?.name);
        return label ? [label] : [];
      })
      : [];
    const schedules = schedulesFrom(center.operatingHours, today);
    return [{
      id: idOf(center, `center-${index}`),
      name,
      description: htmlToText(center.description),
      url: httpsUrl(center.url),
      phone: textOrNull(record(numbers[0])?.phoneNumber),
      latitude: finiteCoordinate(center.latitude, 90),
      longitude: finiteCoordinate(center.longitude, 180),
      directions: htmlToText(center.directionsInfo),
      schedule: schedules[0] ?? null,
      amenities,
    }];
  });
}

function looseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!us) return null;
  return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
}

export function parseEvents(rows: unknown[], today: string | null): ParkEvent[] {
  return rows.flatMap((item, index) => {
    const event = record(item);
    if (!event) return [];
    const title = htmlToText(event.title);
    if (!title) return [];
    const start = looseDate(event.datestart ?? event.dateStart ?? event.date);
    const end = looseDate(event.dateend ?? event.dateEnd) ?? start;
    if (!today || !start || !end || start > today || end < today) return [];
    const times = Array.isArray(event.times) ? event.times : [];
    const first = record(times[0]);
    const startTime = textOrNull(first?.timestart) ?? textOrNull(first?.timeStart);
    const endTime = textOrNull(first?.timeend) ?? textOrNull(first?.timeEnd);
    const time = startTime ? (endTime ? `${startTime} – ${endTime}` : startTime) : event.isAllDay || event.isallday ? "All day" : null;
    return [{
      id: idOf(event, `event-${index}`),
      title,
      description: clip(htmlToText(event.description), 400),
      location: htmlToText(event.location),
      time: typeof time === "string" ? time : null,
      url: httpsUrl(event.url),
      recurring: Boolean(event.isrecurring ?? event.isRecurring),
    }];
  });
}

export function parseActivities(rows: unknown[]): Activity[] {
  return rows.flatMap((item, index) => {
    const activity = record(item);
    if (!activity) return [];
    const title = htmlToText(activity.title);
    if (!title) return [];
    return [{
      id: idOf(activity, `activity-${index}`),
      title,
      summary: clip(htmlToText(activity.shortDescription) ?? htmlToText(activity.longDescription), 280),
      duration: htmlToText(activity.duration) ?? htmlToText(activity.durationDescription),
      location: htmlToText(activity.location),
      accessibility: htmlToText(activity.accessibilityInformation),
      url: httpsUrl(activity.url),
    }];
  });
}

export function parseFeePayload(body: unknown, fallback: Fee[]): Fee[] {
  const first = pageInfo(body).data[0];
  const row = record(first);
  if (!row) return fallback;
  const parsed = [
    ...feesFrom(row.fees ?? row.entranceFees, "fee"),
    ...feesFrom(row.passes ?? row.entrancePasses, "pass"),
  ];
  const seen = new Set<string>();
  const unique = parsed.filter((fee) => {
    const key = `${fee.kind}:${fee.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length ? unique : fallback;
}

export function parseRoadEvents(rows: unknown[]): RoadEvent[] {
  return rows.flatMap((item, index) => {
    const event = record(item);
    if (!event) return [];
    const title = htmlToText(event.title) ?? htmlToText(event.roadwayName) ?? "Road event";
    const description = htmlToText(event.description) ?? "";
    if (!description && title === "Road event") return [];
    return [{
      id: idOf(event, `road-${index}`),
      title,
      description,
      eventType: textOrNull(event.category) ?? textOrNull(event.eventType) ?? textOrNull(event.eventtype) ?? "Road event",
      url: httpsUrl(event.url),
      startDate: looseDate(event.startDate ?? event.startdate),
      endDate: looseDate(event.endDate ?? event.enddate),
    }];
  });
}

export function roadAffectsToday(event: RoadEvent, today: string | null): boolean {
  if (/completed|cleared|ended/i.test(`${event.title} ${event.description}`)) return false;
  if (event.startDate && event.endDate && today) return event.startDate <= today && today <= event.endDate;
  return true;
}

export function parseAmenityFacts(body: unknown): AccessibilityFact[] {
  return pageInfo(body).data.flatMap((item) => {
    const amenity = record(item);
    if (!amenity) return [];
    const name = htmlToText(amenity.name);
    if (!name || !/access|wheelchair|assistive|audio description|braille/i.test(name)) return [];
    const parks = Array.isArray(amenity.parks) ? amenity.parks : [];
    const places = parks.flatMap((park) => {
      const row = record(park);
      if (!row) return [];
      const centers = Array.isArray(row.visitorcenters) ? row.visitorcenters : Array.isArray(row.places) ? row.places : [];
      return centers.flatMap((center) => {
        const label = htmlToText(record(center)?.name);
        return label ? [label] : [];
      });
    });
    if (!places.length) return [{ label: name, value: "Listed for this park" }];
    return places.map((place) => ({ label: name, value: place }));
  });
}

export function asFeatureCollection(body: unknown): FeatureCollection | null {
  const value = record(body);
  if (!value) return null;
  if (value.type === "FeatureCollection" && Array.isArray(value.features)) {
    return { type: "FeatureCollection", features: value.features.filter(isFeature) };
  }
  if (value.type === "Feature" && isFeature(value)) return { type: "FeatureCollection", features: [value] };
  if (typeof value.type === "string" && value.coordinates) {
    return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: value.type, coordinates: value.coordinates }, properties: {} }] };
  }
  const nested = record(value.geometry);
  if (nested?.type && nested.coordinates) {
    return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: String(nested.type), coordinates: nested.coordinates }, properties: {} }] };
  }
  return null;
}

function isFeature(value: unknown): value is FeatureCollection["features"][number] {
  const feature = record(value);
  const geometry = record(feature?.geometry);
  return Boolean(feature && geometry && typeof geometry.type === "string" && geometry.coordinates);
}

export function primaryHours(park: ParkDetail): { today: "open" | "closed" | "unknown"; text: string | null } {
  const schedule = preferredSchedule(park.schedules);
  if (!schedule) return { today: "unknown", text: null };
  return { today: schedule.today, text: schedule.todayText };
}
