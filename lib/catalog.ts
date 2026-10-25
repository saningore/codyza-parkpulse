import { milesBetween } from "@/lib/geo";
import { stateQuery } from "@/lib/format";
import type { ParkSummary } from "@/lib/types";

const STOP_WORDS = new Set(["a", "an", "and", "of", "the", "national", "park", "parks", "site", "sites"]);

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 2);
}

function needlesFor(query: string): string[] {
  const tokens = words(query);
  const meaningful = tokens.filter((word) => !STOP_WORDS.has(word));
  return meaningful.length ? meaningful : tokens;
}

function nameCovers(name: string, needles: string[]): boolean {
  if (!needles.length) return false;
  const nameWords = words(name);
  return needles.every((needle) => nameWords.some((word) => word === needle || (needle.length >= 3 && word.startsWith(needle)))
    || (needle.length >= 3 && name.includes(needle)));
}

export function rankParks(parks: ParkSummary[], rawQuery: string): ParkSummary[] {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (query.length < 2) return [];
  const state = stateQuery(query);
  const needles = needlesFor(query);
  const scored = parks.flatMap((park) => {
    const name = park.fullName.toLowerCase();
    const code = park.parkCode.toLowerCase();
    const designation = park.designation?.toLowerCase() ?? "";
    const description = park.description?.toLowerCase() ?? "";
    const states = park.states?.toUpperCase().split(",").map((part) => part.trim()) ?? [];
    let score = 0;
    if (code === query) score = 100;
    else if (name === query) score = 90;
    else if (name.startsWith(query)) score = 80;
    else if (nameCovers(name, needles)) score = 70;
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
