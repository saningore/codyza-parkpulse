import { UpstreamError } from "@/lib/errors";
import { fetchJson } from "@/lib/http";
import { htmlToText, textOrNull } from "@/lib/text";
import type { Alert } from "@/lib/types";
import { httpsUrl } from "@/lib/url";
import { REVALIDATE } from "@/lib/runtime";

const ALERTS_URL = "https://www.nps.gov/nps-alerts.json";
const TEN_MINUTES = 10 * 60 * 1000;

type Cache = { expires: number; body: unknown[] };
let cache: Cache | null = null;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function parsedStamp(value: unknown): number | null {
  const text = textOrNull(value);
  if (!text) return null;
  const stamp = Date.parse(text.replace(/^([A-Za-z]+),\s+/, "$1 "));
  return Number.isFinite(stamp) ? stamp : null;
}

function isCurrent(row: Record<string, unknown>, now: Date): boolean {
  const time = now.getTime();
  const start = parsedStamp(row.start_date);
  const end = parsedStamp(row.end_date);
  if (start !== null && start > time) return false;
  if (end !== null && end < time) return false;
  return true;
}

export function parsePublicAlerts(body: unknown, parkCode: string, now = new Date()): Alert[] {
  if (!Array.isArray(body)) return [];
  const code = parkCode.toLowerCase();
  return body.flatMap((item, index) => {
    const row = record(item);
    if (!row || textOrNull(row.site_code)?.toLowerCase() !== code || !isCurrent(row, now)) return [];
    const title = htmlToText(row.title);
    const description = htmlToText(row.description);
    if (!title || !description) return [];
    return [{
      id: textOrNull(row.unique_id) ?? `public-alert-${index}`,
      title,
      description,
      category: textOrNull(row.category) ?? "Information",
      url: httpsUrl(row.internal_link),
      lastIndexed: textOrNull(row.last_modified),
    }];
  });
}

async function loadFeed(): Promise<unknown[]> {
  if (!process.env.VITEST && cache && cache.expires > Date.now()) return cache.body;
  const response = await fetchJson(ALERTS_URL, REVALIDATE.alerts, undefined, 20_000);
  if (response.status !== 200 || !Array.isArray(response.body)) {
    throw new UpstreamError("The National Park Service alerts list could not be loaded.");
  }
  const body = response.body as unknown[];
  if (!process.env.VITEST) cache = { expires: Date.now() + TEN_MINUTES, body };
  return body;
}

export async function publicParkAlerts(parkCode: string, now = new Date()): Promise<Alert[]> {
  return parsePublicAlerts(await loadFeed(), parkCode, now);
}
