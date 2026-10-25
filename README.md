# ParkPulse

Can I actually visit this park today? ParkPulse searches a stored directory of National Park Service sites, then reads official alerts, hours, fees, and campgrounds from public National Park Service pages. The forecast comes from the National Weather Service for the park's published coordinates. An NPS API key adds road events, the park outline, and a richer directory refresh.

## Run locally

Node.js 24 or newer. The directory uses the built-in `node:sqlite` module.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and search `Independence park` or `Yellowstone`.

Search, the map, and the weather forecast work from the committed directory in `data/parks.json`. Alerts and closures come from the public National Park Service list at `https://www.nps.gov/nps-alerts.json`. Hours, fees, photos, campgrounds, and visitor centers come from each park's public page record at `https://www.nps.gov/{code}/structured_data_{code}.json`. Neither file needs a key. A free key from the [NPS developer site](https://www.nps.gov/subjects/developer/get-started.htm) adds road events, today's events, and the park outline. Put it in `.env.local`, which is not committed:

```
NPS_API_KEY=your-key
```

Restart the server after adding the key. The first searches still use the stored directory. A background refresh then replaces those records with the richer NPS Data API payload, including descriptions. On a park page, a configured key loads live conditions immediately.

Without a key, the site stays up and `/api/ready` returns 200 once the directory is loaded. `/api/health` reports `nps: "public"`. If a park's public record does not load, hours and fees stay blank for that park and the visit status stays Unconfirmed unless a danger, closure, or caution alert is posted. ParkPulse does not guess that a park is open.

`PARKPULSE_USE_FIXTURES=1` loads five labeled sample parks for local UI checks. Those records are not live conditions. The production server refuses to start when that variable is set.

## Directory

`npm run catalog:refresh` rebuilds `data/parks.json` from the public NPS Land Resources Division boundary service (no key). The server copies that file into sqlite on first use. The copy is `data/catalog.sqlite` when the project folder is writable, and the system temporary directory when it is not, which is the case on Vercel. When `NPS_API_KEY` is set, the server refreshes the sqlite directory from the NPS Data API if the copy did not come from that API, and again after 24 hours. A failed refresh keeps the previous rows.

The boundary seed has unit code, name, designation, state labels, and a centroid. It does not have alerts, hours, fees, or descriptions. State labels are the boundary service's administrative strings. A trail that crosses many states may list only the states in that label until an API refresh replaces the row. Park and preserve pairs that share a unit code keep the national park name and one centroid.

## Checks

```bash
npm test
npm run test:e2e
npm run build
npm run check:ready
```

`npm test` covers ranking, the stored directory, and sample conditions. It does not call the National Park Service. `npm run test:e2e` runs the sample-data UI and a second server that searches the real directory. `npm run check:ready` exits non-zero when fixture mode is on or the seed has fewer than 400 parks. Use it before a deploy. `/api/health` stays HTTP 200 so a process check can tell a degraded server from a dead one. `/api/ready` is the deploy check: HTTP 200 when the directory is loaded. An API key is not required.

## APIs and limits

| Source | Used for | Key | Limit and caveat |
| --- | --- | --- | --- |
| NPS boundary service | Search directory seed | None | Names, designations, state labels, centroids. Not alerts or hours. |
| NPS public alerts list | Alerts and closures when the Data API key is not set, and when a live Data API call fails over to the stored park | None | `https://www.nps.gov/nps-alerts.json`. Same list as the NPS alerts page. |
| NPS public park pages | Hours, fees, campgrounds, visitor centers, and photos when the Data API key is not set, and when a live Data API call fails over | None | `https://www.nps.gov/{code}/structured_data_{code}.json`. Same record the park website renders. One request per park. |
| NPS Data API | Road events, today's events, things to do, boundaries, directory refresh, and alerts when a key is set | `NPS_API_KEY` in `X-Api-Key` on the server | About 1,000 requests per hour. Data can lag the park website by about two hours. ParkPulse counts calls in sqlite and stops for the rest of that hour at 1,000. The counter is per server file, not global. |
| National Weather Service | Forecast and weather alerts at the park point | None. User-Agent `ParkPulse/1.0 (https://codyza.com)` | One forecast grid, not the whole park. |
| OpenFreeMap Liberty | Basemap | None | OpenStreetMap data. The public `tile.openstreetmap.org` server is not used. |

Saved parks are stored in this browser under `parkpulse.saved.v1`, up to 50 parks. There is no account.

Powered by Codyza.
