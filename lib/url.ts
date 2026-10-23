const HOSTS = ["nps.gov", "recreation.gov", "weather.gov"];

export function httpsUrl(value: unknown, hosts = HOSTS): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (!hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function nwsApiUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "api.weather.gov") return null;
    return url.toString();
  } catch {
    return null;
  }
}
