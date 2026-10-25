import { afterEach, describe, expect, it, vi } from "vitest";
import { boot } from "@/lib/boot";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("production boot", () => {
  it("refuses to start when sample records are enabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PARKPULSE_USE_FIXTURES", "1");
    expect(() => boot()).toThrow(/sample records/);
  });

  it("stays up without a key so search can use the stored directory", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PARKPULSE_USE_FIXTURES", "");
    vi.stubEnv("NPS_API_KEY", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => boot()).not.toThrow();
    expect(error).not.toHaveBeenCalled();
  });
});
