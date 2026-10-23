import { describe, expect, it } from "vitest";
import { formatParkDate, hoursKind, isIsoDate, parkLocalParts, preferredSchedule, resolveSchedule } from "@/lib/hours";

describe("park local calendar", () => {
  it("keeps the previous local date before midnight in the park time zone", () => {
    expect(parkLocalParts("America/Denver", new Date("2026-10-26T05:59:00Z"))).toEqual({
      date: "2026-10-25",
      weekday: "sunday",
    });
    expect(parkLocalParts("America/Denver", new Date("2026-10-26T06:00:00Z"))).toEqual({
      date: "2026-10-26",
      weekday: "monday",
    });
  });

  it("rejects a time zone the runtime does not know", () => {
    expect(() => parkLocalParts("Not/AZone")).toThrow(RangeError);
  });

  it("formats the park's local calendar date", () => {
    expect(formatParkDate("America/Denver", new Date("2026-10-23T18:00:00Z"))).toMatch(/Friday, October 23, 2026/);
  });

  it("accepts only a strict year-month-day string", () => {
    expect(isIsoDate("2026-10-23")).toBe(true);
    expect(isIsoDate("2026-13-40")).toBe(true);
    expect(isIsoDate("2026-10-23T00:00:00Z")).toBe(false);
    expect(isIsoDate("10/23/2026")).toBe(false);
  });
});

describe("hours kind", () => {
  it.each([
    [null, "unknown"],
    ["", "unknown"],
    ["   ", "unknown"],
    ["Open", "unknown"],
    ["Closed for the season", "unknown"],
    ["Closed", "closed"],
    ["  CLOSED  ", "closed"],
    ["All Day", "open"],
    ["Sunrise to Sunset", "open"],
    ["9:00AM - 5:00PM", "open"],
  ] as const)("classifies %j as %s", (value, kind) => {
    expect(hoursKind(value)).toBe(kind);
  });
});

describe("schedule resolution", () => {
  const friday = { date: "2026-10-23", weekday: "friday" as const };

  it("keeps standard hours when no exception covers today", () => {
    const schedule = resolveSchedule({
      name: "  Park hours  ",
      description: "  Posted weekly  ",
      standardHours: { friday: "9:00AM - 5:00PM", saturday: "All Day", sunday: "  " },
      exceptions: [
        null,
        { startDate: "yesterday", endDate: "2026-10-23", exceptionHours: { friday: "Closed" } },
        { startDate: "2026-10-25", endDate: "2026-10-23", exceptionHours: { friday: "Closed" } },
        { startDate: "2026-10-24", endDate: "2026-10-24", name: "Tomorrow", exceptionHours: { friday: "Closed" } },
      ],
    }, friday);
    expect(schedule.name).toBe("Park hours");
    expect(schedule.description).toBe("Posted weekly");
    expect(schedule.today).toBe("open");
    expect(schedule.todayText).toBe("9:00AM - 5:00PM");
    expect(schedule.activeExceptions).toEqual([]);
    expect(schedule.week.find((day) => day.day === "Sunday")?.hours).toBe("Not listed");
    expect(schedule.week.find((day) => day.day === "Saturday")?.hours).toBe("All Day");
  });

  it("lets a later exception override an earlier one for today", () => {
    const schedule = resolveSchedule({
      standardHours: { friday: "All Day", saturday: "All Day" },
      exceptions: [
        { name: "First", startDate: "2026-10-23", endDate: "2026-10-23", exceptionHours: { friday: "Closed" } },
        { name: "  ", startDate: "2026-10-23", endDate: "2026-10-23", exceptionHours: { friday: "10:00AM - 2:00PM" } },
      ],
    }, friday);
    expect(schedule.today).toBe("open");
    expect(schedule.todayText).toBe("10:00AM - 2:00PM");
    expect(schedule.week.find((day) => day.day === "Saturday")?.hours).toBe("All Day");
    expect(schedule.activeExceptions.map((item) => item.name)).toEqual(["First", "Schedule exception"]);
    expect(schedule.activeExceptions[1].hours).toBe("10:00AM - 2:00PM");
  });

  it("does not apply exceptions when the local day is unknown", () => {
    const schedule = resolveSchedule({
      standardHours: { friday: "All Day" },
      exceptions: [{ name: "Holiday", startDate: "2026-10-23", endDate: "2026-10-23", exceptionHours: { friday: "Closed" } }],
    }, null);
    expect(schedule.today).toBe("unknown");
    expect(schedule.todayText).toBeNull();
    expect(schedule.activeExceptions).toEqual([]);
    expect(schedule.name).toBe("Hours");
    expect(schedule.description).toBeNull();
  });

  it("prefers a schedule whose name says park", () => {
    const visitor = { name: "Visitor center" };
    const park = { name: "Park hours" };
    expect(preferredSchedule([visitor, park])).toBe(park);
    expect(preferredSchedule([visitor])).toBe(visitor);
    expect(preferredSchedule([])).toBeNull();
  });
});
