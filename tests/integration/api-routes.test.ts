import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { GET as parks } from "@/app/api/parks/route";
import { NextRequest } from "next/server";

function callParks(path: string, ip = "198.51.100.20") {
  return parks(new NextRequest(`http://127.0.0.1${path}`, {
    headers: { "x-forwarded-for": ip },
  }));
}

beforeEach(() => {
  vi.stubEnv("PARKPULSE_USE_FIXTURES", "1");
  vi.stubEnv("NPS_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("health route", () => {
  it("reports fixtures, live, or unconfigured", async () => {
    expect(await (await health()).json()).toEqual({ ok: true, mode: "fixtures" });

    vi.stubEnv("PARKPULSE_USE_FIXTURES", "");
    vi.stubEnv("NPS_API_KEY", "test-key");
    expect(await (await health()).json()).toEqual({ ok: true, mode: "live" });

    vi.stubEnv("NPS_API_KEY", "  ");
    expect(await (await health()).json()).toEqual({ ok: true, mode: "unconfigured" });
  });
});

describe("parks route", () => {
  it("searches, finds parks near a point, and looks up saved codes", async () => {
    const search = await callParks("/api/parks?q=%20yell%20");
    expect(search.status).toBe(200);
    expect(search.headers.get("cache-control")).toContain("s-maxage=60");
    const searchBody = await search.json();
    expect(searchBody.parks.map((park: { parkCode: string }) => park.parkCode)).toEqual(["yell"]);

    const state = await callParks("/api/parks?q=Maine");
    expect((await state.json()).parks.map((park: { parkCode: string }) => park.parkCode)).toEqual(["acad"]);

    const near = await callParks("/api/parks?lat=21.3&lon=-157.8");
    expect(near.status).toBe(200);
    expect(near.headers.get("cache-control")).toContain("s-maxage=60");
    const nearBody = await near.json();
    const distances = nearBody.parks.map((park: { distanceMiles: number }) => park.distanceMiles);
    expect(distances).toEqual([...distances].sort((left: number, right: number) => left - right));
    expect(nearBody.parks).toHaveLength(5);

    const codes = await callParks("/api/parks?codes=YELL,%20grca,%20nope,%20zz");
    expect(codes.status).toBe(200);
    expect((await codes.json()).parks.map((park: { parkCode: string }) => park.parkCode)).toEqual(["yell", "grca"]);

    const emptyCodes = await callParks("/api/parks?codes=,,,");
    expect(await emptyCodes.json()).toEqual({ parks: [] });
  });

  it("rejects short queries and locations outside the searchable area", async () => {
    const short = await callParks("/api/parks?q=a");
    expect(short.status).toBe(400);
    expect(await short.json()).toEqual({ error: "Enter at least two letters of a park name, state, or park code." });

    const blank = await callParks("/api/parks?q=%20%20");
    expect(blank.status).toBe(400);

    const london = await callParks("/api/parks?lat=51.5&lon=-0.12");
    expect(london.status).toBe(400);
    expect((await london.json()).error).toMatch(/outside the searchable area/);

    const half = await callParks("/api/parks?lat=44.428");
    expect(half.status).toBe(400);

    const words = await callParks("/api/parks?lat=north&lon=west");
    expect(words.status).toBe(400);
  });

  it("asks for an API key when fixtures are off", async () => {
    vi.stubEnv("PARKPULSE_USE_FIXTURES", "");
    vi.stubEnv("NPS_API_KEY", "");
    const response = await callParks("/api/parks?q=yell", "198.51.100.30");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ParkPulse needs an NPS API key before it can search parks." });
  });

  it("returns 429 after thirty searches from the same address", async () => {
    const ip = "198.51.100.99";
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 31; attempt += 1) {
      statuses.push((await callParks("/api/parks?q=yell", ip)).status);
    }
    expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
    const blocked = await callParks("/api/parks?q=yell", ip);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "Too many searches. Wait a minute and try again." });
  });
});
