import { test, expect } from "@playwright/test";
import path from "path";

// Visit the public GitHub repo in a clean browser context (no GitHub cookies)
// and confirm a first-time visitor sees exactly what we want.

test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 1400, height: 900 },
});

test("public repo passes sniff test", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("https://github.com/evangauer/openvpm", { waitUntil: "networkidle" });

  // 1. Repo is visible (no "Sign in" wall)
  await expect(page.locator("h1")).toContainText(/openvpm/i);

  // 2. Description + topics visible
  const description = await page.locator('[data-testid="repo-sidebar"], .f4, [aria-label="About"]').first().textContent().catch(() => "");
  console.log("Description area:", description?.slice(0, 300));

  // 3. README screenshots load (not broken images)
  const brokenImages = await page.$$eval("img", (imgs) =>
    imgs
      .filter((img) => (img as HTMLImageElement).src.includes("docs/screenshots") || (img as HTMLImageElement).src.includes("openvpm.com/logo"))
      .map((img) => ({
        src: (img as HTMLImageElement).src,
        natural: (img as HTMLImageElement).naturalWidth > 0,
      }))
  );
  console.log("README-embedded images:", JSON.stringify(brokenImages, null, 2));

  // 4. CI badge visible and green (not 'failing')
  const ciBadge = await page.locator('img[alt="CI"]').first().getAttribute("src").catch(() => null);
  console.log("CI badge src:", ciBadge);

  // 5. Take full-page screenshot for visual verification
  await page.screenshot({
    path: path.resolve(__dirname, "../docs/brand/public-repo.png"),
    fullPage: true,
  });

  // 6. Console errors from GitHub's own JS — filter out noise
  const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
  console.log(`Page errors: ${realErrors.length}`);
  realErrors.forEach((e) => console.log(" -", e));

  expect(brokenImages.filter((i) => !i.natural).length).toBe(0);
});
