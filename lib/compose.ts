import { getDirectoryPark } from "@/lib/directory";
import { ConfigError, UpstreamError } from "@/lib/errors";
import { formatParkDate, parkLocalParts, preferredSchedule } from "@/lib/hours";
import { campgroundNotices } from "@/lib/notices";
import { npsBoundary, npsCollection, npsGet } from "@/lib/nps";
import {
  asFeatureCollection,
  parseActivities,
  parseAlerts,
  parseAmenityFacts,
  parseCampgrounds,
  parseEvents,
  parseFeePayload,
  parsePark,
  parseRoadEvents,
  parseVisitorCenters,
  roadAffectsToday,
} from "@/lib/nps-parse";
import { nwsAlerts, nwsForecast, nwsPoints } from "@/lib/nws";
import { publicParkAlerts } from "@/lib/public-alerts";
import { parseStructuredPark, publicStructuredRecord, type StructuredPark } from "@/lib/structured-park";
import { REVALIDATE, hasNpsKey, usingFixtures } from "@/lib/runtime";
import type {
  AccessibilityFact,
  Activity,
  Alert,
  Campground,
  FeatureCollection,
  Fee,
  MapPoint,
  ParkConditions,
  ParkDetail,
  ParkEvent,
  RoadEvent,
  SourceWarning,
  VisitorCenter,
  WeatherAlert,
  WeatherReport,
} from "@/lib/types";
import { decideVerdict } from "@/lib/verdict";

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function isoShift(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

const NPS_DISCONNECTED = "Official alerts, hours, closures, campgrounds, and fees are not connected on this server. The visit status stays unconfirmed. Check the official park page before you travel.";
const NPS_HOURS_ONLY = "Hours, campgrounds, and fees are not connected on this server. Alerts and closures on this page come from the public National Park Service alerts list. Check the official park page before you travel.";
const NPS_PUBLIC = "Road events, today's events, and the park outline come from the NPS Data API, which is not connected. Alerts, hours, fees, and campgrounds are from National Park Service public pages.";

export async function loadParkConditions(parkCode: string, now = new Date()): Promise<ParkConditions | null> {
  const code = parkCode.toLowerCase();
  if (!/^[a-z]{4}$/.test(code)) return null;
  if (usingFixtures() || hasNpsKey()) {
    try {
      return await loadLiveParkConditions(code, now);
    } catch (error) {
      if (usingFixtures()) throw error;
      const stored = getDirectoryPark(code);
      if (stored && (error instanceof UpstreamError || error instanceof ConfigError)) {
        console.error(`Live National Park Service conditions failed for ${code}: ${error.message}`);
        return loadStoredParkConditions(stored, now);
      }
      throw error;
    }
  }
  const stored = getDirectoryPark(code);
  if (!stored) return null;
  return loadStoredParkConditions(stored, now);
}

async function loadLiveParkConditions(parkCode: string, now = new Date()): Promise<ParkConditions | null> {
  const code = parkCode.toLowerCase();
  if (!/^[a-z]{4}$/.test(code)) return null;
  const parkRows = await npsCollection(`/parks?parkCode=${code}`, REVALIDATE.park, 50);
  if (!parkRows.length) return null;
  const rough = parsePark(parkRows[0], null);
  if (!rough) return null;

  const [alertsR, campsR, centersR, eventsR, activitiesR, feesR, roadsR, amenitiesR, boundaryR, pointsR] = await Promise.allSettled([
    npsCollection(`/alerts?parkCode=${code}`, REVALIDATE.alerts, 200),
    npsCollection(`/campgrounds?parkCode=${code}`, REVALIDATE.park, 100),
    npsCollection(`/visitorcenters?parkCode=${code}`, REVALIDATE.park, 100),
    npsCollection(`/events?parkCode=${code}&dateStart=${isoShift(now, -1)}&dateEnd=${isoShift(now, 2)}`, REVALIDATE.events, 100),
    npsCollection(`/thingstodo?parkCode=${code}`, REVALIDATE.park, 100),
    npsGet(`/feespasses?parkCode=${code}&limit=10`, REVALIDATE.park),
    npsCollection(`/roadevents?parkCode=${code}`, REVALIDATE.alerts, 100),
    npsGet(`/amenities/parksvisitorcenters?parkCode=${code}&limit=100`, REVALIDATE.park),
    npsBoundary(code),
    rough.latitude !== null && rough.longitude !== null ? nwsPoints(rough.latitude, rough.longitude) : Promise.resolve(null),
  ]);

  const points = settled(pointsR);
  const timeZone = points?.timeZone ?? null;
  const local = timeZone ? parkLocalParts(timeZone, now) : null;
  const park = parsePark(parkRows[0], local) ?? rough;

  let weather: WeatherReport | null = null;
  let weatherFailed = pointsR.status === "rejected" || !points?.forecastUrl;
  let weatherAlerts: WeatherAlert[] | null = null;
  let weatherAlertsFailed = pointsR.status === "rejected";
  if (points?.forecastUrl && rough.latitude !== null && rough.longitude !== null) {
    const [forecastR, weatherAlertsR] = await Promise.allSettled([
      nwsForecast(points.forecastUrl, points.placeLabel),
      nwsAlerts(rough.latitude, rough.longitude),
    ]);
    weather = settled(forecastR);
    weatherFailed = forecastR.status === "rejected" || !weather?.periods.length;
    weatherAlerts = settled(weatherAlertsR);
    weatherAlertsFailed = weatherAlertsR.status === "rejected";
  } else if (rough.latitude === null || rough.longitude === null) {
    weatherFailed = true;
    weatherAlertsFailed = true;
  }

  return buildConditions({
    park,
    alerts: alertsR.status === "fulfilled" ? parseAlerts(alertsR.value) : null,
    campgrounds: campsR.status === "fulfilled" ? parseCampgrounds(campsR.value, local) : null,
    visitorCenters: centersR.status === "fulfilled" ? parseVisitorCenters(centersR.value, local) : null,
    events: eventsR.status === "fulfilled" && local ? parseEvents(eventsR.value, local.date) : null,
    eventsFailed: eventsR.status === "rejected" || !local,
    activities: activitiesR.status === "fulfilled" ? parseActivities(activitiesR.value) : null,
    fees: feesR.status === "fulfilled" ? parseFeePayload(feesR.value, park.fees) : park.fees.length ? park.fees : null,
    feesFromParkOnly: feesR.status === "rejected" && park.fees.length > 0,
    amenityFacts: amenitiesR.status === "fulfilled" ? parseAmenityFacts(amenitiesR.value) : null,
    roadEvents: roadsR.status === "fulfilled" ? parseRoadEvents(roadsR.value) : null,
    boundary: boundaryR.status === "fulfilled" && boundaryR.value ? asFeatureCollection(boundaryR.value) : null,
    boundaryFailed: boundaryR.status === "rejected" || (boundaryR.status === "fulfilled" && boundaryR.value !== null && !asFeatureCollection(boundaryR.value)),
    weather: weatherFailed ? null : weather,
    weatherFailed,
    weatherAlerts: weatherAlertsFailed ? null : weatherAlerts ?? [],
    weatherAlertsFailed,
    timeZone,
    now,
  });
}

async function loadPublicAlerts(parkCode: string, now: Date): Promise<Alert[] | null> {
  try {
    return await publicParkAlerts(parkCode, now);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`Public National Park Service alerts failed for ${parkCode}: ${message}`);
    return null;
  }
}

async function loadPublicRecord(parkCode: string): Promise<unknown | null> {
  try {
    return await publicStructuredRecord(parkCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`Public National Park Service park record failed for ${parkCode}: ${message}`);
    return null;
  }
}

function withPublicRecord(park: ParkDetail, record: StructuredPark): ParkDetail {
  return {
    ...park,
    description: record.description ?? park.description,
    directions: record.directions ?? park.directions,
    directionsUrl: record.directionsUrl ?? park.directionsUrl,
    weatherOverview: record.weatherOverview ?? park.weatherOverview,
    phone: record.phone ?? park.phone,
    url: record.url ?? park.url,
    images: record.images.length ? record.images : park.images,
    schedules: record.schedules.length ? record.schedules : park.schedules,
    fees: record.fees.length ? record.fees : park.fees,
  };
}

async function loadStoredParkConditions(park: ParkDetail, now: Date): Promise<ParkConditions> {
  const alertsTask = loadPublicAlerts(park.parkCode, now);
  const recordTask = loadPublicRecord(park.parkCode);
  let timeZone: string | null = null;
  let weather: WeatherReport | null = null;
  let weatherFailed = park.latitude === null || park.longitude === null;
  let weatherAlerts: WeatherAlert[] | null = null;
  let weatherAlertsFailed = weatherFailed;
  if (park.latitude !== null && park.longitude !== null) {
    try {
      const points = await nwsPoints(park.latitude, park.longitude);
      timeZone = points.timeZone;
      const [forecastResult, alertsResult] = await Promise.allSettled([
        points.forecastUrl ? nwsForecast(points.forecastUrl, points.placeLabel) : Promise.resolve(null),
        nwsAlerts(park.latitude, park.longitude),
      ]);
      weather = forecastResult.status === "fulfilled" ? forecastResult.value : null;
      weatherFailed = forecastResult.status === "rejected" || !weather?.periods.length;
      weatherAlerts = alertsResult.status === "fulfilled" ? alertsResult.value : null;
      weatherAlertsFailed = alertsResult.status === "rejected";
    } catch {
      weatherFailed = true;
      weatherAlertsFailed = true;
    }
  }
  const [alerts, record] = await Promise.all([alertsTask, recordTask]);
  const local = timeZone ? parkLocalParts(timeZone, now) : null;
  const structured = record ? parseStructuredPark(record, local) : null;
  return buildConditions({
    park: structured ? withPublicRecord(park, structured) : park,
    alerts,
    campgrounds: structured ? structured.campgrounds : null,
    visitorCenters: structured ? structured.visitorCenters : null,
    events: null,
    eventsFailed: false,
    activities: null,
    fees: structured ? structured.fees : null,
    feesFromParkOnly: false,
    amenityFacts: null,
    roadEvents: null,
    boundary: null,
    boundaryFailed: false,
    weather: weatherFailed ? null : weather,
    weatherFailed,
    weatherAlerts: weatherAlertsFailed ? null : weatherAlerts ?? [],
    weatherAlertsFailed,
    timeZone,
    now,
    npsSkipped: true,
    publicRecord: structured !== null,
  });
}

type BuildInput = {
  park: ParkDetail;
  alerts: Alert[] | null;
  campgrounds: Campground[] | null;
  visitorCenters: VisitorCenter[] | null;
  events: ParkEvent[] | null;
  eventsFailed: boolean;
  activities: Activity[] | null;
  fees: Fee[] | null;
  feesFromParkOnly: boolean;
  amenityFacts: AccessibilityFact[] | null;
  roadEvents: RoadEvent[] | null;
  boundary: FeatureCollection | null;
  boundaryFailed: boolean;
  weather: WeatherReport | null;
  weatherFailed: boolean;
  weatherAlerts: WeatherAlert[] | null;
  weatherAlertsFailed: boolean;
  timeZone: string | null;
  now: Date;
  npsSkipped?: boolean;
  publicRecord?: boolean;
};

export function buildConditions(input: BuildInput): ParkConditions {
  const warnings: SourceWarning[] = [];
  const schedule = preferredSchedule(input.park.schedules);
  const hoursToday = input.timeZone && schedule ? schedule.today : "unknown";
  const localDate = input.timeZone ? parkLocalParts(input.timeZone, input.now).date : null;
  const roads = input.roadEvents ?? [];
  const verdict = decideVerdict({
    alertsLoaded: input.alerts !== null,
    alerts: input.alerts ?? [],
    hoursToday,
    roadEvents: roads.map((event) => ({
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      affectsToday: roadAffectsToday(event, localDate),
    })),
    weatherAlertsLoaded: !input.weatherAlertsFailed,
    weatherAlerts: input.weatherAlerts ?? [],
  });
  verdict.hoursText = schedule?.todayText ?? null;

  if (input.npsSkipped) {
    const message = input.publicRecord ? NPS_PUBLIC : input.alerts === null ? NPS_DISCONNECTED : NPS_HOURS_ONLY;
    warnings.push({ source: "National Park Service", message });
  } else {
    if (input.alerts === null) warnings.push({ source: "Alerts", message: "Park alerts could not be loaded. The visit status stays unconfirmed." });
    if (input.campgrounds === null) warnings.push({ source: "Campgrounds", message: "Campgrounds could not be loaded." });
    if (input.visitorCenters === null) warnings.push({ source: "Visitor centers", message: "Visitor centers could not be loaded." });
    if (input.eventsFailed) warnings.push({ source: "Events", message: input.timeZone ? "Today's events could not be loaded." : "The park time zone could not be confirmed, so today's events are not listed." });
    if (input.activities === null) warnings.push({ source: "Activities", message: "Suggested things to do could not be loaded. Activity names from the park record are still shown when the park record has them." });
    if (input.fees === null) warnings.push({ source: "Fees", message: "Fees could not be loaded." });
    if (input.feesFromParkOnly) warnings.push({ source: "Fees", message: "The fees and passes feed did not load. Fees shown are from the park record." });
    if (input.roadEvents === null) warnings.push({ source: "Roads", message: "Road events could not be loaded. The visit status does not include them." });
  }
  if (input.weatherFailed) warnings.push({ source: "Weather", message: "The National Weather Service forecast could not be loaded." });
  if (input.weatherAlertsFailed) warnings.push({ source: "Weather alerts", message: "National Weather Service alerts could not be loaded." });
  if (input.boundaryFailed) warnings.push({ source: "Map", message: "The park boundary could not be loaded. Places with coordinates are still mapped." });
  if (!input.npsSkipped && input.amenityFacts === null) warnings.push({ source: "Accessibility", message: "The amenity list could not be loaded." });

  const notices = campgroundNotices(input.campgrounds ?? [], input.alerts ?? [], localDate);
  const accessibility = accessFacts(input);
  const points = mapPoints(input.park, input.visitorCenters ?? [], input.campgrounds ?? []);

  return {
    park: input.park,
    verdict,
    alerts: input.alerts === null ? null : sortAlerts(input.alerts),
    campgrounds: input.campgrounds,
    notices,
    visitorCenters: input.visitorCenters,
    events: input.eventsFailed ? null : input.events,
    activities: input.activities,
    fees: input.fees,
    accessibility,
    roadEvents: input.roadEvents,
    weather: input.weather,
    weatherAlerts: input.weatherAlerts,
    boundary: input.boundary,
    points,
    warnings,
    retrievedAt: input.now.toISOString(),
    timeZone: input.timeZone,
    todayLabel: input.timeZone ? formatParkDate(input.timeZone, input.now) : null,
    usingFixtures: usingFixtures(),
  };
}

function accessFacts(input: BuildInput): AccessibilityFact[] | null {
  const anyLoaded = input.campgrounds !== null || input.visitorCenters !== null || input.activities !== null || input.amenityFacts !== null;
  if (!anyLoaded) return null;
  const facts: AccessibilityFact[] = [...(input.amenityFacts ?? [])];
  for (const camp of input.campgrounds ?? []) {
    for (const item of camp.accessibility) facts.push({ label: `${camp.name}: ${item.label}`, value: item.value });
  }
  for (const center of input.visitorCenters ?? []) {
    for (const amenity of center.amenities) {
      if (/access|wheelchair|assistive|audio|braille/i.test(amenity)) facts.push({ label: amenity, value: center.name });
    }
  }
  for (const activity of input.activities ?? []) {
    if (activity.accessibility) facts.push({ label: activity.title, value: activity.accessibility });
  }
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.label}:${fact.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapPoints(park: ParkDetail, centers: VisitorCenter[], camps: Campground[]): MapPoint[] {
  const points: MapPoint[] = [];
  if (park.latitude !== null && park.longitude !== null) {
    points.push({ id: park.parkCode, name: park.fullName, kind: "park", latitude: park.latitude, longitude: park.longitude, href: park.url });
  }
  for (const center of centers) {
    if (center.latitude === null || center.longitude === null) continue;
    points.push({ id: center.id, name: center.name, kind: "visitor-center", latitude: center.latitude, longitude: center.longitude, href: center.url });
  }
  for (const camp of camps) {
    if (camp.latitude === null || camp.longitude === null) continue;
    points.push({ id: camp.id, name: camp.name, kind: "campground", latitude: camp.latitude, longitude: camp.longitude, href: camp.url });
  }
  return points;
}

const ALERT_ORDER = ["danger", "closure", "caution", "information"];

function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => rank(a.category) - rank(b.category) || a.title.localeCompare(b.title));
}

function rank(category: string): number {
  const index = ALERT_ORDER.findIndex((item) => category.toLowerCase().includes(item));
  return index === -1 ? ALERT_ORDER.length : index;
}
