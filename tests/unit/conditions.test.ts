import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadParkConditions } from "@/lib/compose";

beforeAll(() => {
  process.env.PARKPULSE_USE_FIXTURES = "1";
});

afterAll(() => {
  delete process.env.PARKPULSE_USE_FIXTURES;
});

describe("Yellowstone conditions", () => {
  it("answers restricted, with four alerts and two campground notices", async () => {
    const conditions = await loadParkConditions("yell");
    expect(conditions).not.toBeNull();
    expect(conditions?.verdict.status).toBe("restricted");
    expect(conditions?.verdict.label).toBe("Restricted");
    expect(conditions?.alerts).toHaveLength(4);
    expect(conditions?.notices).toHaveLength(2);
    expect(conditions?.alerts?.[0].description).not.toMatch(/<[^>]+>/);
    expect(conditions?.visitorCenters).toHaveLength(2);
    expect(conditions?.events).toHaveLength(1);
    expect(conditions?.events?.[0].title).toBe("Ranger talk at Old Faithful");
    expect(conditions?.weather?.periods[0].temperature).toBe("46°F");
    expect(conditions?.weatherAlerts?.[0].event).toBe("Winter Storm Watch");
    expect(conditions?.fees?.[0].title).toMatch(/Private Vehicle/);
    expect(conditions?.boundary?.features).toHaveLength(1);
    expect(conditions?.usingFixtures).toBe(true);
  });

  it("calls a quiet sample park open and rejects an unknown code", async () => {
    const canyon = await loadParkConditions("grca");
    expect(canyon?.verdict.status).toBe("open");
    expect(canyon?.verdict.label).toBe("Open today");
    expect(await loadParkConditions("zzzz")).toBeNull();
    expect(await loadParkConditions("nope")).toBeNull();
  });
});
