import { milesBetween } from "@/lib/geo";
import { stateQuery } from "@/lib/format";
import type { ParkSummary } from "@/lib/types";

export function rankParks(parks: ParkSummary[], rawQuery: string): ParkSummary[] {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (query.length < 2) return [];
  const state = stateQuery(query);
  const scored = parks.flatMap((park) => {
    const name = park.fullName.toLowerCase();
    const code = park.parkCode.toLowerCase();
    const designation = park.designation?.toLowerCase() ?? "";
    const description = park.description?.toLowerCase() ?? "";
    const states = park.states?.toUpperCase().split(",").map((part) => part.trim()) ?? [];
    let score = 0;
    if (code === query) score = 100;
    else if (name === query) score = 80;
    else if (name.startsWith(query)) score = 60;
    else if (query.length >= 3 && name.includes(query)) score = 40;
    else if (state && states.includes(state)) score = 30;
    else if (query.length >= 3 && designation.includes(query)) score = 20;
    else if (query.length >= 3 && description.includes(query)) score = 10;
    return score > 0 ? [{ park, score }] : [];
  });
  scored.sort((a, b) => b.score - a.score || a.park.fullName.localeCompare(b.park.fullName));
  return scored.slice(0, 12).map((item) => item.park);
}

export function parksNear(parks: ParkSummary[], latitude: number, longitude: number): ParkSummary[] {
  return parks
    .flatMap((park) => {
      if (park.latitude === null || park.longitude === null) return [];
      const distanceMiles = milesBetween(latitude, longitude, park.latitude, park.longitude);
      return [{ ...park, distanceMiles }];
    })
    .sort((a, b) => (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999) || a.fullName.localeCompare(b.fullName))
    .slice(0, 15);
}
