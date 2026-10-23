import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError, UpstreamError } from "@/lib/errors";
import { clientKey, fetchJson, rateLimit } from "@/lib/http";
import { npsConfigured, usingFixtures } from "@/lib/runtime";
import { isSaved, readSaved, toggleSaved, type SavedPark } from "@/lib/saved";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
  };
}

function codeAt(index: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return alphabet[Math.floor(index / (26 * 26)) % 26] + alphabet[Math.floor(index / 26) % 26] + alphabet[index % 26] + "z";
}

describe("saved parks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns nothing when there is no browser storage", () => {
    vi.stubGlobal("window", undefined);
    expect(readSaved()).toEqual([]);
  });

  it("round-trips a park, ignores corrupt entries, and keeps the newest fifty", () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    const park: SavedPark = { parkCode: "yell", fullName: "Yellowstone National Park", designation: "National Park", states: "WY" };
    expect(toggleSaved(park)).toBe(true);
    expect(isSaved("yell")).toBe(true);
    expect(toggleSaved(park)).toBe(false);
    expect(readSaved()).toEqual([]);

    storage.setItem("parkpulse.saved.v1", "{");
    expect(readSaved()).toEqual([]);
    storage.setItem("parkpulse.saved.v1", JSON.stringify({ parkCode: "yell" }));
    expect(readSaved()).toEqual([]);
    storage.setItem("parkpulse.saved.v1", JSON.stringify([
      { parkCode: "no", fullName: "Too short" },
      { parkCode: "yell", fullName: "  " },
      park,
      null,
    ]));
    expect(readSaved()).toEqual([park]);

    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("denied"); }, setItem: () => undefined } });
    expect(readSaved()).toEqual([]);

    vi.stubGlobal("window", { localStorage: memoryStorage() });
    for (let index = 0; index < 51; index += 1) {
      toggleSaved({ parkCode: codeAt(index), fullName: `Park ${index}`, designation: null, states: null });
    }
    const saved = readSaved();
    expect(saved).toHaveLength(50);
    expect(saved[0].parkCode).toBe(codeAt(50));
    expect(saved.some((item) => item.parkCode === codeAt(0))).toBe(false);
  });
});

describe("HTTP client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shares one in-flight request and retries after it finishes", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { status: 200, json: async () => ({ ok: calls }) };
    });
    const url = "https://api.example.com/shared";
    const [first, second] = await Promise.all([fetchJson(url, 60), fetchJson(url, 60)]);
    expect(calls).toBe(1);
    expect(first).toEqual(second);
    await fetchJson(url, 60);
    expect(calls).toBe(2);
  });

  it("returns a null body when the payload is not JSON", async () => {
    vi.stubGlobal("fetch", async () => ({ status: 200, json: async () => { throw new Error("bad json"); } }));
    await expect(fetchJson("https://api.example.com/text", 60)).resolves.toEqual({ status: 200, body: null });
  });

  it("turns timeouts and network failures into source errors", async () => {
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }));
    await expect(fetchJson("https://api.example.com/slow", 60, undefined, 20)).rejects.toThrow(/too long to respond/);

    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    await expect(fetchJson("https://api.example.com/down", 60)).rejects.toBeInstanceOf(UpstreamError);
    await expect(fetchJson("https://api.example.com/down-2", 60)).rejects.toThrow(/could not be reached/);
  });

  it("limits a caller inside the window and allows them again after it passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T00:00:00Z"));
    expect(rateLimit("unit-limit", 2, 1_000)).toBe(true);
    expect(rateLimit("unit-limit", 2, 1_000)).toBe(true);
    expect(rateLimit("unit-limit", 2, 1_000)).toBe(false);
    vi.setSystemTime(new Date("2026-10-23T00:00:02Z"));
    expect(rateLimit("unit-limit", 2, 1_000)).toBe(true);
  });

  it("uses the first forwarded address", () => {
    expect(clientKey("203.0.113.5, 198.51.100.2")).toBe("203.0.113.5");
    expect(clientKey("  , 198.51.100.2")).toBe("local");
    expect(clientKey(null)).toBe("local");
    expect(clientKey("")).toBe("local");
  });
});

describe("runtime mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats fixture mode as configured and a blank key as missing", () => {
    vi.stubEnv("PARKPULSE_USE_FIXTURES", "1");
    vi.stubEnv("NPS_API_KEY", "");
    expect(usingFixtures()).toBe(true);
    expect(npsConfigured()).toBe(true);

    vi.stubEnv("PARKPULSE_USE_FIXTURES", "");
    vi.stubEnv("NPS_API_KEY", "  key  ");
    expect(usingFixtures()).toBe(false);
    expect(npsConfigured()).toBe(true);

    vi.stubEnv("NPS_API_KEY", "   ");
    expect(npsConfigured()).toBe(false);
    expect(new ConfigError().message).toMatch(/NPS API key/);
  });
});
