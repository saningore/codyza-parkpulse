import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadParkConditions } from "@/lib/compose";
import { ConfigError, UpstreamError } from "@/lib/errors";
import { npsBoundary, npsCollection, npsGet } from "@/lib/nps";
import { replaceNpsBudgetForTests } from "@/lib/nps-budget";
import { nwsForecast, nwsPoints } from "@/lib/nws";

const parkRow = {
  parkCode: "test",
  fullName: "Test National Park",
  designation: "National Park",
  states: "CO",
  latitude: "39",
  longitude: "-105",
  description: "Integration park",
  url: "https://www.nps.gov/test/index.htm",
  operatingHours: [{
    name: "Park hours",
    standardHours: {
      sunday: "All Day", monday: "All Day", tuesday: "All Day", wednesday: "All Day",
      thursday: "All Day", friday: "All Day", saturday: "All Day",
    },
    exceptions: [],
  }],
  entranceFees: [{ title: "Vehicle", cost: "20.00", description: "Vehicle fee" }],
};

function json(status: number, body: unknown) {
  return { status, json: async () => body };
}

beforeEach(() => {
  vi.stubEnv("PARKPULSE_USE_FIXTURES", "");
  vi.stubEnv("NPS_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("National Park Service client", () => {
  it("requires a key and stops before calling the network for a bad park code", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NPS_API_KEY", "   ");
    await expect(npsGet("/parks", 10)).rejects.toBeInstanceOf(ConfigError);
    await expect(loadParkConditions("ab")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the key and turns auth, rate limit, and server failures into source errors", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-Api-Key"]).toBe("test-key");
      expect(headers.Accept).toBe("application/json");
      return json(401, { message: "denied" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(npsGet("/parks?parkCode=test", 10)).rejects.toThrow(/rejected the API key/);

    fetchMock.mockResolvedValue(json(429, {}));
    await expect(npsGet("/parks?parkCode=rate", 10)).rejects.toThrow(/rate limit/);

    fetchMock.mockResolvedValue(json(500, {}));
    await expect(npsGet("/parks?parkCode=down", 10)).rejects.toBeInstanceOf(UpstreamError);

    fetchMock.mockResolvedValue(json(404, {}));
    await expect(npsBoundary("missing")).resolves.toBeNull();
    fetchMock.mockResolvedValue(json(503, {}));
    await expect(npsBoundary("down")).rejects.toThrow(/boundary could not be loaded/);
  });

  it("stops before the network once this server has used its hourly NPS budget", async () => {
    replaceNpsBudgetForTests(1_000);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(npsGet("/parks?parkCode=budget", 10)).rejects.toThrow(/rate limit/);
    expect(fetchMock).not.toHaveBeenCalled();
    replaceNpsBudgetForTests(0);
  });

  it("pages through a collection until the reported total is covered", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      const start = Number(new URL(url).searchParams.get("start"));
      const data = start === 0 ? Array.from({ length: 50 }, (_, index) => ({ index })) : [{ index: 50 }];
      return json(200, { total: "51", data });
    });
    const rows = await npsCollection("/parks", 10, 200);
    expect(rows).toHaveLength(51);

    vi.stubGlobal("fetch", async (url: string) => {
      const start = Number(new URL(url).searchParams.get("start"));
      return json(200, { total: "100", data: start === 0 ? [{ index: 0 }] : [] });
    });
    await expect(npsCollection("/campgrounds?parkCode=test", 10)).resolves.toEqual([{ index: 0 }]);
  });
});

describe("conditions when a live source fails", () => {
  it("stays unconfirmed when alerts fail and still shows the forecast", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/alerts?parkCode=")) return json(500, {});
      if (url.includes("/parks?")) return json(200, { total: "1", data: [parkRow] });
      if (url.includes("/mapdata/parkboundaries/")) return json(404, {});
      if (url.includes("api.weather.gov/points/")) {
        return json(200, {
          properties: {
            timeZone: "America/Denver",
            forecast: "https://api.weather.gov/gridpoints/BOU/1,1/forecast",
            relativeLocation: { properties: { city: "Estes Park", state: "CO" } },
          },
        });
      }
      if (url.includes("/gridpoints/BOU/")) {
        return json(200, {
          properties: {
            updated: "2026-10-23T18:00:00Z",
            periods: [{ name: "This Afternoon", temperature: 55, temperatureUnit: "F", windSpeed: "8 mph", shortForecast: "Sunny", isDaytime: true }],
          },
        });
      }
      if (url.includes("/alerts/active")) return json(200, { features: [] });
      if (url.includes("developer.nps.gov")) return json(200, { total: "0", data: [] });
      throw new Error(`Unexpected URL ${url}`);
    });

    const conditions = await loadParkConditions("test", new Date("2026-10-23T18:00:00Z"));
    expect(conditions?.verdict.status).toBe("unconfirmed");
    expect(conditions?.verdict.reason).toMatch(/will not call this park open/);
    expect(conditions?.alerts).toBeNull();
    expect(conditions?.weather?.periods[0]).toMatchObject({ temperature: "55°F", wind: "8 mph", shortForecast: "Sunny" });
    expect(conditions?.weather?.placeLabel).toBe("Estes Park, CO");
    expect(conditions?.fees?.[0].cost).toBe("20.00");
    expect(conditions?.boundary).toBeNull();
    expect(conditions?.warnings.some((warning) => warning.source === "Alerts")).toBe(true);
    expect(conditions?.warnings.some((warning) => warning.source === "Map")).toBe(false);
  });

  it("stays unconfirmed when the weather grid is missing because today's hours need the park time zone", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/parks?")) return json(200, { total: "1", data: [parkRow] });
      if (url.includes("api.weather.gov/points/")) return json(404, {});
      if (url.includes("developer.nps.gov")) return json(200, { total: "0", data: [] });
      throw new Error(`Unexpected URL ${url}`);
    });
    const conditions = await loadParkConditions("test", new Date("2026-10-23T18:00:00Z"));
    expect(conditions?.verdict.status).toBe("unconfirmed");
    expect(conditions?.verdict.reason).toMatch(/hours could not be confirmed/);
    expect(conditions?.warnings.map((warning) => warning.source)).toEqual(expect.arrayContaining(["Weather", "Weather alerts"]));
    await expect(nwsPoints(39, -105)).rejects.toThrow(/grid covers/);
  });

  it("rejects a forecast link that is not the weather service", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(nwsForecast("https://evil.example/forecast", "Somewhere")).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubGlobal("fetch", async () => json(503, {}));
    await expect(nwsForecast("https://api.weather.gov/gridpoints/BOU/1,1/forecast", null)).rejects.toThrow(/could not return that forecast/);
  });
});
