import { expect, test } from "@playwright/test";

test.describe("ParkPulse visit answer", () => {
  test("searches Yellowstone and shows today's conditions", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Can I actually visit this park today?" })).toBeVisible();
    await expect(page.getByText("Sample records are loaded for local checks.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toHaveAttribute("href", "https://codyza.com");

    await page.getByLabel("Park name, state, or park code").fill("Yellowstone");
    await page.getByRole("option", { name: /Yellowstone National Park/ }).click();
    await expect(page).toHaveURL(/\/parks\/yell$/);
    await expect(page.locator("[data-status=restricted]")).toContainText("Restricted");
    await expect(page.getByText("4 active alerts")).toBeVisible();
    await expect(page.getByText("2 campground notices")).toBeVisible();
    await expect(page.getByText("Beartooth Highway closed for the season")).toBeVisible();
    await expect(page.getByText("The Beartooth Highway is closed. Other entrances remain open in this sample.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ranger talk at Old Faithful" })).toBeVisible();
    await expect(page.getByText("46°F", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Winter Storm Watch" })).toBeVisible();
    await expect(page.getByText("Forecast for the park's published coordinates")).toBeVisible();
    await expect(page.locator("[data-map-ready='true']")).toBeVisible();
    await expect(page.getByRole("link", { name: "Official park page" })).toHaveAttribute("href", /nps\.gov/);
    await expect(page.getByRole("link", { name: "Codyza" })).toHaveAttribute("href", "https://codyza.com");

    await page.getByRole("button", { name: "Save park" }).click();
    await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
    await page.getByRole("link", { name: "Saved" }).click();
    await expect(page.getByRole("heading", { name: "Yellowstone National Park" })).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("You have not saved any parks on this device.")).toBeVisible();
  });

  test("explains sources and rejects an unknown park code", async ({ page }) => {
    await page.goto("/sources");
    await expect(page.getByRole("heading", { name: "Where the conditions come from" })).toBeVisible();
    await expect(page.getByRole("link", { name: "NPS API documentation" })).toHaveAttribute("href", /nps\.gov/);
    await expect(page.getByRole("link", { name: "NWS API documentation" })).toHaveAttribute("href", /weather\.gov/);
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();

    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About ParkPulse" })).toBeVisible();
    await expect(page.getByText("Unconfirmed")).toBeVisible();

    await page.goto("/parks/zzzz");
    await expect(page.getByRole("heading", { name: "That park page is not available" })).toBeVisible();
  });
});
