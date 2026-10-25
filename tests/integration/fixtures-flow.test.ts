import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogByCodes, loadCatalog, nearbyCatalog, searchCatalog } from "@/lib/catalog-data";
import { loadParkConditions } from "@/lib/compose";
import { nwsAlerts, nwsForecast, nwsPoints } from "@/lib/nws";

beforeEach(() => {
  vi.stubEnv("PARKPULSE_USE_FIXTURES", "1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fixture catalog", () => {
  it("loads the five sample parks and ranks state, code, and name searches", async () => {
    const catalog = await loadCatalog();
    expect(catalog.map((park) => park.parkCode)).toEqual(["yell", "grca", "acad", "yose", "zion"]);

    expect((await searchCatalog("maine")).map((park) => park.parkCode)).toEqual(["acad"]);
    expect((await searchCatalog("  UT ")).map((park) => park.parkCode)).toEqual(["zion"]);
    expect((await searchCatalog("national park")).map((park) => park.fullName)).toEqual([
      "Acadia National Park",
      "Grand Canyon National Park",
      "Yellowstone National Park",
      "Yosemite National Park",
      "Zion National Park",
    ]);
    expect(await searchCatalog("z")).toEqual([]);

    const byCode = await catalogByCodes(["ZION", "acad", "nope"]);
    expect(byCode.map((park) => park.parkCode)).toEqual(["acad", "zion"]);

    const nearAcadia = await nearbyCatalog(44.3386, -68.2733);
    expect(nearAcadia[0].parkCode).toBe("acad");
    expect(nearAcadia[0].distanceMiles).toBeLessThan(1);
    expect(nearAcadia.map((park) => park.distanceMiles)).toEqual(
      [...nearAcadia.map((park) => park.distanceMiles)].sort((left, right) => (left ?? 0) - (right ?? 0)),
    );
  });
});

describe("fixture conditions", () => {
  it("builds the Yellowstone sample with stripped alert text and a partial closure", async () => {
    const conditions = await loadParkConditions("YELL", new Date());
    expect(conditions?.park.fullName).toBe("Yellowstone National Park");
    expect(conditions?.verdict.status).toBe("restricted");
    expect(conditions?.alerts?.map((alert) => alert.title)).toEqual([
      "Beartooth Highway closed for the season",
      "Bear activity along the Yellowstone River",
      "Entrance passes are sold at entrance stations",
      "Pilot and Index Peak pullouts are limited",
    ]);
    expect(conditions?.alerts?.[0].description).toBe("The Beartooth Highway is closed. Other entrances remain open in this sample.");
    expect(conditions?.notices.map((notice) => notice.place ?? notice.title)).toEqual([
      "Madison Campground",
      "Bridge Bay Campground",
    ]);
    expect(conditions?.events?.[0].time).toBe("2:00 PM – 2:30 PM");
    expect(conditions?.fees?.[0].cost).toBe("35.00");
    expect(conditions?.weather?.placeLabel).toBe("Yellowstone, WY");
    expect(conditions?.weather?.periods).toHaveLength(3);
    expect(conditions?.weather?.periods[0]).toMatchObject({ temperature: "46°F", wind: "10 mph SW", precipitation: "10% precipitation" });
    expect(conditions?.weatherAlerts?.[0].event).toBe("Winter Storm Watch");
    expect(conditions?.boundary?.features).toHaveLength(1);
    expect(conditions?.points.map((point) => point.kind).sort()).toEqual(["campground", "campground", "park", "visitor-center", "visitor-center"]);
    expect(conditions?.timeZone).toBe("America/Denver");
    expect(conditions?.usingFixtures).toBe(true);
    expect(conditions?.warnings).toEqual([]);
  });

  it("calls Grand Canyon and Yosemite open, and Acadia cautious because the sample weather watch is latitude-based", async () => {
    const canyon = await loadParkConditions("grca");
    const yosemite = await loadParkConditions("yose");
    const acadia = await loadParkConditions("acad");
    expect(canyon?.verdict).toMatchObject({ status: "open", label: "Open today" });
    expect(yosemite?.verdict.status).toBe("open");
    expect(canyon?.alerts).toEqual([]);
    expect(canyon?.weatherAlerts).toEqual([]);
    expect(canyon?.weather?.placeLabel).toBe("Yellowstone, WY");
    expect(canyon?.boundary).toBeNull();
    expect(acadia?.verdict.status).toBe("caution");
    expect(acadia?.weatherAlerts?.[0].event).toBe("Winter Storm Watch");
    expect(await loadParkConditions("nope")).toBeNull();
    expect(await loadParkConditions("abc")).toBeNull();
  });
});

describe("fixture weather service", () => {
  it("uses the shared Yellowstone forecast point and limits the watch to a latitude band", async () => {
    const points = await nwsPoints(36.1069, -112.1129);
    expect(points).toMatchObject({
      timeZone: "America/Denver",
      placeLabel: "Yellowstone, WY",
      forecastUrl: "https://api.weather.gov/gridpoints/RIW/77,55/forecast",
    });
    const forecast = await nwsForecast(points.forecastUrl!, points.placeLabel);
    expect(forecast.periods[0].temperature).toBe("46°F");
    expect((await nwsAlerts(44.428, -110.5885))[0].event).toBe("Winter Storm Watch");
    expect(await nwsAlerts(36.1069, -112.1129)).toEqual([]);
    expect((await nwsAlerts(44.3386, -68.2733))[0].event).toBe("Winter Storm Watch");
    await expect(nwsForecast("https://example.com/forecast", null)).rejects.toThrow(/not a National Weather Service/);
  });
});
