import { ConfigError, UpstreamError } from "@/lib/errors";
import { fetchJson } from "@/lib/http";
import { fixtureNps } from "@/lib/fixtures";
import { pageInfo } from "@/lib/nps-parse";
import { REVALIDATE, usingFixtures } from "@/lib/runtime";

const BASE = "https://developer.nps.gov/api/v1";

export async function npsGet(path: string, revalidate: number): Promise<unknown> {
  if (usingFixtures()) return fixtureNps(path);
  const key = process.env.NPS_API_KEY?.trim();
  if (!key) throw new ConfigError();
  const response = await fetchJson(`${BASE}${path}`, revalidate, {
    Accept: "application/json",
    "X-Api-Key": key,
  });
  if (response.status === 429) throw new UpstreamError("The National Park Service rate limit was reached. Try again in a little while.");
  if (response.status === 401 || response.status === 403) throw new UpstreamError("The National Park Service rejected the API key.");
  if (response.status !== 200) throw new UpstreamError("The National Park Service could not return that data.");
  return response.body;
}

export async function npsCollection(resource: string, revalidate: number, cap = 200): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let start = 0; start < cap; start += 50) {
    const joiner = resource.includes("?") ? "&" : "?";
    const body = await npsGet(`${resource}${joiner}limit=50&start=${start}`, revalidate);
    const page = pageInfo(body);
    rows.push(...page.data);
    if (page.data.length === 0 || start + 50 >= page.total) break;
  }
  return rows;
}

export async function npsBoundary(parkCode: string): Promise<unknown | null> {
  if (usingFixtures()) return fixtureNps(`/mapdata/parkboundaries/${parkCode}`);
  const key = process.env.NPS_API_KEY?.trim();
  if (!key) throw new ConfigError();
  const response = await fetchJson(`${BASE}/mapdata/parkboundaries/${parkCode}`, REVALIDATE.boundary, {
    Accept: "application/json",
    "X-Api-Key": key,
  });
  if (response.status === 404) return null;
  if (response.status !== 200) throw new UpstreamError("The park boundary could not be loaded.");
  return response.body;
}
