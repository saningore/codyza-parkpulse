import { database } from "@/lib/db";
import { UpstreamError } from "@/lib/errors";

export const NPS_HOURLY_LIMIT = 1_000;
const NPS_WARN_AT = 800;

let warned = false;

function hourBucket(): string {
  return new Date().toISOString().slice(0, 13);
}

export function noteNpsRequest(): void {
  const row = database().prepare(`
    INSERT INTO nps_budget (hour_bucket, count) VALUES (?, 1)
    ON CONFLICT(hour_bucket) DO UPDATE SET count = count + 1
    RETURNING count
  `).get(hourBucket()) as { count: number } | undefined;
  const count = Number(row?.count ?? 0);
  if (count > NPS_HOURLY_LIMIT) {
    throw new UpstreamError("The National Park Service rate limit was reached. Try again in a little while.");
  }
  if (count >= NPS_WARN_AT && !warned) {
    warned = true;
    console.warn(`NPS API requests this hour: ${count}. The published default limit is ${NPS_HOURLY_LIMIT} per hour for this key.`);
  }
}

export function replaceNpsBudgetForTests(count: number): void {
  database().prepare(`
    INSERT INTO nps_budget (hour_bucket, count) VALUES (?, ?)
    ON CONFLICT(hour_bucket) DO UPDATE SET count = excluded.count
  `).run(hourBucket(), count);
}
