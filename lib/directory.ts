import fs from "node:fs";
import path from "node:path";
import { database } from "@/lib/db";
import { toSummary } from "@/lib/nps-parse";
import { hasNpsKey, REVALIDATE, usingFixtures } from "@/lib/runtime";
import type { ParkDetail, ParkSummary } from "@/lib/types";

const MIN_PARKS = 400;

type DirectorySeed = {
  parkCode: string;
  fullName: string;
  designation: string | null;
  states: string | null;
  latitude: number;
  longitude: number;
  url: string;
};

type SeedFile = {
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  limitations: string;
  parks: DirectorySeed[];
};

type DirectoryStatus = {
  count: number;
  origin: string | null;
  retrievedAt: string | null;
  refreshedAt: string | null;
};

let seeded = false;
let refresh: Promise<void> | null = null;

function readSeed(): SeedFile {
  const file = path.join(process.cwd(), "data", "parks.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as SeedFile;
  if (!parsed?.retrievedAt || !Array.isArray(parsed.parks) || parsed.parks.length < MIN_PARKS) {
    throw new Error("data/parks.json is missing or too small. Run npm run catalog:refresh.");
  }
  return parsed;
}

function expand(seed: DirectorySeed): ParkDetail | null {
  if (!/^[a-z]{4}$/.test(seed.parkCode) || !seed.fullName?.trim()) return null;
  if (!Number.isFinite(seed.latitude) || !Number.isFinite(seed.longitude)) return null;
  return {
    parkCode: seed.parkCode,
    fullName: seed.fullName,
    designation: seed.designation,
    states: seed.states,
    description: null,
    url: seed.url,
    latitude: seed.latitude,
    longitude: seed.longitude,
    directions: null,
    directionsUrl: null,
    weatherOverview: null,
    phone: null,
    images: [],
    activities: [],
    schedules: [],
    fees: [],
  };
}

function meta(key: string): string | null {
  const row = database().prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setMeta(key: string, value: string): void {
  database().prepare(`
    INSERT INTO meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

function replaceParks(parks: ParkDetail[], origin: string, retrievedAt: string): void {
  const db = database();
  const insert = db.prepare("INSERT INTO parks (park_code, full_name, payload) VALUES (?, ?, ?)");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM parks");
    for (const park of parks) insert.run(park.parkCode, park.fullName, JSON.stringify(park));
    setMeta("origin", origin);
    setMeta("retrieved_at", retrievedAt);
    setMeta("refreshed_at", new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function parseStored(payload: string): ParkDetail | null {
  try {
    const park = JSON.parse(payload) as ParkDetail;
    if (!park || !/^[a-z]{4}$/.test(park.parkCode) || !park.fullName) return null;
    return park;
  } catch {
    return null;
  }
}

export function ensureDirectory(): void {
  if (seeded) return;
  const db = database();
  const count = Number((db.prepare("SELECT COUNT(*) AS n FROM parks").get() as { n: number }).n);
  const origin = meta("origin");
  const seed = readSeed();
  const sameSeed = origin === "boundary-service" && meta("retrieved_at") === seed.retrievedAt && count >= MIN_PARKS;
  const keepApi = origin === "nps-api" && count >= MIN_PARKS;
  if (!sameSeed && !keepApi) {
    const parks = seed.parks.flatMap((item) => {
      const park = expand(item);
      return park ? [park] : [];
    });
    if (parks.length < MIN_PARKS) throw new Error("The park directory seed did not contain enough valid parks.");
    replaceParks(parks, "boundary-service", seed.retrievedAt);
  }
  seeded = true;
}

export function directoryStatus(): DirectoryStatus {
  ensureDirectory();
  const count = Number((database().prepare("SELECT COUNT(*) AS n FROM parks").get() as { n: number }).n);
  return {
    count,
    origin: meta("origin"),
    retrievedAt: meta("retrieved_at"),
    refreshedAt: meta("refreshed_at"),
  };
}

export function listDirectory(): ParkSummary[] {
  ensureDirectory();
  const rows = database().prepare("SELECT payload FROM parks ORDER BY full_name COLLATE NOCASE, park_code").all() as { payload: string }[];
  return rows.flatMap((row) => {
    const park = parseStored(row.payload);
    return park ? [toSummary(park)] : [];
  });
}

export function getDirectoryPark(parkCode: string): ParkDetail | null {
  ensureDirectory();
  const row = database().prepare("SELECT payload FROM parks WHERE park_code = ?").get(parkCode) as { payload: string } | undefined;
  return row ? parseStored(row.payload) : null;
}

export async function syncDirectoryFromNps(): Promise<number> {
  if (!hasNpsKey()) throw new Error("NPS_API_KEY is required to refresh the park directory from the NPS Data API.");
  const { npsCollection } = await import("@/lib/nps");
  const { parsePark } = await import("@/lib/nps-parse");
  const rows = await npsCollection("/parks", REVALIDATE.catalog, 1_000);
  const parks = rows.flatMap((row) => {
    const park = parsePark(row, null);
    return park ? [park] : [];
  });
  if (parks.length < MIN_PARKS) {
    throw new Error(`The National Park Service returned ${parks.length} parks. The stored directory was left unchanged.`);
  }
  replaceParks(parks, "nps-api", new Date().toISOString());
  return parks.length;
}

export function scheduleDirectoryRefresh(): void {
  if (process.env.VITEST || usingFixtures() || !hasNpsKey() || refresh) return;
  const status = directoryStatus();
  const age = status.refreshedAt ? Date.now() - Date.parse(status.refreshedAt) : Number.POSITIVE_INFINITY;
  const due = status.origin !== "nps-api" || !Number.isFinite(age) || age > 86_400_000;
  if (!due) return;
  refresh = syncDirectoryFromNps().then((count) => {
    console.info(`Park directory refreshed from the NPS Data API (${count} parks).`);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`Park directory refresh failed. Search is still using the stored directory. ${message}`);
  }).finally(() => {
    refresh = null;
  });
}
