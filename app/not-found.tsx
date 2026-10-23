import Link from "next/link";

export default function NotFound() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-semibold">That park page is not available</h1>
      <p className="mt-3 text-lg">The park code may be wrong, or the National Park Service has no matching site.</p>
      <Link className="mt-6 inline-flex rounded-full bg-pine px-5 py-3 font-bold text-card" href="/">Search parks</Link>
    </article>
  );
}
