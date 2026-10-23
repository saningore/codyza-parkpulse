import { UpstreamError } from "@/lib/errors";
import { roundCoordinate } from "@/lib/geo";
import { fetchJson } from "@/lib/http";
import { fixtureNws } from "@/lib/fixtures";
import { htmlToText, textOrNull } from "@/lib/text";
import type { WeatherAlert, WeatherPeriod, WeatherReport } from "@/lib/types";
import { nwsApiUrl } from "@/lib/url";
import { REVALIDATE, usingFixtures } from "@/lib/runtime";

const BASE = "https://api.weather.gov";

export type PointsResult = {
  timeZone: string | null;
  forecastUrl: string | null;
  placeLabel: string | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export async function nwsPoints(latitude: number, longitude: number): Promise<PointsResult> {
  const body = usingFixtures()
    ? fixtureNws("points")
    : await readNws(`${BASE}/points/${roundCoordinate(latitude)},${roundCoordinate(longitude)}`, REVALIDATE.points);
  const properties = record(record(body)?.properties);
  const relative = record(record(properties?.relativeLocation)?.properties);
  const city = textOrNull(relative?.city);
  const state = textOrNull(relative?.state);
  return {
    timeZone: textOrNull(properties?.timeZone),
    forecastUrl: nwsApiUrl(properties?.forecast),
    placeLabel: city ? (state ? `${city}, ${state}` : city) : null,
  };
}

export async function nwsForecast(url: string, placeLabel: string | null): Promise<WeatherReport> {
  const safe = nwsApiUrl(url);
  if (!safe) throw new UpstreamError("The forecast link was not a National Weather Service address.");
  const body = usingFixtures() ? fixtureNws("forecast") : await readNws(safe, REVALIDATE.forecast);
  const properties = record(record(body)?.properties);
  const periods = Array.isArray(properties?.periods) ? properties.periods : [];
  return {
    updated: textOrNull(properties?.updated),
    placeLabel,
    periods: periods.slice(0, 4).flatMap((item) => {
      const period = record(item);
      if (!period) return [];
      const temperature = period.temperature;
      const unit = textOrNull(period.temperatureUnit) ?? "F";
      const shortForecast = textOrNull(period.shortForecast);
      if (typeof temperature !== "number" || !shortForecast) return [];
      const precip = record(period.probabilityOfPrecipitation);
      const chance = typeof precip?.value === "number" ? precip.value : null;
      const parsed: WeatherPeriod = {
        name: textOrNull(period.name) ?? "Forecast",
        temperature: `${temperature}°${unit}`,
        wind: textOrNull(period.windSpeed) && textOrNull(period.windDirection)
          ? `${period.windSpeed} ${period.windDirection}`
          : textOrNull(period.windSpeed),
        shortForecast,
        detailedForecast: htmlToText(period.detailedForecast),
        precipitation: chance === null ? null : `${chance}% precipitation`,
        isDaytime: Boolean(period.isDaytime),
      };
      return [parsed];
    }),
  };
}

export async function nwsAlerts(latitude: number, longitude: number): Promise<WeatherAlert[]> {
  const body = usingFixtures()
    ? fixtureNws("alerts", latitude)
    : await readNws(`${BASE}/alerts/active?point=${roundCoordinate(latitude)},${roundCoordinate(longitude)}`, REVALIDATE.forecast);
  const features = Array.isArray(record(body)?.features) ? record(body)?.features as unknown[] : [];
  return features.flatMap((item, index) => {
    const properties = record(record(item)?.properties);
    if (!properties) return [];
    const event = textOrNull(properties.event);
    if (!event) return [];
    return [{
      id: textOrNull(properties.id) ?? `weather-${index}`,
      event,
      headline: htmlToText(properties.headline),
      severity: textOrNull(properties.severity),
      description: htmlToText(properties.description),
      instruction: htmlToText(properties.instruction),
    }];
  });
}

async function readNws(url: string, revalidate: number): Promise<unknown> {
  const response = await fetchJson(url, revalidate);
  if (response.status === 404) throw new UpstreamError("No National Weather Service grid covers that point.");
  if (response.status !== 200) throw new UpstreamError("The National Weather Service could not return that forecast.");
  return response.body;
}
