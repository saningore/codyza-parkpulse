import { NextResponse } from "next/server";
import { readiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const report = readiness();
  const ready = report.ok && report.mode === "live";
  return NextResponse.json(
    { ok: ready, mode: report.mode, problems: report.problems },
    { status: ready ? 200 : 503 },
  );
}
