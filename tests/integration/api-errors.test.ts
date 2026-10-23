import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/catalog-data", () => ({
  searchCatalog: vi.fn(),
  nearbyCatalog: vi.fn(),
  catalogByCodes: vi.fn(),
}));

import { GET } from "@/app/api/parks/route";
import { searchCatalog } from "@/lib/catalog-data";
import { ConfigError, UpstreamError } from "@/lib/errors";
import { NextRequest } from "next/server";

const search = vi.mocked(searchCatalog);

function request(ip: string) {
  return GET(new NextRequest("http://127.0.0.1/api/parks?q=yell", {
    headers: { "x-forwarded-for": ip },
  }));
}

beforeEach(() => {
  search.mockReset();
});

describe("parks route failures", () => {
  it("returns 503 when park records need an API key", async () => {
    search.mockRejectedValue(new ConfigError());
    const response = await request("203.0.113.10");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ParkPulse needs an NPS API key before it can search parks." });
  });

  it("passes on an upstream failure message", async () => {
    search.mockRejectedValue(new UpstreamError("The National Park Service rejected the API key."));
    const response = await request("203.0.113.11");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The National Park Service rejected the API key." });
  });

  it("hides unexpected error details", async () => {
    search.mockRejectedValue(new Error("secret stack and connection string"));
    const response = await request("203.0.113.12");
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ error: "Park records are temporarily unavailable." });
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
