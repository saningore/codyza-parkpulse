import { describe, expect, it } from "vitest";
import { parseStructuredPark } from "@/lib/structured-park";

const sunday = { date: "2026-10-25", weekday: "sunday" as const };
const monday = { date: "2026-06-01", weekday: "monday" as const };

function week(open: string, close: string, closed = false) {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    time_open: open,
    time_close: close,
    sunrise_open: 0,
    sunset_close: 0,
    is_closed: closed ? 1 : 0,
  }));
}

const body = {
  description: "<p>A large park.</p>",
  directions: "Follow the road.",
  directionsURL: "https://www.nps.gov/yell/planyourvisit/directions.htm",
  weatherText: "Snow in winter.",
  telephoneNumberVoice: "307-344-7381",
  url: "https://www.nps.gov/yell/",
  entranceFees: [{ title: "Private vehicle", cost: "$35.00", description: "Seven days." }],
  entrancePasses: [{ title: "Annual pass", cost: "$70.00", description: "One year." }],
  images: [{ url: "/common/uploads/structured_data/peak.jpg", altText: "A peak", credit: "NPS" }],
  operatingHours: [
    {
      name: "All Park - All Park Hours",
      hours: week("12:00 AM", "11:59 PM"),
      exceptions: [{ name: "Holiday", date_start: "", date_end: "", schedule: week("", "", true) }],
    },
    { name: "Visitor Center - Albright", hours: week("9:00 AM", "5:00 PM") },
    { name: "Park Entrance - West Entrance", hours: week("12:00 AM", "11:59 PM") },
  ],
  campgrounds: [{
    name: "Canyon Campground",
    campgroundID: 42,
    totalSites: 273,
    regulations: "<p>Food storage is required.</p>",
    detailURL: "https://www.nps.gov/yell/planyourvisit/canyoncg.htm",
    reservationURL: "https://secure.yellowstonenationalparklodges.com/booking",
    location: { latitude: "44.735", longitude: "-110.488" },
    wheelchairInfo: "Gravel paths.",
    operatingHours: {
      1: {
        name: "Campground - Canyon Campground",
        hours: week("12:00 AM", "11:59 PM"),
        exceptions: [{
          name: "Closed",
          month_start_unformatted: 9,
          day_start_unformatted: 20,
          month_end_unformatted: 5,
          day_end_unformatted: 28,
          schedule: week("", "", true),
        }],
      },
    },
  }],
  visitorCenters: [{
    name: "Albright Visitor Center",
    visitorCenterID: "7",
    siteURL: "http://www.nps.gov/yell/planyourvisit/albright-visitor-center.htm",
    telephoneNumberVoice: "307-344-2263",
    amenities: ["Braille"],
    operatingHours: { 1: { name: "Visitor Center - Albright", hours: week("9:00 AM", "5:00 PM") } },
  }],
};

describe("public park page records", () => {
  it("maps Sunday-first hours, fees, campgrounds, and absolute photo URLs", () => {
    const park = parseStructuredPark(body, sunday);
    expect(park?.description).toBe("A large park.");
    expect(park?.phone).toBe("307-344-7381");
    expect(park?.images[0]).toMatchObject({
      url: "https://www.nps.gov/common/uploads/structured_data/peak.jpg",
      alt: "A peak",
    });
    expect(park?.schedules.map((schedule) => schedule.name)).toEqual(["All Park - All Park Hours"]);
    expect(park?.schedules[0]).toMatchObject({ today: "open", todayText: "All day" });
    expect(park?.fees.map((fee) => fee.kind)).toEqual(["fee", "pass"]);
    expect(park?.campgrounds[0]).toMatchObject({
      id: "42",
      name: "Canyon Campground",
      totalSites: "273",
      latitude: 44.735,
      reservationUrl: null,
      url: "https://www.nps.gov/yell/planyourvisit/canyoncg.htm",
    });
    expect(park?.campgrounds[0]?.schedule).toMatchObject({ today: "closed", todayText: "Closed" });
    expect(park?.campgrounds[0]?.accessibility).toEqual([{ label: "Wheelchair access", value: "Gravel paths." }]);
    expect(park?.visitorCenters[0]?.url).toBe("https://www.nps.gov/yell/planyourvisit/albright-visitor-center.htm");
    expect(park?.visitorCenters[0]?.schedule?.todayText).toBe("9:00 AM - 5:00 PM");
  });

  it("keeps standard hours when a seasonal closure does not cover today", () => {
    const park = parseStructuredPark(body, monday);
    expect(park?.campgrounds[0]?.schedule).toMatchObject({ today: "open", todayText: "All day" });
  });

  it("uses a day number of 1 as Sunday and ignores an undated holiday", () => {
    const park = parseStructuredPark({
      operatingHours: [{
        name: "All Park - Grounds",
        hours: [
          { dayOfWeek: 1, time_open: "Closed", time_close: "", is_closed: 1 },
          { dayOfWeek: 2, time_open: "9:00 AM", time_close: "5:00 PM", is_closed: 0 },
        ],
      }],
    }, sunday);
    expect(park?.schedules[0]?.week[0]).toEqual({ day: "Sunday", hours: "Closed" });
    expect(park?.schedules[0]?.week[1]).toEqual({ day: "Monday", hours: "9:00 AM - 5:00 PM" });
    expect(park?.schedules[0]?.today).toBe("closed");
  });
});
