import Link from "next/link";

export function ConfigNotice() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-semibold">An NPS API key is required</h1>
      <p className="mt-3 text-lg">ParkPulse reads official conditions from the National Park Service. Add <span className="font-bold">NPS_API_KEY</span> to the server environment and reload.</p>
      <p className="mt-4">
        <a className="font-bold text-pine underline" href="https://www.nps.gov/subjects/developer/get-started.htm" target="_blank" rel="noopener noreferrer">Get a free NPS API key</a>
      </p>
    </article>
  );
}

export function LoadFailure() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-semibold">Conditions could not be loaded</h1>
      <p className="mt-3 text-lg">The National Park Service or weather service did not respond. Try the park again in a few minutes.</p>
      <Link className="mt-6 inline-flex rounded-full bg-pine px-5 py-3 font-bold text-card" href="/">Search parks</Link>
    </article>
  );
}
