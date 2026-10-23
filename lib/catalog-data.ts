import { parksNear, rankParks } from "@/lib/catalog";
import { npsCollection } from "@/lib/nps";
import { parsePark, toSummary } from "@/lib/nps-parse";
import { REVALIDATE } from "@/lib/runtime";
import type { ParkSummary } from "@/lib/types";

export async function loadCatalog(): Promise<ParkSummary[]> {
  const rows = await npsCollection("/parks", REVALIDATE.catalog, 600);
  return rows.flatMap((row) => {
    const park = parsePark(row, null);
    return park ? [toSummary(park)] : [];
  });
}

export async function searchCatalog(query: string): Promise<ParkSummary[]> {
  return rankParks(await loadCatalog(), query);
}

export async function nearbyCatalog(latitude: number, longitude: number): Promise<ParkSummary[]> {
  return parksNear(await loadCatalog(), latitude, longitude);
}

export async function catalogByCodes(codes: string[]): Promise<ParkSummary[]> {
  const wanted = new Set(codes.map((code) => code.toLowerCase()));
  return (await loadCatalog()).filter((park) => wanted.has(park.parkCode));
}
