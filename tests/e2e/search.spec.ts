import { expect, test } from "@playwright/test";

test.describe("search", () => {
  test("redirects a single state match, shows several matches, and saves one from the list", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Park name, state, or park code").fill("Maine");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/parks\/acad$/);
    await expect(page.locator("[data-status=caution]")).toContainText("Caution");

    await page.goto("/");
    await page.getByLabel("Park name, state, or park code").fill("park");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("heading", { name: "Matching parks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View conditions" })).toHaveCount(5);

    const filter = page.getByRole("button", { name: "National Parks only" });
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "View conditions" })).toHaveCount(5);
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "false");

    const acadia = page.locator("li").filter({ has: page.getByRole("heading", { name: "Acadia National Park" }) });
    await acadia.getByRole("button", { name: "Save park" }).click();
    await expect(acadia.getByRole("button", { name: "Saved on this device" })).toBeVisible();
    await page.getByRole("link", { name: "Saved" }).click();
    await expect(page.getByRole("heading", { name: "Acadia National Park" })).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("You have not saved any parks on this device.")).toBeVisible();
  });

  test("opens a suggestion from the keyboard and closes it with Escape", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("combobox", { name: "Park name, state, or park code" });
    await box.fill("park");
    await expect(page.getByRole("option", { name: /Acadia National Park/ })).toBeVisible();
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await box.press("Escape");
    await expect(page.getByRole("option", { name: /Acadia National Park/ })).toBeHidden();

    await box.fill("");
    await box.fill("park");
    await expect(page.getByRole("option").first()).toContainText("Acadia National Park");
    await box.press("ArrowDown");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/parks\/acad$/);
  });

  test("explains a short query and an unknown name", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Park name, state, or park code").fill("q");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("Enter at least two letters of a park name, state, or park code.");

    await page.getByLabel("Park name, state, or park code").fill("zz");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("heading", { name: "Matching parks" })).toBeVisible();
    await expect(page.getByText("No matching park sites were found.")).toBeVisible();
  });

  test("lists parks near a granted location", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 44.428, longitude: -110.5885 });
    await page.goto("/");
    await page.getByRole("button", { name: "Near me" }).click();
    await expect(page.getByRole("heading", { name: "Parks near you" })).toBeVisible();
    await expect(page.getByRole("list").getByRole("link", { name: "Yellowstone National Park" })).toBeVisible();
    await expect(page.getByText("0.0 mi")).toBeVisible();
  });

  test("rejects a location outside the United States", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
    await page.goto("/");
    await page.getByRole("button", { name: "Near me" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("outside the searchable area");
  });

  test("explains a denied location request", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (_success: unknown, error?: (failure: { code: number; message: string }) => void) => {
            error?.({ code: 1, message: "denied" });
          },
        },
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Near me" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("Location permission was not granted. Search by park name instead.");
  });
});
