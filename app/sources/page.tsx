export const metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-4xl font-semibold">Where the conditions come from</h1>
      <p className="mt-3 text-lg">ParkPulse shows official records and leaves a section blank when a source does not respond. It does not invent hours, fees, or alerts.</p>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">National Park Service</h2>
        <p className="mt-2">Parks, alerts, campgrounds, visitor centers, events, things to do, fees, amenities, road events, photos, and park boundaries come from the NPS Data API. Alert categories are Danger, Closure, Caution, and Information. NPS says the API data load runs about every two hours, so a page can lag the park website.</p>
        <p className="mt-2"><a className="font-bold text-pine underline" href="https://www.nps.gov/subjects/developer/api-documentation.htm" target="_blank" rel="noopener noreferrer">NPS API documentation</a></p>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">National Weather Service</h2>
        <p className="mt-2">The forecast and weather alerts use the park&apos;s published coordinates. api.weather.gov resolves that point to a forecast grid. A large park covers more than one grid, so the forecast is for that point, not every trailhead.</p>
        <p className="mt-2"><a className="font-bold text-pine underline" href="https://www.weather.gov/documentation/services-web-api" target="_blank" rel="noopener noreferrer">NWS API documentation</a></p>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Map</h2>
        <p className="mt-2">Map tiles are © OpenStreetMap contributors. Park outlines come from the NPS boundary feed when it is available. Directions open your maps app from the published coordinates.</p>
      </section>
    </article>
  );
}
