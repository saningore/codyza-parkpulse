import { expect, test } from "@playwright/test";

test.describe("park pages and shell", () => {
  test("shows Yellowstone sections, official links, and the map", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Yellowstone National Park" }).click();
    await expect(page).toHaveURL(/\/parks\/yell$/);
    await expect(page.locator("[data-status=restricted]")).toContainText("Restricted");
    await expect(page.getByRole("heading", { name: "Beartooth Highway closed for the season" })).toBeVisible();
    await expect(page.getByText("The Beartooth Highway is closed. Other entrances remain open in this sample.")).toBeVisible();
    await expect(page.getByText("No road events were posted.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Madison Campground" })).toBeVisible();
    await expect(page.getByText("278 sites listed")).toBeVisible();
    await expect(page.getByText("Madison Campground: Closed for the season")).toBeVisible();
    await expect(page.getByText("Loop A is closed for water repairs in this sample record.")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Reservations" })).toHaveAttribute("href", /recreation\.gov/);
    await expect(page.getByText("46°F", { exact: true })).toBeVisible();
    await expect(page.getByText("near Yellowstone, WY")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Winter Storm Watch" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Albright Visitor Center" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Call (307) 344-2263" })).toHaveAttribute("href", "tel:+13073442263");
    await expect(page.getByRole("heading", { name: "Ranger talk at Old Faithful" })).toBeVisible();
    await expect(page.getByText("2:00 PM – 2:30 PM")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Watch a geyser basin" })).toBeVisible();
    await expect(page.getByText("Hiking · Wildlife Watching")).toBeVisible();
    await expect(page.getByText("Some sites and restrooms are listed as accessible in this sample.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Entrance - Private Vehicle" })).toBeVisible();
    await expect(page.getByText("$35.00")).toBeVisible();
    await expect(page.getByText("44.4280, -110.5885")).toBeVisible();
    await expect(page.getByText("Times use America/Denver.")).toBeVisible();
    await expect(page.getByText("Photos: Information unavailable")).toBeVisible();

    const official = page.getByRole("link", { name: "Official park page" });
    await expect(official).toHaveAttribute("href", /nps\.gov\/yell/);
    await expect(official).toHaveAttribute("target", "_blank");
    await expect(official).toHaveAttribute("rel", /noopener/);
    await expect(page.getByRole("link", { name: "Directions" }).first()).toHaveAttribute("href", /google\.com\/maps/);
    await expect(page.getByRole("link", { name: "Call (307) 344-7381" })).toHaveAttribute("href", "tel:+13073447381");
    await expect(page.getByRole("link", { name: "NPS directions page" })).toHaveAttribute("href", /directions\.htm/);
    await expect(page.locator("[data-map-ready='true']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Campground: Madison Campground" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Visitor center: Albright Visitor Center" })).toBeVisible();
  });

  test("opens Grand Canyon and accepts an uppercase park code", async ({ page }) => {
    await page.goto("/parks/grca");
    await expect(page.locator("[data-status=open]")).toContainText("Open today");
    await expect(page.getByText("No active alerts were posted for this park.")).toBeVisible();
    await expect(page.getByText("No active weather alerts for this point.")).toBeVisible();
    await expect(page.getByText("near Yellowstone, WY")).toBeVisible();

    const response = await page.goto("/parks/YOSE");
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Yosemite National Park" })).toBeVisible();
    await expect(page.locator("[data-status=open]")).toContainText("Open today");
  });

  test("shows a missing park page and walks the primary navigation", async ({ page }) => {
    const missing = await page.goto("/parks/nope");
    await expect(page.getByRole("heading", { name: "That park page is not available" })).toBeVisible();
    expect(missing?.status()).toBe(200);
    await page.getByRole("link", { name: "Search parks" }).click();
    await expect(page).toHaveURL(/\/$/);

    const short = await page.goto("/parks/abc");
    await expect(page.getByRole("heading", { name: "That park page is not available" })).toBeVisible();
    expect(short?.status()).toBe(200);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    await expect(page.getByText("Sample records are loaded for local checks.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to read the status" })).toBeVisible();
    await expect(page.getByText("ParkPulse does not guess open.")).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Sources" }).click();
    await expect(page.getByRole("heading", { name: "Where the conditions come from" })).toBeVisible();
    await expect(page.getByRole("link", { name: "NPS API documentation" })).toHaveAttribute("href", /developer\/api-documentation/);
    await expect(page.getByRole("link", { name: "NWS API documentation" })).toHaveAttribute("href", /weather\.gov/);

    await page.getByRole("link", { name: "About" }).click();
    await expect(page.getByRole("heading", { name: "About ParkPulse" })).toBeVisible();
    await expect(page.getByText("Saved parks stay in this browser.")).toBeVisible();

    await page.getByRole("link", { name: "Saved" }).click();
    await expect(page.getByRole("heading", { name: "Saved parks" })).toBeVisible();
    await expect(page.getByText("You have not saved any parks on this device.")).toBeVisible();

    await page.getByRole("link", { name: "Conditions", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Can I actually visit this park today?" })).toBeVisible();
  });

  test("searches from a phone-sized window", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByLabel("Park name, state, or park code").fill("zion");
    await page.getByRole("option", { name: /Zion National Park/ }).click();
    await expect(page).toHaveURL(/\/parks\/zion$/);
    await expect(page.locator("[data-status=open]")).toContainText("Open today");
    await expect(page.getByRole("button", { name: "Save park" })).toBeVisible();
  });

  test("exposes fixture health and baseline response headers", async ({ page, request }) => {
    const home = await page.goto("/");
    expect(home?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(home?.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(home?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(home?.headers()["permissions-policy"]).toContain("geolocation=(self)");

    const health = await request.get("/api/health", { headers: { "x-forwarded-for": "203.0.113.40" } });
    expect(health.ok()).toBe(true);
    expect(await health.json()).toMatchObject({ ok: true, mode: "fixtures", problems: [] });

    const search = await request.get("/api/parks?q=yell", { headers: { "x-forwarded-for": "203.0.113.41" } });
    expect(search.ok()).toBe(true);
    const body = await search.json();
    expect(body.parks[0].parkCode).toBe("yell");

    const outside = await request.get("/api/parks?lat=51.5&lon=-0.1", { headers: { "x-forwarded-for": "203.0.113.42" } });
    expect(outside.status()).toBe(400);
  });
});
