export function boot(): void {
  if (process.env.NODE_ENV === "production" && process.env.PARKPULSE_USE_FIXTURES === "1") {
    throw new Error("Refusing to start. PARKPULSE_USE_FIXTURES serves sample records and must be unset when NODE_ENV is production.");
  }
}
