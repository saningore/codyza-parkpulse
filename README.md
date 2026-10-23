# ParkPulse

Can I actually visit this park today? ParkPulse reads National Park Service conditions and the National Weather Service forecast for a park's published coordinates.

## Run locally

Create `.env.local` with a free key from the [NPS developer site](https://www.nps.gov/subjects/developer/get-started.htm):

```
NPS_API_KEY=your-key
```

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and search Yellowstone.

Without a key, the site says the key is required. `PARKPULSE_USE_FIXTURES=1` loads labeled sample records for local checks. Those records are not live conditions.

## Checks

```bash
npm test
npm run test:e2e
npm run build
```

Powered by Codyza.
