import { describe, expect, it } from "vitest";
import { hoursKind, parkLocalParts, resolveSchedule } from "@/lib/hours";
import { htmlToText } from "@/lib/text";
import { httpsUrl } from "@/lib/url";
import { rankParks } from "@/lib/catalog";
import type { ParkSummary } from "@/lib/types";

describe("hours", () => {
  it("uses the park time zone to name the local day", () => {
    const parts = parkLocalParts("America/Denver", new Date("2026-10-24T05:30:00Z"));
    expect(parts).toEqual({ date: "2026-10-23", weekday: "friday" });
  });

  it("lets a dated exception replace the standard hours", () => {
    const schedule = resolveSchedule({
      name: "Park hours",
      standardHours: { friday: "All Day", saturday: "All Day" },
      exceptions: [{
        name: "Holiday",
        startDate: "2026-10-23",
        endDate: "2026-10-23",
        exceptionHours: { friday: "Closed" },
      }],
    }, { date: "2026-10-23", weekday: "friday" });
    expect(schedule.today).toBe("closed");
    expect(schedule.todayText).toBe("Closed");
    expect(schedule.activeExceptions).toHaveLength(1);
    expect(hoursKind("Sunrise to Sunset")).toBe("open");
  });
});

describe("text and links", () => {
  it("strips NPS html and keeps the sentence", () => {
    expect(htmlToText("<p>The <strong>road</strong> is closed &amp; signed.</p>")).toBe("The road is closed & signed.");
  });

  it("allows official https links only", () => {
    expect(httpsUrl("https://www.nps.gov/yell/index.htm")).toMatch(/^https:\/\/www\.nps\.gov/);
    expect(httpsUrl("http://www.nps.gov/yell")).toBeNull();
    expect(httpsUrl("javascript:alert(1)")).toBeNull();
    expect(httpsUrl("https://example.com/park")).toBeNull();
  });
});

describe("search ranking", () => {
  const parks: ParkSummary[] = [
    { parkCode: "yell", fullName: "Yellowstone National Park", designation: "National Park", states: "WY,MT,ID", latitude: 44, longitude: -110, description: "Geysers", imageUrl: null, imageAlt: null, distanceMiles: null },
    { parkCode: "zion", fullName: "Zion National Park", designation: "National Park", states: "UT", latitude: 37, longitude: -113, description: "Canyons", imageUrl: null, imageAlt: null, distanceMiles: null },
  ];

  it("puts an exact park code first and matches a state name", () => {
    expect(rankParks(parks, "yell").map((park) => park.parkCode)).toEqual(["yell"]);
    expect(rankParks(parks, "utah").map((park) => park.parkCode)).toEqual(["zion"]);
    expect(rankParks(parks, "y")).toEqual([]);
  });
});
