import { NextResponse } from "next/server";
import { npsConfigured, usingFixtures } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    mode: usingFixtures() ? "fixtures" : npsConfigured() ? "live" : "unconfigured",
  });
}
