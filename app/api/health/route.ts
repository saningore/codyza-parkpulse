import { NextResponse } from "next/server";
import { readiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(readiness());
}
