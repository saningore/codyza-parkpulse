import { hasNpsKey } from "@/lib/runtime";

export function boot(): void {
  if (process.env.NODE_ENV === "production" && process.env.PARKPULSE_USE_FIXTURES === "1") {
    throw new Error("Refusing to start. PARKPULSE_USE_FIXTURES serves sample records and must be unset when NODE_ENV is production.");
  }
  if (process.env.NODE_ENV === "production" && !hasNpsKey()) {
    console.error("ParkPulse is degraded. NPS_API_KEY is missing, so hours, campgrounds, and fees are not live. Search uses the stored directory, and alerts use the public National Park Service list.");
  }
}
