import Link from "next/link";

export function ConfigNotice() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-semibold">Live conditions are unavailable</h1>
      <p className="mt-3 text-lg">ParkPulse could not read National Park Service alerts and hours for this park. Search still lists park sites. Check the official park page before you travel.</p>
      <Link className="mt-6 inline-flex rounded-full bg-pine px-5 py-3 font-bold text-card" href="/">Search parks</Link>
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
