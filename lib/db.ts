import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalStore = globalThis as typeof globalThis & { parkpulseDb?: DatabaseSync };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS parks (
  park_code TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nps_budget (
  hour_bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL
);
`;

export function catalogPath(): string {
  const configured = process.env.PARKPULSE_CATALOG_PATH?.trim();
  return configured || path.join(process.cwd(), "data", "catalog.sqlite");
}

export function database(): DatabaseSync {
  if (!globalStore.parkpulseDb) {
    const filename = catalogPath();
    if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });
    const db = new DatabaseSync(filename);
    db.exec("PRAGMA busy_timeout = 5000");
    if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
    db.exec(SCHEMA);
    globalStore.parkpulseDb = db;
  }
  return globalStore.parkpulseDb;
}
