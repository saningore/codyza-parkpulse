export const metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-4xl font-semibold">Where the conditions come from</h1>
      <p className="mt-3 text-lg">ParkPulse shows official records and leaves a section blank when a source does not respond. It does not invent hours, fees, or alerts.</p>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Park directory</h2>
        <p className="mt-2">Search uses a directory of National Park Service units stored on this server: unit code, name, designation, state labels, and a boundary centroid. The seed comes from the NPS Land Resources Division boundary service, which does not require an API key. It does not include descriptions, alerts, or hours. State labels are that service&apos;s administrative strings, so a long trail may not list every state it crosses until a refresh from the NPS Data API replaces the record.</p>
        <p className="mt-2"><a className="font-bold text-pine underline" href="https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer" target="_blank" rel="noopener noreferrer">NPS boundary service</a></p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">National Park Service</h2>
        <p className="mt-2">Alerts and closures load from the public list the National Park Service shows on its alerts page. Hours, entrance fees, campgrounds, visitor centers, and photos load from the public record on each park&apos;s own page. Neither source needs an API key. Alert categories are Danger, Closure, Caution, and Information. A failed alerts download leaves the visit status unconfirmed instead of guessing that the park is open. A failed park record leaves hours, fees, and campgrounds blank for that park.</p>
        <p className="mt-2"><a className="font-bold text-pine underline" href="https://www.nps.gov/planyourvisit/alerts.htm" target="_blank" rel="noopener noreferrer">NPS alerts page</a></p>
        <p className="mt-2">When a server key is set, road events, today&apos;s events, things to do, amenity lists, and the park outline come from the NPS Data API. The same key can refresh the directory. The key stays on the server and is sent as a header. It is not sent to the browser. NPS documents a default limit of 1,000 requests per hour. NPS says the API data load runs about every two hours, so a page can lag the park website. ParkPulse stops calling the API for the rest of the hour when that server&apos;s own counter passes 1,000. Two separate servers do not share one counter.</p>
        <p className="mt-2"><a className="font-bold text-pine underline" href="https://www.nps.gov/subjects/developer/api-documentation.htm" target="_blank" rel="noopener noreferrer">NPS API documentation</a></p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">National Weather Service</h2>
        <p className="mt-2">The forecast and weather alerts use the park&apos;s published coordinates. api.weather.gov does not use an API key. It requires a User-Agent that identifies the application. The service resolves that point to one forecast grid. A large park covers more than one grid, so the forecast is for that point, not every trailhead.</p>
        <p className="mt-2"><a className="font-bold text-pine underline" href="https://www.weather.gov/documentation/services-web-api" target="_blank" rel="noopener noreferrer">NWS API documentation</a></p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Map</h2>
        <p className="mt-2">The basemap is the OpenFreeMap Liberty style, built from OpenStreetMap data. ParkPulse does not use the public OpenStreetMap tile server, which is not meant for application traffic. Park outlines come from the NPS boundary feed when the Data API is connected and the feed has a boundary. Directions open your maps app from the published coordinates.</p>
        <p className="mt-2"><a className="font-bold text-pine underline" href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a></p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Saved parks</h2>
        <p className="mt-2">Saved parks stay in this browser. ParkPulse does not have accounts, and a saved park on one device is not on another. Clearing site data removes the list.</p>
      </section>
    </article>
  );
}
