import { describe, expect, it } from "vitest";
import {
  asFeatureCollection,
  pageInfo,
  parseActivities,
  parseAlerts,
  parseAmenityFacts,
  parseCampgrounds,
  parseEvents,
  parseFeePayload,
  parseImage,
  parsePark,
  parseRoadEvents,
  parseVisitorCenters,
  primaryHours,
  roadAffectsToday,
  toSummary,
} from "@/lib/nps-parse";

const friday = { date: "2026-10-23", weekday: "friday" as const };

describe("NPS envelopes and images", () => {
  it("reads a page and falls back when the total is not a number", () => {
    expect(pageInfo(null)).toEqual({ total: 0, data: [] });
    expect(pageInfo({ total: "12", data: [{ id: 1 }] })).toEqual({ total: 12, data: [{ id: 1 }] });
    expect(pageInfo({ total: "nope", data: [{ id: 1 }, { id: 2 }] }).total).toBe(2);
    expect(pageInfo({}).data).toEqual([]);
  });

  it("keeps an NPS https photo and drops anything else", () => {
    expect(parseImage({ url: "https://www.nps.gov/common/uploads/x.jpg", altText: "<b>Bison</b>", caption: "Herd", credit: "NPS" })).toEqual({
      url: "https://www.nps.gov/common/uploads/x.jpg",
      alt: "Bison",
      caption: "Herd",
      credit: "NPS",
    });
    expect(parseImage({ url: "https://www.nps.gov/common/uploads/x.jpg", title: "Falls" })?.alt).toBe("Falls");
    expect(parseImage({ url: "https://www.nps.gov/common/uploads/x.jpg" })?.alt).toBe("National Park Service photograph");
    expect(parseImage({ url: "http://www.nps.gov/x.jpg" })).toBeNull();
    expect(parseImage(null)).toBeNull();
  });
});

describe("park records", () => {
  const raw = {
    parkCode: "YELL",
    fullName: "<p>Yellowstone National Park</p>",
    designation: "National Park",
    states: "WY,MT,ID",
    description: "A ".repeat(120),
    url: "https://www.nps.gov/yell/index.htm",
    latitude: "44.428",
    longitude: "-110.5885",
    directionsInfo: "Follow signs.",
    directionsUrl: "http://www.nps.gov/yell/directions.htm",
    weatherInfo: "Cold at elevation.",
    contacts: { phoneNumbers: [{ phoneNumber: "307-344-7381" }] },
    activities: [{ name: "Hiking" }, { name: "  " }, null],
    images: [{ url: "https://www.nps.gov/common/uploads/yell.jpg", altText: "Bison" }],
    entranceFees: [{ title: "Vehicle", cost: 35, description: "<p>Per vehicle.</p>" }],
    entrancePasses: [{ title: "Annual", cost: "70.00", description: "Park pass" }],
    operatingHours: [{
      name: "Park hours",
      standardHours: { friday: "All Day" },
      exceptions: [],
    }],
  };

  it("normalizes a park and rejects a record that is not a four-letter site", () => {
    const park = parsePark(raw, friday);
    expect(park?.parkCode).toBe("yell");
    expect(park?.fullName).toBe("Yellowstone National Park");
    expect(park?.latitude).toBe(44.428);
    expect(park?.longitude).toBe(-110.5885);
    expect(park?.directionsUrl).toBeNull();
    expect(park?.phone).toBe("307-344-7381");
    expect(park?.activities).toEqual(["Hiking"]);
    expect(park?.images[0].alt).toBe("Bison");
    expect(park?.fees.map((fee) => [fee.kind, fee.title, fee.cost])).toEqual([
      ["fee", "Vehicle", "35"],
      ["pass", "Annual", "70.00"],
    ]);
    expect(park?.schedules[0].today).toBe("open");
    expect(parsePark({ ...raw, parkCode: "yellow" }, friday)).toBeNull();
    expect(parsePark({ ...raw, fullName: " " }, friday)).toBeNull();
    expect(parsePark(null, friday)).toBeNull();
    expect(parsePark({ ...raw, latitude: "91" }, friday)?.latitude).toBeNull();
  });

  it("clips the summary and keeps the first photo", () => {
    const summary = toSummary(parsePark(raw, friday)!);
    expect(summary.parkCode).toBe("yell");
    expect(summary.description?.endsWith("…")).toBe(true);
    expect(summary.description!.length).toBeLessThanOrEqual(180);
    expect(summary.imageUrl).toBe("https://www.nps.gov/common/uploads/yell.jpg");
    expect(summary.distanceMiles).toBeNull();
  });

  it("reports unknown hours when a park has no schedule", () => {
    const park = parsePark({ ...raw, operatingHours: [] }, friday)!;
    expect(primaryHours(park)).toEqual({ today: "unknown", text: null });
  });
});

describe("alerts, places, events, and roads", () => {
  it("drops incomplete alerts and keeps official links", () => {
    const alerts = parseAlerts([
      null,
      { title: "Bear activity", description: "<p>Give bears room.</p>", category: "Caution", url: "https://www.nps.gov/yell/planyourvisit/conditions.htm", lastIndexedDate: "2026-10-23" },
      { title: "Missing body" },
      { description: "Missing title", category: "Danger" },
    ]);
    expect(alerts).toEqual([{
      id: "alert-1",
      title: "Bear activity",
      description: "Give bears room.",
      category: "Caution",
      url: "https://www.nps.gov/yell/planyourvisit/conditions.htm",
      lastIndexed: "2026-10-23",
    }]);
  });

  it("parses campgrounds and visitor centers for the local day", () => {
    const camps = parseCampgrounds([
      {
        id: "madison",
        name: "<b>Madison</b>",
        url: "https://www.nps.gov/yell/planyourvisit/madison.htm",
        reservationUrl: "https://www.recreation.gov/camping/campsites/232493",
        latitude: "44.6",
        longitude: "-110.8",
        regulationsOverview: "Loop A is closed.",
        campsites: { totalSites: 278 },
        accessibility: { wheelchairAccess: "<p>Some sites.</p>", rvAllowed: "" },
        operatingHours: [{ name: "Campground hours", standardHours: { friday: "Closed" }, exceptions: [] }],
      },
      { name: " " },
      { name: "No reservation", reservationUrl: "https://example.com/book" },
    ], friday);
    expect(camps[0]).toMatchObject({
      id: "madison",
      name: "Madison",
      totalSites: "278",
      reservationUrl: "https://www.recreation.gov/camping/campsites/232493",
      schedule: { today: "closed", todayText: "Closed" },
    });
    expect(camps[0].accessibility).toEqual([{ label: "Wheelchair access", value: "Some sites." }]);
    expect(camps[1].reservationUrl).toBeNull();
    expect(camps).toHaveLength(2);

    const centers = parseVisitorCenters([
      {
        name: "Albright",
        amenities: [" Restrooms ", { name: "Wheelchair Accessible" }, ""],
        contacts: { phoneNumbers: [{ phoneNumber: "307-344-2263" }] },
        operatingHours: [{ name: "Visitor center hours", standardHours: { friday: "9:00AM - 5:00PM" } }],
      },
    ], friday);
    expect(centers[0].amenities).toEqual(["Restrooms", "Wheelchair Accessible"]);
    expect(centers[0].phone).toBe("307-344-2263");
    expect(centers[0].schedule?.today).toBe("open");
  });

  it("keeps events that cover today and reads both date shapes", () => {
    const events = parseEvents([
      {
        id: "talk",
        title: "Ranger talk",
        description: "A short talk.",
        location: "Old Faithful",
        datestart: "2026-10-23T00:00:00",
        dateend: "2026-10-23",
        times: [{ timestart: "2:00 PM", timeend: "2:30 PM" }],
        isrecurring: true,
        url: "https://www.nps.gov/yell/planyourvisit/events.htm",
      },
      { title: "Yesterday", date: "10/22/2026", isAllDay: true },
      { title: "All day walk", dateStart: "10/23/2026", dateEnd: "10/24/2026", isallday: true },
      { title: "No date" },
    ], "2026-10-23");
    expect(events.map((event) => event.title)).toEqual(["Ranger talk", "All day walk"]);
    expect(events[0]).toMatchObject({ time: "2:00 PM – 2:30 PM", recurring: true, location: "Old Faithful" });
    expect(events[1].time).toBe("All day");
    expect(parseEvents([{ title: "Ranger talk", datestart: "2026-10-23" }], null)).toEqual([]);
  });

  it("parses activities, dedupes fees, and reads road windows", () => {
    const activities = parseActivities([
      { title: "Watch a geyser", shortDescription: "Stay on boardwalks.", duration: "1-2 Hours", location: "Old Faithful", accessibilityInformation: "Wheelchair accessible boardwalks.", url: "https://www.nps.gov/yell/index.htm" },
      { title: " " },
    ]);
    expect(activities).toHaveLength(1);
    expect(activities[0].summary).toBe("Stay on boardwalks.");
    expect(activities[0].accessibility).toMatch(/Wheelchair/);

    const fallback = [{ title: "Park record fee", cost: "10.00", description: null, kind: "fee" as const }];
    expect(parseFeePayload({ total: "0", data: [] }, fallback)).toEqual(fallback);
    expect(parseFeePayload({
      data: [{
        fees: [{ title: "Vehicle", cost: "35.00" }, { title: "Vehicle", cost: "35.00" }],
        passes: [{ title: "Vehicle", cost: "70.00" }],
      }],
    }, fallback).map((fee) => `${fee.kind}:${fee.title}`)).toEqual(["fee:Vehicle", "pass:Vehicle"]);

    const roads = parseRoadEvents([
      { id: "crash", title: "Crash", description: "Lane blocked.", category: "Incident", startDate: "10/23/2026", endDate: "10/23/2026", url: "https://www.nps.gov/yell/road.htm" },
      { roadwayName: "South Entrance", description: "Construction.", eventtype: "Construction" },
      { description: "" },
      null,
    ]);
    expect(roads[0]).toMatchObject({ title: "Crash", eventType: "Incident", startDate: "2026-10-23", endDate: "2026-10-23" });
    expect(roads[1]).toMatchObject({ title: "South Entrance", eventType: "Construction", startDate: null });
    expect(roads).toHaveLength(2);
    expect(roadAffectsToday(roads[0], "2026-10-23")).toBe(true);
    expect(roadAffectsToday(roads[0], "2026-10-24")).toBe(false);
    expect(roadAffectsToday(roads[1], "2026-10-23")).toBe(true);
    expect(roadAffectsToday({ ...roads[0], title: "Incident cleared", description: "The crash cleared." }, "2026-10-23")).toBe(false);
    expect(roadAffectsToday(roads[0], null)).toBe(true);
  });

  it("keeps accessibility amenities and normalizes boundary geometry", () => {
    const facts = parseAmenityFacts({
      data: [
        { name: "Wheelchair Accessible", parks: [{ visitorcenters: [{ name: "Albright" }, { name: " " }] }] },
        { name: "Audio Description" },
        { name: "Restrooms", parks: [{ visitorcenters: [{ name: "Albright" }] }] },
      ],
    });
    expect(facts).toEqual([
      { label: "Wheelchair Accessible", value: "Albright" },
      { label: "Audio Description", value: "Listed for this park" },
    ]);

    expect(asFeatureCollection({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [-110, 44] }, properties: { name: "A" } },
        { type: "Feature", properties: {} },
        null,
      ],
    })?.features).toHaveLength(1);
    expect(asFeatureCollection({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] })?.features[0].geometry.type).toBe("Polygon");
    expect(asFeatureCollection({ geometry: { type: "Point", coordinates: [1, 2] } })?.features).toHaveLength(1);
    expect(asFeatureCollection({ type: "Feature", geometry: { type: "Point", coordinates: [1, 2] }, properties: {} })?.type).toBe("FeatureCollection");
    expect(asFeatureCollection({})).toBeNull();
    expect(asFeatureCollection(null)).toBeNull();
  });
});
