import { describe, expect, it } from "vitest";
import { formatCost, formatMiles, formatPhone, checkedAt, directionsHref, show, stateNames, stateQuery, telHref } from "@/lib/format";
import { finiteCoordinate, inSearchableArea, milesBetween, roundCoordinate } from "@/lib/geo";
import { UNAVAILABLE } from "@/lib/types";

describe("distance and searchable area", () => {
  it("measures a degree of latitude and a zero distance", () => {
    expect(milesBetween(44.428, -110.5885, 44.428, -110.5885)).toBe(0);
    expect(milesBetween(0, 0, 1, 0)).toBeCloseTo(69.09, 1);
  });

  it("covers states, Hawaii, Guam, and American Samoa, and rejects the rest", () => {
    expect(inSearchableArea(44.428, -110.5885)).toBe(true);
    expect(inSearchableArea(17, -180)).toBe(true);
    expect(inSearchableArea(72, -64)).toBe(true);
    expect(inSearchableArea(21.3, -157.8)).toBe(true);
    expect(inSearchableArea(13.5, 144.8)).toBe(true);
    expect(inSearchableArea(-14.3, -170.7)).toBe(true);
    expect(inSearchableArea(16.9, -110)).toBe(false);
    expect(inSearchableArea(72, -63.9)).toBe(false);
    expect(inSearchableArea(51.5, -0.12)).toBe(false);
    expect(inSearchableArea(Number.NaN, -110)).toBe(false);
    expect(inSearchableArea(44, 181)).toBe(false);
  });

  it("rounds coordinates for weather lookups and drops values outside their axis", () => {
    expect(roundCoordinate(1.23456)).toBe("1.2346");
    expect(roundCoordinate(44.428)).toBe("44.4280");
    expect(finiteCoordinate(" -110.5 ", 180)).toBe(-110.5);
    expect(finiteCoordinate(91, 90)).toBeNull();
    expect(finiteCoordinate("nope", 90)).toBeNull();
    expect(finiteCoordinate(Number.POSITIVE_INFINITY, 180)).toBeNull();
    expect(finiteCoordinate({}, 90)).toBeNull();
  });
});

describe("display formatting", () => {
  it("expands state names and recognizes state searches", () => {
    expect(stateNames("WY,MT,ID")).toBe("Wyoming, Montana, Idaho");
    expect(stateNames("xx")).toBe("XX");
    expect(stateNames(null)).toBeNull();
    expect(stateNames("")).toBeNull();
    expect(stateQuery("utah")).toBe("UT");
    expect(stateQuery("n.y.")).toBe("NY");
    expect(stateQuery("district of columbia")).toBe("DC");
    expect(stateQuery("wy")).toBe("WY");
    expect(stateQuery("nope")).toBeNull();
  });

  it("formats money, phones, miles, and fallback copy", () => {
    expect(formatCost("35.00")).toBe("$35.00");
    expect(formatCost("$1,200.5")).toBe("$1,200.50");
    expect(formatCost("0")).toBe("Free");
    expect(formatCost("n/a")).toBe("n/a");
    expect(formatCost(null)).toBeNull();
    expect(formatPhone("307-344-7381")).toBe("(307) 344-7381");
    expect(formatPhone("+1 (307) 344-7381")).toBe("(307) 344-7381");
    expect(formatPhone("555-0100")).toBe("555-0100");
    expect(formatPhone(null)).toBeNull();
    expect(telHref("3073447381")).toBe("tel:+13073447381");
    expect(telHref("123")).toBeNull();
    expect(directionsHref(44.1, -110.2)).toBe("https://www.google.com/maps/dir/?api=1&destination=44.1,-110.2");
    expect(directionsHref(null, -110)).toBeNull();
    expect(formatMiles(0)).toBe("0.0 mi");
    expect(formatMiles(9.94)).toBe("9.9 mi");
    expect(formatMiles(12.4)).toBe("12 mi");
    expect(formatMiles(Number.POSITIVE_INFINITY)).toBeNull();
    expect(show("  Open  ")).toBe("Open");
    expect(show("  ")).toBe(UNAVAILABLE);
  });

  it("prints the check time in the park time zone", () => {
    expect(checkedAt("2026-01-15T15:45:00.000Z", "UTC")).toMatch(/January 15, 2026/);
    expect(checkedAt("2026-01-15T15:45:00.000Z", "UTC")).toMatch(/3:45/);
    expect(checkedAt("2026-01-15T15:45:00.000Z", "America/Denver")).toMatch(/8:45/);
    expect(checkedAt("not-a-date", "UTC")).toBe("not-a-date");
  });
});
