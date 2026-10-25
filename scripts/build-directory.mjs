import fs from "node:fs";
import path from "node:path";

const USER_AGENT = "ParkPulse/1.0 (https://codyza.com)";
const SERVICE = "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer";
const OUT = path.join(process.cwd(), "data", "parks.json");

const ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY", "PR", "GU", "AS", "VI", "MP",
]);

const STATE_WORDS = new Map([
  ["GUAM", "GU"],
  ["SAMOA", "AS"],
  ["NMI", "MP"],
]);

function statesFrom(value) {
  const raw = String(value ?? "").toUpperCase().trim();
  if (!raw) return [];
  if (STATE_WORDS.has(raw)) return [STATE_WORDS.get(raw)];
  const found = [];
  for (const token of raw.split(/[^A-Z]+/).filter(Boolean)) {
    const code = ABBREVIATIONS.has(token) ? token : STATE_WORDS.get(token);
    if (code && !found.includes(code)) found.push(code);
  }
  return found.sort();
}

async function arcgis(layer, params) {
  const url = new URL(`${SERVICE}/${layer}/query`);
  url.search = new URLSearchParams({ f: "json", ...params });
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`NPS boundary service returned ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "NPS boundary service rejected the query");
  return body.features ?? [];
}

function prefer(rows) {
  return rows.find((row) => row.attributes.UNIT_TYPE === "National Park")
    ?? rows.find((row) => String(row.attributes.UNIT_NAME ?? "").includes("National Park"))
    ?? rows[0];
}

const [centroids, stateRows] = await Promise.all([
  arcgis("0", {
    where: "1=1",
    outFields: "UNIT_CODE,UNIT_NAME,STATE,UNIT_TYPE,Status",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "2000",
  }),
  arcgis("2", {
    where: "1=1",
    outFields: "UNIT_CODE,STATE",
    returnGeometry: "false",
    returnDistinctValues: "true",
    resultRecordCount: "2000",
  }),
]);

const states = new Map();
for (const row of stateRows) {
  const code = String(row.attributes.UNIT_CODE ?? "").trim().toLowerCase();
  states.set(code, statesFrom(row.attributes.STATE));
}

const grouped = new Map();
for (const row of centroids) {
  const code = String(row.attributes.UNIT_CODE ?? "").trim().toLowerCase();
  if (!/^[a-z]{4}$/.test(code)) continue;
  const list = grouped.get(code) ?? [];
  list.push(row);
  grouped.set(code, list);
}

const parks = [];
for (const [parkCode, rows] of grouped) {
  const row = prefer(rows);
  const longitude = Number(row.geometry?.x);
  const latitude = Number(row.geometry?.y);
  const fullName = String(row.attributes.UNIT_NAME ?? "").trim();
  if (!fullName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
  const fromBoundary = states.get(parkCode) ?? [];
  const fromCentroid = statesFrom(row.attributes.STATE);
  const merged = fromBoundary.length ? fromBoundary : fromCentroid;
  parks.push({
    parkCode,
    fullName,
    designation: String(row.attributes.UNIT_TYPE ?? "").trim() || null,
    states: merged.length ? merged.join(",") : null,
    latitude: Math.round(latitude * 1e5) / 1e5,
    longitude: Math.round(longitude * 1e5) / 1e5,
    url: `https://www.nps.gov/${parkCode}/index.htm`,
  });
}

parks.sort((a, b) => a.fullName.localeCompare(b.fullName) || a.parkCode.localeCompare(b.parkCode));

if (parks.length < 400) {
  throw new Error(`Expected at least 400 National Park Service units, received ${parks.length}`);
}

const document = {
  source: "NPS Land Resources Division boundary centroids and state labels",
  sourceUrl: SERVICE,
  retrievedAt: new Date().toISOString(),
  limitations: "This file is the searchable park directory: four-letter unit code, official unit name, designation, state labels, and a boundary centroid. It does not include alerts, hours, fees, or descriptions. Those come from the NPS Data API when NPS_API_KEY is set. State labels are the boundary service's administrative strings, so a trail that crosses many states may list only the states in that label until an API refresh replaces the record. Park and preserve pairs that share a unit code keep the national park name and one centroid.",
  parks,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`);

const inde = parks.find((park) => park.parkCode === "inde");
const yell = parks.find((park) => park.parkCode === "yell");
console.log(`Wrote ${parks.length} parks to ${OUT}`);
console.log("Independence", JSON.stringify(inde));
console.log("Yellowstone", JSON.stringify(yell));
