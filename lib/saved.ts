export type SavedPark = {
  parkCode: string;
  fullName: string;
  designation: string | null;
  states: string | null;
};

const KEY = "parkpulse.saved.v1";

function valid(value: unknown): value is SavedPark {
  if (!value || typeof value !== "object") return false;
  const park = value as SavedPark;
  return typeof park.parkCode === "string" && /^[a-z]{4}$/.test(park.parkCode) && typeof park.fullName === "string" && park.fullName.trim().length > 0;
}

export function readSaved(): SavedPark[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(valid).slice(0, 50);
  } catch {
    return [];
  }
}

export function isSaved(parkCode: string): boolean {
  return readSaved().some((park) => park.parkCode === parkCode);
}

export function toggleSaved(park: SavedPark): boolean {
  const current = readSaved();
  const exists = current.some((item) => item.parkCode === park.parkCode);
  const next = exists ? current.filter((item) => item.parkCode !== park.parkCode) : [park, ...current].slice(0, 50);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return !exists;
}
