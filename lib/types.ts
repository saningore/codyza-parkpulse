export const UNAVAILABLE = "Information unavailable";

export const USER_AGENT = "ParkPulse/1.0 (https://codyza.com)";

export type VerdictStatus = "unconfirmed" | "closed" | "hazard" | "restricted" | "caution" | "open";

export type HoursToday = "open" | "closed" | "unknown";

export type SourceWarning = { source: string; message: string };

export type ParkImage = {
  url: string;
  alt: string;
  caption: string | null;
  credit: string | null;
};

export type DayHours = {
  day: string;
  hours: string;
};

export type HourException = {
  name: string;
  startDate: string;
  endDate: string;
  hours: string | null;
};

export type HourSchedule = {
  name: string;
  description: string | null;
  today: HoursToday;
  todayText: string | null;
  week: DayHours[];
  activeExceptions: HourException[];
};

export type ParkSummary = {
  parkCode: string;
  fullName: string;
  designation: string | null;
  states: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  distanceMiles: number | null;
};

export type Alert = {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string | null;
  lastIndexed: string | null;
};

export type Campground = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  reservationUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  totalSites: string | null;
  regulations: string | null;
  schedule: HourSchedule | null;
  accessibility: { label: string; value: string }[];
};

export type VisitorCenter = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  directions: string | null;
  schedule: HourSchedule | null;
  amenities: string[];
};

export type ParkEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  time: string | null;
  url: string | null;
  recurring: boolean;
};

export type Activity = {
  id: string;
  title: string;
  summary: string | null;
  duration: string | null;
  location: string | null;
  accessibility: string | null;
  url: string | null;
};

export type Fee = {
  title: string;
  cost: string | null;
  description: string | null;
  kind: "fee" | "pass";
};

export type RoadEvent = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  url: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type WeatherPeriod = {
  name: string;
  temperature: string;
  wind: string | null;
  shortForecast: string;
  detailedForecast: string | null;
  precipitation: string | null;
  isDaytime: boolean;
};

export type WeatherReport = {
  updated: string | null;
  periods: WeatherPeriod[];
  placeLabel: string | null;
};

export type WeatherAlert = {
  id: string;
  event: string;
  headline: string | null;
  severity: string | null;
  description: string | null;
  instruction: string | null;
};

export type AccessibilityFact = { label: string; value: string };

export type Notice = {
  id: string;
  title: string;
  detail: string;
  place: string | null;
};

export type MapPoint = {
  id: string;
  name: string;
  kind: "visitor-center" | "campground" | "park";
  latitude: number;
  longitude: number;
  href: string | null;
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: { type: "Feature"; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }[];
};

export type Verdict = {
  status: VerdictStatus;
  label: string;
  reason: string;
  hoursToday: HoursToday;
  hoursText: string | null;
};

export type ParkDetail = {
  parkCode: string;
  fullName: string;
  designation: string | null;
  states: string | null;
  description: string | null;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  directions: string | null;
  directionsUrl: string | null;
  weatherOverview: string | null;
  phone: string | null;
  images: ParkImage[];
  activities: string[];
  schedules: HourSchedule[];
  fees: Fee[];
};

export type ParkConditions = {
  park: ParkDetail;
  verdict: Verdict;
  alerts: Alert[] | null;
  campgrounds: Campground[] | null;
  notices: Notice[];
  visitorCenters: VisitorCenter[] | null;
  events: ParkEvent[] | null;
  activities: Activity[] | null;
  fees: Fee[] | null;
  accessibility: AccessibilityFact[] | null;
  roadEvents: RoadEvent[] | null;
  weather: WeatherReport | null;
  weatherAlerts: WeatherAlert[] | null;
  boundary: FeatureCollection | null;
  points: MapPoint[];
  warnings: SourceWarning[];
  retrievedAt: string;
  timeZone: string | null;
  todayLabel: string | null;
  usingFixtures: boolean;
};
