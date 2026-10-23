"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SaveButton from "@/components/SaveButton";
import { formatMiles, stateNames } from "@/lib/format";
import type { ParkSummary } from "@/lib/types";

export default function SearchExperience() {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ParkSummary[]>([]);
  const [results, setResults] = useState<ParkSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [nationalOnly, setNationalOnly] = useState(false);
  const [phase, setPhase] = useState<"idle" | "searching">("idle");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"search" | "near">("search");

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/parks?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!controller.signal.aborted) setSuggestions(response.ok && Array.isArray(payload.parks) ? payload.parks : []);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  async function runSearch(nextQuery: string) {
    setPhase("searching");
    setError("");
    setMode("search");
    setOpen(false);
    try {
      const response = await fetch(`/api/parks?q=${encodeURIComponent(nextQuery.trim())}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Park search is temporarily unavailable.");
      const parks = Array.isArray(payload.parks) ? payload.parks as ParkSummary[] : [];
      if (parks.length === 1) {
        router.push(`/parks/${parks[0].parkCode}`);
        return;
      }
      setResults(parks);
    } catch (caught) {
      setResults(null);
      setError(caught instanceof Error ? caught.message : "Park search is temporarily unavailable.");
    } finally {
      setPhase("idle");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (active >= 0 && suggestions[active]) {
      router.push(`/parks/${suggestions[active].parkCode}`);
      return;
    }
    await runSearch(query);
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("Location permission was not granted. Search by park name instead.");
      return;
    }
    setPhase("searching");
    setError("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const response = await fetch(`/api/parks?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Nearby parks could not be loaded.");
        setMode("near");
        setResults(Array.isArray(payload.parks) ? payload.parks : []);
      } catch (caught) {
        setResults(null);
        setError(caught instanceof Error ? caught.message : "Nearby parks could not be loaded.");
      } finally {
        setPhase("idle");
      }
    }, () => {
      setPhase("idle");
      setError("Location permission was not granted. Search by park name instead.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  const visible = (results ?? []).filter((park) => !nationalOnly || /national park/i.test(park.designation ?? ""));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="max-w-3xl">
        <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">Can I actually visit this park today?</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink/80">Search a National Park Service site. ParkPulse leads with official alerts, closures, hours, and the forecast for the park&apos;s published coordinates.</p>
      </section>

      <form onSubmit={onSubmit} className="mt-6 rounded-3xl border border-line bg-card p-4" role="search">
        <label htmlFor="park" className="text-sm font-bold">Park name, state, or park code</label>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <input
              id="park"
              role="combobox"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
              placeholder="Yellowstone or yell"
              value={query}
              autoComplete="off"
              maxLength={80}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
                if (!suggestions.length) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) => event.key === "ArrowDown" ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length - 1 : index - 1));
                }
              }}
            />
            {open && suggestions.length > 0 && (
              <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-line bg-card p-1">
                {suggestions.map((park, index) => (
                  <li key={park.parkCode} id={`${listId}-${index}`} role="option" aria-selected={active === index}>
                    <button
                      type="button"
                      className={`w-full rounded-xl px-3 py-2 text-left ${active === index ? "bg-moss" : "hover:bg-mist"}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => router.push(`/parks/${park.parkCode}`)}
                    >
                      <span className="block font-bold">{park.fullName}</span>
                      <span className="text-sm text-ink/70">{[park.designation, stateNames(park.states), park.parkCode].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="rounded-2xl bg-pine px-5 py-3 font-bold text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine" disabled={phase === "searching"}>
            {phase === "searching" ? "Searching…" : "Search"}
          </button>
          <button type="button" className="rounded-2xl border border-pine px-5 py-3 font-bold text-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine" onClick={locate}>
            Near me
          </button>
        </div>
      </form>

      <p className="mt-4 text-sm">
        Try <Link className="font-bold text-pine underline" href="/parks/yell">Yellowstone National Park</Link>
      </p>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-rose px-4 py-3">{error}</p>}

      {results && (
        <section className="mt-8" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-3xl font-semibold">{mode === "near" ? "Parks near you" : "Matching parks"}</h2>
            <button type="button" className="rounded-full border border-line px-4 py-2 text-sm font-bold" aria-pressed={nationalOnly} onClick={() => setNationalOnly((value) => !value)}>
              National Parks only
            </button>
          </div>
          {visible.length === 0 ? <p className="mt-3">No matching park sites were found.</p> : (
            <ul className="mt-4 grid gap-3">
              {visible.map((park) => (
                <li key={park.parkCode} className="rounded-3xl border border-line bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-2xl font-semibold">
                        <Link className="underline decoration-transparent underline-offset-4 hover:decoration-pine" href={`/parks/${park.parkCode}`}>{park.fullName}</Link>
                      </h3>
                      <p className="mt-1 text-sm font-bold text-pine">{[park.designation, stateNames(park.states), formatMiles(park.distanceMiles)].filter(Boolean).join(" · ")}</p>
                      {park.description && <p className="mt-2 max-w-3xl text-sm">{park.description}</p>}
                    </div>
                    <SaveButton park={park} />
                  </div>
                  <Link className="mt-3 inline-flex font-bold text-pine underline" href={`/parks/${park.parkCode}`}>View conditions</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-3xl font-semibold">How to read the status</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["Closed today", "Listed hours say closed, or an alert says the whole park is closed to visitors."],
            ["Hazard", "The park posted at least one danger alert."],
            ["Restricted", "A road, campground, entrance, or area is closed. The rest of the park may be open."],
            ["Caution", "A caution alert is posted, or the weather service has a watch or warning at the park point."],
            ["Open today", "Hours say open, and no danger, closure, or caution alert was posted."],
            ["Unconfirmed", "Alerts did not load, or today's hours could not be checked. ParkPulse does not guess open."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-3xl border border-line bg-card p-4">
              <dt className="font-serif text-xl font-semibold">{title}</dt>
              <dd className="mt-1 text-sm">{text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
