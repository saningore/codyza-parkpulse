import { afterEach, describe, expect, it, vi } from "vitest";
import { buildConditions } from "@/lib/compose";
import type { AccessibilityFact, Activity, Alert, Campground, ParkDetail, RoadEvent, VisitorCenter, WeatherAlert, WeatherReport } from "@/lib/types";

function park(overrides: Partial<ParkDetail> = {}): ParkDetail {
  return {
    parkCode: "yell",
    fullName: "Yellowstone National Park",
    designation: "National Park",
    states: "WY",
    description: "Geysers",
    url: "https://www.nps.gov/yell/index.htm",
    latitude: 44.428,
    longitude: -110.5885,
    directions: "Follow signs.",
    directionsUrl: null,
    weatherOverview: null,
    phone: "3073447381",
    images: [],
    activities: ["Hiking"],
    schedules: [{
      name: "Park hours",
      description: null,
      today: "open",
      todayText: "All Day",
      week: [],
      activeExceptions: [],
    }],
    fees: [{ title: "Vehicle", cost: "35.00", description: null, kind: "fee" }],
    ...overrides,
  };
}

const weather: WeatherReport = {
  updated: "2026-10-23T18:00:00Z",
  placeLabel: "Yellowstone, WY",
  periods: [{ name: "This Afternoon", temperature: "46°F", wind: "10 mph SW", shortForecast: "Partly Cloudy", detailedForecast: null, precipitation: "10% precipitation", isDaytime: true }],
};

const now = new Date("2026-10-23T18:00:00Z");

function input(overrides: Partial<Parameters<typeof buildConditions>[0]> = {}) {
  return {
    park: park(),
    alerts: [] as Alert[] | null,
    campgrounds: [] as Campground[] | null,
    visitorCenters: [] as VisitorCenter[] | null,
    events: [] as Parameters<typeof buildConditions>[0]["events"],
    eventsFailed: false,
    activities: [] as Activity[] | null,
    fees: park().fees,
    feesFromParkOnly: false,
    amenityFacts: [] as AccessibilityFact[] | null,
    roadEvents: [] as RoadEvent[] | null,
    boundary: null,
    boundaryFailed: false,
    weather,
    weatherFailed: false,
    weatherAlerts: [] as WeatherAlert[] | null,
    weatherAlertsFailed: false,
    timeZone: "America/Denver",
    now,
    ...overrides,
  };
}

describe("assembled conditions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls a fully loaded quiet park open and records the check", () => {
    vi.stubEnv("PARKPULSE_USE_FIXTURES", "");
    const conditions = buildConditions(input());
    expect(conditions.verdict).toMatchObject({ status: "open", label: "Open today", hoursText: "All Day" });
    expect(conditions.warnings).toEqual([]);
    expect(conditions.todayLabel).toMatch(/October 23, 2026/);
    expect(conditions.points.map((point) => point.kind)).toEqual(["park"]);
    expect(conditions.usingFixtures).toBe(false);
    expect(conditions.retrievedAt).toBe(now.toISOString());
  });

  it("sorts alerts, maps places that have coordinates, and dedupes accessibility notes", () => {
    const conditions = buildConditions(input({
      alerts: [
        { id: "info", title: "Passes", description: "Sold at the gate.", category: "Information", url: null, lastIndexed: null },
        { id: "danger", title: "Rockfall", description: "Hazard.", category: "Danger", url: null, lastIndexed: null },
        { id: "closure", title: "Road closed", description: "One road.", category: "Park Closure", url: null, lastIndexed: null },
      ],
      visitorCenters: [{
        id: "albright",
        name: "Albright",
        description: null,
        url: "https://www.nps.gov/yell/planyourvisit/albrightvc.htm",
        phone: null,
        latitude: 44.97,
        longitude: -110.7,
        directions: null,
        schedule: null,
        amenities: ["Wheelchair Accessible"],
      }],
      campgrounds: [{
        id: "madison",
        name: "Madison",
        description: null,
        url: null,
        reservationUrl: null,
        latitude: null,
        longitude: -110,
        totalSites: "278",
        regulations: "The campground is closed for the season.",
        schedule: {
          name: "Campground hours",
          description: null,
          today: "closed",
          todayText: "Closed",
          week: [],
          activeExceptions: [{ name: "Closed for the season", startDate: "2026-10-23", endDate: "2026-10-23", hours: "Closed" }],
        },
        accessibility: [{ label: "Wheelchair access", value: "Some sites." }],
      }],
      activities: [{ id: "geyser", title: "Geyser basin", summary: null, duration: null, location: null, accessibility: "Boardwalks are accessible.", url: null }],
      amenityFacts: [{ label: "Wheelchair Accessible", value: "Albright" }],
    }));

    expect(conditions.alerts?.map((alert) => alert.category)).toEqual(["Danger", "Park Closure", "Information"]);
    expect(conditions.verdict.status).toBe("hazard");
    expect(conditions.points.map((point) => point.kind)).toEqual(["park", "visitor-center"]);
    expect(conditions.notices.map((notice) => notice.title)).toEqual(["Closed for the season", "Campground notice"]);
    expect(conditions.accessibility).toEqual([
      { label: "Wheelchair Accessible", value: "Albright" },
      { label: "Madison: Wheelchair access", value: "Some sites." },
      { label: "Geyser basin", value: "Boardwalks are accessible." },
    ]);
  });

  it("names each source that failed and refuses to call the park open", () => {
    const conditions = buildConditions(input({
      timeZone: null,
      alerts: null,
      campgrounds: null,
      visitorCenters: null,
      events: null,
      eventsFailed: true,
      activities: null,
      fees: null,
      amenityFacts: null,
      roadEvents: null,
      boundaryFailed: true,
      weather: null,
      weatherFailed: true,
      weatherAlerts: null,
      weatherAlertsFailed: true,
    }));
    expect(conditions.verdict.status).toBe("unconfirmed");
    expect(conditions.events).toBeNull();
    expect(conditions.accessibility).toBeNull();
    expect(conditions.todayLabel).toBeNull();
    expect(conditions.warnings.map((warning) => warning.source)).toEqual([
      "Alerts",
      "Campgrounds",
      "Visitor centers",
      "Events",
      "Activities",
      "Fees",
      "Roads",
      "Weather",
      "Weather alerts",
      "Map",
      "Accessibility",
    ]);
    expect(conditions.warnings.find((warning) => warning.source === "Events")?.message).toMatch(/time zone could not be confirmed/);
  });

  it("ignores a cleared or out-of-window road event and keeps park-record fees when the fee feed fails", () => {
    const cleared = buildConditions(input({
      roadEvents: [
        { id: "old", title: "Crash", description: "The crash cleared.", eventType: "Incident", url: null, startDate: "2026-10-23", endDate: "2026-10-23" },
        { id: "past", title: "Construction", description: "Shoulder work.", eventType: "Construction", url: null, startDate: "2020-01-01", endDate: "2020-01-02" },
      ],
    }));
    expect(cleared.verdict.status).toBe("open");

    const liveRoad = buildConditions(input({
      roadEvents: [
        { id: "live", title: "Crash", description: "Lane blocked.", eventType: "Incident", url: null, startDate: "2026-10-01", endDate: "2026-10-31" },
      ],
    }));
    expect(liveRoad.verdict.status).toBe("restricted");

    const fees = buildConditions(input({ fees: park().fees, feesFromParkOnly: true }));
    expect(fees.fees?.[0].title).toBe("Vehicle");
    expect(fees.warnings.map((warning) => warning.message).join(" ")).toMatch(/Fees shown are from the park record/);
    expect(fees.warnings.some((warning) => warning.message === "Fees could not be loaded.")).toBe(false);
  });

  it("says events failed when the time zone is known but the feed did not load", () => {
    const conditions = buildConditions(input({ events: null, eventsFailed: true }));
    expect(conditions.warnings.find((warning) => warning.source === "Events")?.message).toBe("Today's events could not be loaded.");
    expect(conditions.events).toBeNull();
  });
});
