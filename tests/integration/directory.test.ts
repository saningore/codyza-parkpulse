import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogByCodes, nearbyCatalog, searchCatalog } from "@/lib/catalog-data";
import { loadParkConditions } from "@/lib/compose";

function json(status: number, body: unknown) {
  return { status, json: async () => body };
}

beforeEach(() => {
  vi.stubEnv("PARKPULSE_USE_FIXTURES", "");
  vi.stubEnv("NPS_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("stored park directory", () => {
  it("finds natural park names without calling the National Park Service", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const independence = await searchCatalog("Independence park");
    expect(independence.map((park) => park.parkCode)).toEqual(["inde"]);
    expect(independence[0].fullName).toBe("Independence National Historical Park");
    expect(independence[0].states).toBe("PA");

    expect((await searchCatalog("yellowstone park")).map((park) => park.parkCode)).toEqual(["yell"]);
    expect((await searchCatalog("grand canyon park")).map((park) => park.parkCode)).toEqual(["grca"]);
    expect((await searchCatalog("wyoming")).some((park) => park.parkCode === "yell")).toBe(true);
    expect((await searchCatalog("Maine")).some((park) => park.parkCode === "acad")).toBe(true);

    const codes = await catalogByCodes(["YELL", "inde"]);
    expect(codes.map((park) => park.parkCode)).toEqual(["inde", "yell"]);

    const near = await nearbyCatalog(39.95169, -75.14942);
    expect(near[0].parkCode).toBe("inde");
    expect(near[0].distanceMiles).toBeLessThan(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the stored park and a forecast without requesting NPS conditions", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      expect(String(url)).not.toContain("developer.nps.gov");
      if (String(url).includes("/points/")) {
        return json(200, {
          properties: {
            timeZone: "America/New_York",
            forecast: "https://api.weather.gov/gridpoints/PHI/1,1/forecast",
            relativeLocation: { properties: { city: "Philadelphia", state: "PA" } },
          },
        });
      }
      if (String(url).includes("/gridpoints/")) {
        return json(200, {
          properties: {
            updated: "2026-10-25T12:00:00Z",
            periods: [{ name: "Today", temperature: 62, temperatureUnit: "F", windSpeed: "5 mph", windDirection: "W", shortForecast: "Sunny", isDaytime: true }],
          },
        });
      }
      if (String(url).includes("/alerts/")) return json(200, { features: [] });
      if (String(url).includes("nps.gov/nps-alerts.json")) {
        return json(200, [
          {
            unique_id: "inde-restroom",
            site_code: "inde",
            title: "Limited Restroom Availability",
            description: "Some restrooms are closed.",
            category: "Information",
            internal_link: "https://www.nps.gov/inde/planyourvisit/conditions.htm",
            end_date: "",
            start_date: "",
            last_modified: "Oct 20, 2026",
          },
          {
            unique_id: "yell-elk",
            site_code: "yell",
            title: "Stay Away From Bull Elk",
            description: "Give elk room.",
            category: "Caution",
            end_date: "October, 31 2026 23:59:00",
          },
        ]);
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const conditions = await loadParkConditions("inde", new Date("2026-10-25T15:00:00Z"));
    expect(conditions?.park.fullName).toBe("Independence National Historical Park");
    expect(conditions?.park.url).toBe("https://www.nps.gov/inde/index.htm");
    expect(conditions?.verdict.status).toBe("unconfirmed");
    expect(conditions?.verdict.reason).toMatch(/hours could not be confirmed/);
    expect(conditions?.alerts).toEqual([
      expect.objectContaining({
        id: "inde-restroom",
        title: "Limited Restroom Availability",
        category: "Information",
        url: "https://www.nps.gov/inde/planyourvisit/conditions.htm",
      }),
    ]);
    expect(conditions?.usingFixtures).toBe(false);
    expect(conditions?.weather?.periods[0].temperature).toBe("62°F");
    expect(conditions?.weather?.placeLabel).toBe("Philadelphia, PA");
    expect(conditions?.warnings.some((warning) => warning.message.includes("not connected"))).toBe(true);
    expect(conditions?.warnings.some((warning) => warning.message.includes("public National Park Service alerts list"))).toBe(true);
    expect(conditions?.warnings.some((warning) => /NPS_API_KEY/.test(warning.message))).toBe(false);
  });

  it("keeps the park page up when the public alerts list does not respond", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      expect(String(url)).not.toContain("developer.nps.gov");
      if (String(url).includes("nps.gov/nps-alerts.json")) return json(503, null);
      if (String(url).includes("/points/")) {
        return json(200, {
          properties: {
            timeZone: "America/Denver",
            forecast: "https://api.weather.gov/gridpoints/RIW/1,1/forecast",
            relativeLocation: { properties: { city: "Mammoth", state: "WY" } },
          },
        });
      }
      if (String(url).includes("/gridpoints/")) {
        return json(200, {
          properties: {
            updated: "2026-10-25T16:00:00Z",
            periods: [{ name: "Today", temperature: 48, temperatureUnit: "F", windSpeed: "5 mph", shortForecast: "Sunny", isDaytime: true }],
          },
        });
      }
      if (String(url).includes("/alerts/")) return json(200, { features: [] });
      throw new Error(`Unexpected URL ${url}`);
    });

    const conditions = await loadParkConditions("yell", new Date("2026-10-25T16:00:00Z"));
    expect(conditions?.park.fullName).toBe("Yellowstone National Park");
    expect(conditions?.alerts).toBeNull();
    expect(conditions?.verdict.status).toBe("unconfirmed");
    expect(conditions?.warnings.some((warning) => warning.message.includes("not connected"))).toBe(true);
    expect(conditions?.weather?.periods[0].temperature).toBe("48°F");
  });
});
