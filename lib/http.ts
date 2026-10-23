import { UpstreamError } from "@/lib/errors";
import { USER_AGENT } from "@/lib/types";

const flights = new Map<string, Promise<unknown>>();

export async function fetchJson(
  url: string,
  revalidate: number,
  extraHeaders?: Record<string, string>,
  timeoutMs = 8000,
): Promise<{ status: number; body: unknown }> {
  const existing = flights.get(url);
  if (existing) return existing as Promise<{ status: number; body: unknown }>;
  const promise = readJson(url, revalidate, extraHeaders, timeoutMs).finally(() => flights.delete(url));
  flights.set(url, promise);
  return promise;
}

async function readJson(
  url: string,
  revalidate: number,
  extraHeaders: Record<string, string> | undefined,
  timeoutMs: number,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/geo+json, application/json",
        "User-Agent": USER_AGENT,
        ...extraHeaders,
      },
      next: { revalidate },
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamError("A conditions source took too long to respond.");
    }
    throw new UpstreamError("A conditions source could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}

const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function clientKey(header: string | null): string {
  const forwarded = header?.split(",")[0]?.trim();
  return forwarded || "local";
}
