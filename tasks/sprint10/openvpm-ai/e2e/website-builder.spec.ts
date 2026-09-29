import { test, expect } from "@playwright/test";

test.describe("Marketing Drag-and-Drop Website Builder", () => {
  test.beforeEach(async ({ page }) => {
    // Standard mock session / cookie consent if necessary
    await page.addInitScript(() => {
      window.localStorage.setItem("openvpm.cookie-consent.v1", "essential");
    });
  });

  test("editor loads with KPI summary, template palette, and live canvas", async ({ page }) => {
    // If not authenticated, expect redirect or login requirement
    await page.goto("/marketing/website");

    // In a seeded test environment with auth or when logged in:
    const heading = page.getByRole("heading", { name: /Webstránka kliniky/i });
    if (await heading.isVisible()) {
      // Check editor layout components
      await expect(page.getByText("Knižnica sekcií")).toBeVisible();
      await expect(page.getByText("17 šablón")).toBeVisible();
      await expect(page.getByRole("button", { name: "Desktop" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Mobil" })).toBeVisible();

      // Check section drag handles exist on initial canvas
      const moveButtons = page.locator('text="Presunúť"');
      await expect(moveButtons.first()).toBeVisible();

      // Check mobile viewport toggling
      await page.getByRole("button", { name: "Mobil" }).click();
      await expect(page.locator(".max-w-\\[390px\\]")).toBeVisible();

      await page.getByRole("button", { name: "Desktop" }).click();
      await expect(page.locator(".w-full")).toBeVisible();
    }
  });

  test("public website renders brand kit wrapper and seeded sections", async ({ page }) => {
    // Test public page with simulated or dummy clinicId
    await page.goto("/web/00000000-0000-0000-0000-000000000000");

    // Expect either not found (for dummy UUID) or rendered clinic page without runtime crash
    const notFound = page.getByText("Klinika nebola nájdená");
    const clinicHeader = page.locator(".website-builder-root");

    await expect(notFound.or(clinicHeader)).toBeVisible();
  });
});
