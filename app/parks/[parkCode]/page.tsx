import { cache } from "react";
import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import ParkView from "@/components/ParkView";
import { ConfigNotice, LoadFailure } from "@/components/Messages";
import { loadParkConditions } from "@/lib/compose";
import { ConfigError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const load = cache((parkCode: string) => loadParkConditions(parkCode));

export async function generateMetadata({ params }: { params: Promise<{ parkCode: string }> }): Promise<Metadata> {
  const { parkCode } = await params;
  try {
    const conditions = await load(parkCode);
    return { title: conditions?.park.fullName ?? "Park", description: conditions?.verdict.reason };
  } catch {
    return { title: "Park conditions" };
  }
}

export default async function ParkPage({ params }: { params: Promise<{ parkCode: string }> }) {
  const { parkCode } = await params;
  if (!/^[a-zA-Z]{4}$/.test(parkCode)) notFound();
  try {
    const conditions = await load(parkCode.toLowerCase());
    if (!conditions) notFound();
    return <ParkView conditions={conditions} />;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ConfigError) return <ConfigNotice />;
    return <LoadFailure />;
  }
}
