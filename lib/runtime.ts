export function usingFixtures(): boolean {
  return process.env.PARKPULSE_USE_FIXTURES === "1";
}

export function hasNpsKey(): boolean {
  return Boolean(process.env.NPS_API_KEY?.trim());
}

export function npsConfigured(): boolean {
  return usingFixtures() || hasNpsKey();
}

export const REVALIDATE = {
  catalog: 86_400,
  park: 21_600,
  alerts: 600,
  events: 3_600,
  boundary: 604_800,
  points: 86_400,
  forecast: 600,
} as const;
