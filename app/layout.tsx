import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import Link from "next/link";
import { usingFixtures } from "@/lib/runtime";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const sans = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });
const serif = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: { default: "ParkPulse", template: "%s · ParkPulse" },
  description: "Can I actually visit this park today? Official National Park Service conditions and National Weather Service forecasts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="bg-deep px-4 py-2 text-center text-sm font-bold text-card">
          Confirm the official park page before you travel. NPS alert data can lag the park website by about two hours.
        </div>
        {usingFixtures() && (
          <div className="bg-sand px-4 py-2 text-center text-sm font-bold">
            Sample records are loaded for local checks. These are not live National Park Service conditions.
          </div>
        )}
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pine text-card" aria-hidden="true">
                <svg viewBox="0 0 32 32" className="h-7 w-7"><path fill="currentColor" d="M4 25.5 11 12.5l4 6 4.5-9L28 25.5Z" /></svg>
              </span>
              <span>
                <span className="block font-serif text-2xl font-semibold leading-none tracking-tight">ParkPulse</span>
                <span className="text-sm text-ink/70">U.S. National Park conditions</span>
              </span>
            </Link>
            <nav className="flex gap-2 text-sm font-bold" aria-label="Primary">
              <Link className="rounded-full px-3 py-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine" href="/">Conditions</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine" href="/saved">Saved</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine" href="/sources">Sources</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine" href="/about">About</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="mt-16 border-t border-line px-4 py-8 text-center text-sm">
          <p className="font-bold">
            Powered by <a className="text-pine underline underline-offset-2" href="https://codyza.com" target="_blank" rel="noopener noreferrer">Codyza</a>
          </p>
          <p className="mt-2 text-ink/70">National Park Service data and National Weather Service forecasts. ParkPulse does not sell permits or reservations.</p>
        </footer>
      </body>
    </html>
  );
}
