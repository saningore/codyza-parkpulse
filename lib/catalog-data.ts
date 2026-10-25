import { parksNear, rankParks } from "@/lib/catalog";
import { listDirectory, scheduleDirectoryRefresh } from "@/lib/directory";
import { UpstreamError } from "@/lib/errors";
import { npsCollection } from "@/lib/nps";
import { parsePark, toSummary } from "@/lib/nps-parse";
import { REVALIDATE, usingFixtures } from "@/lib/runtime";
import type { ParkSummary } from "@/lib/types";

export async function loadCatalog(): Promise<ParkSummary[]> {
  if (!usingFixtures()) {
    try {
      scheduleDirectoryRefresh();
      return listDirectory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`Park directory could not be read. ${message}`);
      throw new UpstreamError("Park search is unavailable right now. Try again in a few minutes.");
    }
  }
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
