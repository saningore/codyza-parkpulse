"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { stateNames } from "@/lib/format";
import { readSaved, toggleSaved, type SavedPark } from "@/lib/saved";

export default function SavedParks() {
  const [parks, setParks] = useState<SavedPark[] | null>(null);

  useEffect(() => {
    setParks(readSaved());
  }, []);

  if (parks === null) return <p className="mx-auto max-w-3xl px-4 py-10">Loading saved parks…</p>;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-4xl font-semibold">Saved parks</h1>
      <p className="mt-3 text-lg text-ink/80">Saved on this device only. ParkPulse does not keep an account.</p>
      {parks.length === 0 ? <p className="mt-6">You have not saved any parks on this device.</p> : (
        <ul className="mt-6 space-y-3">
          {parks.map((park) => (
            <li key={park.parkCode} className="rounded-3xl border border-line bg-card p-4">
              <h2 className="font-serif text-2xl font-semibold">
                <Link className="text-pine underline" href={`/parks/${park.parkCode}`}>{park.fullName}</Link>
              </h2>
              <p className="mt-1 text-sm font-bold">{[park.designation, stateNames(park.states), park.parkCode].filter(Boolean).join(" · ")}</p>
              <button
                type="button"
                className="mt-3 text-sm font-bold text-clay underline"
                onClick={() => {
                  toggleSaved(park);
                  setParks(readSaved());
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
