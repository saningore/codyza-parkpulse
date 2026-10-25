import { expect, test } from "@playwright/test";

const liveKey = Boolean(process.env.NPS_API_KEY?.trim());

async function openPark(page: import("@playwright/test").Page, query: string, code: string, name: string) {
  await page.goto("/");
  await page.getByLabel("Park name, state, or park code").fill(query);
  await page.getByRole("button", { name: "Search" }).click();
  await Promise.race([
    page.waitForURL(new RegExp(`/parks/${code}$`)),
    page.getByRole("heading", { name: "Matching parks" }).waitFor(),
  ]);
  if (!page.url().endsWith(`/parks/${code}`)) {
    await page.getByRole("link", { name }).first().click();
  }
  await expect(page).toHaveURL(new RegExp(`/parks/${code}$`));
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test.describe("real park directory", () => {
  test("searches Independence, Yellowstone, and the Grand Canyon without a sample banner", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Can I actually visit this park today?" })).toBeVisible();
    await expect(page.getByText("Sample records are loaded")).toHaveCount(0);
    await expect(page.getByText("needs an NPS API key")).toHaveCount(0);
    await expect(page.getByText("Hours, campgrounds, and fees appear after this server is connected")).toHaveCount(0);

    await openPark(page, "Independence park", "inde", "Independence National Historical Park");
    await expect(page.getByRole("link", { name: "Official park page" })).toHaveAttribute("href", /nps\.gov\/inde/);
    if (!liveKey) await expect(page.getByText("39.9517, -75.1494")).toBeVisible();
    await expect(page.getByText(/°|forecast could not be loaded/).first()).toBeVisible();
    await expect(page.locator("[data-map-ready='true']")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("NPS_API_KEY")).toHaveCount(0);
    if (!liveKey) {
      await expect(page.getByRole("heading", { name: "Conditions could not be loaded" })).toHaveCount(0);
      await expect(page.getByText("Park search is unavailable")).toHaveCount(0);
      await expect(page.locator("[data-status=open]")).toBeVisible();
      await expect(page.getByText("Alerts unavailable")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Limited Restroom Availability" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "All Park - Independence National Historical Park" })).toBeVisible();
      await expect(page.getByText("9:00 AM - 5:00 PM").first()).toBeVisible();
    }

    await page.getByRole("button", { name: "Save park" }).click();
    await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
    await page.getByRole("link", { name: "Saved" }).click();
    await expect(page.getByRole("heading", { name: "Independence National Historical Park" })).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("You have not saved any parks on this device.")).toBeVisible();

    await openPark(page, "yellowstone park", "yell", "Yellowstone National Park");
    if (!liveKey) {
      await expect(page.getByRole("heading", { name: "Conditions could not be loaded" })).toHaveCount(0);
      await expect(page.locator("[data-status=restricted]")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Stay Away From Bull Elk" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Biscuit Basin Closed Due to Hydrothermal Explosion" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "All Park - All Park Hours" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Canyon Campground" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Yellowstone (non-commercial vehicle)" })).toBeVisible();
      await expect(page.getByText("$35.00").first()).toBeVisible();
    }
    await openPark(page, "grand canyon park", "grca", "Grand Canyon National Park");
    if (!liveKey) {
      await expect(page.locator("[data-status=hazard]")).toBeVisible();
      await expect(page.getByRole("heading", { name: "INNER CANYON TRAIL CLOSURES" })).toBeVisible();
    }
  });

  test("lists several Maine parks and parks near Philadelphia", async ({ page, context }) => {
    await page.goto("/");
    await page.getByLabel("Park name, state, or park code").fill("Maine");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("heading", { name: "Matching parks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Acadia National Park" })).toBeVisible();
    expect(await page.getByRole("link", { name: "View conditions" }).count()).toBeGreaterThan(1);

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 39.95169, longitude: -75.14942 });
    await page.goto("/");
    await page.getByRole("button", { name: "Near me" }).click();
    await expect(page.getByRole("heading", { name: "Parks near you" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Independence National Historical Park" })).toBeVisible();
  });

  test("reports directory health and documents the live sources", async ({ page, request }) => {
    const health = await request.get("/api/health");
    expect(health.ok()).toBe(true);
    const body = await health.json();
    expect(body.catalogParks).toBeGreaterThanOrEqual(400);
    if (liveKey) {
      expect(body).toMatchObject({ ok: true, mode: "live", nps: "configured" });
      expect(["boundary-service", "nps-api"]).toContain(body.directory);
    } else {
      expect(body.ok).toBe(true);
      expect(body.mode).toBe("live");
      expect(body.nps).toBe("public");
      expect(body.directory).toBe("boundary-service");
      expect(body.problems).toEqual([]);
    }

    const ready = await request.get("/api/ready");
    expect(ready.status()).toBe(200);

    const search = await request.get("/api/parks?q=independence%20park");
    expect(search.ok()).toBe(true);
    const parks = await search.json();
    expect(parks.parks[0].parkCode).toBe("inde");

    await page.goto("/sources");
    await expect(page.getByRole("heading", { name: "Park directory" })).toBeVisible();
    await expect(page.getByText("1,000 requests per hour")).toBeVisible();
    await expect(page.getByRole("link", { name: "OpenFreeMap" })).toBeVisible();
    await expect(page.getByRole("link", { name: "NPS API documentation" })).toBeVisible();
    await expect(page.getByText("this browser")).toBeVisible();
  });
});
