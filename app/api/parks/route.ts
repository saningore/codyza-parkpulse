import { NextRequest, NextResponse } from "next/server";
import { catalogByCodes, nearbyCatalog, searchCatalog } from "@/lib/catalog-data";
import { ConfigError, SEARCH_UNAVAILABLE, UpstreamError } from "@/lib/errors";
import { inSearchableArea } from "@/lib/geo";
import { clientKey, rateLimit } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!rateLimit(`parks:${clientKey(request.headers.get("x-forwarded-for"))}`)) {
    return NextResponse.json({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
  }
  const params = request.nextUrl.searchParams;
  try {
    const lat = params.get("lat");
    const lon = params.get("lon");
    if (lat !== null || lon !== null) {
      const latitude = Number(lat);
      const longitude = Number(lon);
      if (!inSearchableArea(latitude, longitude)) {
        return NextResponse.json({ error: "ParkPulse searches National Park Service sites in the United States. That location is outside the searchable area." }, { status: 400 });
      }
      const parks = await nearbyCatalog(latitude, longitude);
      return NextResponse.json({ parks }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
    }
    const codes = params.get("codes");
    if (codes) {
      const list = codes.split(",").map((code) => code.trim().toLowerCase()).filter((code) => /^[a-z]{4}$/.test(code)).slice(0, 20);
      const parks = await catalogByCodes(list);
      return NextResponse.json({ parks });
    }
    const query = params.get("q")?.slice(0, 80) ?? "";
    if (query.trim().length < 2) {
      return NextResponse.json({ error: "Enter at least two letters of a park name, state, or park code." }, { status: 400 });
    }
    const parks = await searchCatalog(query);
    return NextResponse.json({ parks }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      return NextResponse.json({ error: SEARCH_UNAVAILABLE }, { status: 503 });
    }
    const message = error instanceof UpstreamError ? error.message : "Park records are temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
