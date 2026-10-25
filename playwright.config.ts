import { defineConfig, devices } from "@playwright/test";

const fixturesURL = "http://127.0.0.1:3100";
const directoryURL = "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: `${fixturesURL}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { ...process.env, PARKPULSE_USE_FIXTURES: "1", PARKPULSE_DIST_DIR: ".next-e2e/fixtures" },
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3101",
      url: `${directoryURL}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { ...process.env, PARKPULSE_USE_FIXTURES: "", PARKPULSE_DIST_DIR: ".next-e2e/live" },
    },
  ],
  projects: [
    {
      name: "fixtures",
      testIgnore: /directory\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: fixturesURL },
    },
    {
      name: "directory",
      testMatch: /directory\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: directoryURL },
    },
  ],
});
