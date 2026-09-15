import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

/**
 * Automatizované zachytávanie screenshotov pre Používateľskú príručku OpenVPM AI.
 *
 * Režim: Svetlý režim (Light Mode)
 * Rozlíšenie: 1920x1080 (Full HD)
 * Používateľ: MVDr. Martin Sýkora, Administrátor (martin.sykora@vetsykora.sk)
 * Výstup: docs/screenshots/wiki/
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "../docs/screenshots/wiki");

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "light",
});

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  try {
    execSync("node scripts/clear-rate-limits.js", { stdio: "inherit" });
    execSync("node scripts/seed-today-whiteboard.js", { stdio: "inherit" });
  } catch (e) {
    console.warn("Could not reset DB state before tests:", e);
  }
});

async function setupLightModeAndConsent(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("openvpm_gui_mode", "light");
    window.localStorage.setItem("theme", "light");
    window.localStorage.setItem("openvpm.cookie-consent.v1", "essential");
    window.sessionStorage.setItem("ovpm_verify_email_dismissed", "1");
  });
}

async function dismissOverlays(page: Page) {
  await page.evaluate(() => {
    window.localStorage.setItem("openvpm_gui_mode", "light");
    window.localStorage.setItem("theme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  });

  const buttonsToDismiss = [
    page.getByRole("button", { name: /essential only|allow analytics|prijať iba nevyhnutné/i }),
    page.getByRole("button", { name: /hide for now|skryť zatiaľ|zatvoriť/i }),
    page.getByRole("button", { name: /rozumiem|dismiss|hotovo/i }),
  ];

  for (const btn of buttonsToDismiss) {
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click().catch(() => {});
    }
  }
}

async function loginAsDrSykora(page: Page) {
  if (!page.url().includes("/login")) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(1000);
  await dismissOverlays(page);

  const emailInput = page.locator('input[type="email"], #email').first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.click();
  await emailInput.fill("martin.sykora@vetsykora.sk");
  await emailInput.press("Tab");

  const passwordInput = page.locator("#password");
  if (await passwordInput.isVisible()) {
    await passwordInput.fill("password123");
  }

  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled({ timeout: 10000 });

  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 35000 }),
    submitButton.click(),
  ]);

  if (page.url().includes("/post-login")) {
    await page.waitForURL((url) => !url.pathname.includes("/post-login"), { timeout: 25000 }).catch(() => {});
  }
  await page.waitForTimeout(3000);
  await dismissOverlays(page);
  console.log("✓ Prihlásený ako MVDr. Martin Sýkora (Administrátor)");
}

test("Zachytenie screenshotov v Light Mode (1920x1080)", async ({ page }) => {
  test.setTimeout(500000);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await setupLightModeAndConsent(page);

  // 01-01: Prihlasovacia obrazovka (pred prihlásením, Light mode)
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "01-01-prihlasenie.png") });
  console.log("✓ 01-01-prihlasenie.png (Light Mode)");

  // Prihlásenie ako MVDr. Martin Sýkora (Administrátor)
  await loginAsDrSykora(page);

  // Pomocná funkcia pre navigáciu a snímku
  async function captureScreen(filename: string, route: string, customAction?: () => Promise<void>) {
    try {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45000 });
      await dismissOverlays(page);
      // Wait for data fetching/rendering
      await page.waitForTimeout(3000);

      if (customAction) {
        await customAction();
        await page.waitForTimeout(1200);
      }

      await page.screenshot({ path: path.join(OUT_DIR, filename) });
      console.log(`✓ ${filename} (${route}) [Light Mode]`);
    } catch (err: any) {
      console.error(`✗ Chyba pri ${filename}: ${err.message}`);
      await page.screenshot({ path: path.join(OUT_DIR, `ERR-${filename}`) }).catch(() => {});
    }
  }

  // 01. Začíname s OpenVPM AI
  await captureScreen("01-02-denny-harmonogram.png", "/schedule");

  // 01-03: Quick Search Cmd+K (Rozvrh: Týždeň + vyhľadanie Pupinka)
  await captureScreen("01-03-rychle-vyhladavanie-cmd-k.png", "/schedule", async () => {
    const weekButton = page.locator('button:has-text("Týždeň"), button:has-text("Week")').first();
    if (await weekButton.isVisible()) {
      await weekButton.click();
      await page.waitForTimeout(1000);
    }
    const searchBtn = page.locator('button[aria-label="Open search"]').first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await page.keyboard.press("Control+k");
    }
    await page.waitForTimeout(600);
    const cmdkInput = page.locator('input[placeholder*="Search patients"]').first();
    if (await cmdkInput.isVisible()) {
      await cmdkInput.fill("Pupinka");
    } else {
      await page.keyboard.type("Pupinka");
    }
    await page.waitForTimeout(1500);
  });
  await page.keyboard.press("Escape").catch(() => {});

  await captureScreen("01-04-whiteboard-ambulancie.png", "/whiteboard");

  // 02. Kartotéka a zdravotné záznamy
  await captureScreen("02-01-zoznam-pacientov.png", "/patients");
  await captureScreen("02-02-profil-pacienta.png", "/patients/5821edf5-e13d-4085-85c4-be6b95b29c34");
  await captureScreen("02-03-soap-klinicky-zaznam.png", "/records", async () => {
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="pacient"], input[placeholder*="Hľadať"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill("Pupinka");
      await page.waitForTimeout(1000);
      const pupinkaOption = page.locator('button:has-text("Pupinka")').first();
      if (await pupinkaOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await pupinkaOption.click();
        await page.waitForTimeout(1500);
      }
    }
  });
  await captureScreen("02-04-ockovania-preukaz.png", "/care-reminders");

  // 03. Fakturácia a e-Kasa
  await captureScreen("03-01-vystavenie-uctu.png", "/billing");
  await captureScreen("03-02-ekasa-prehlad.png", "/billing/ekasa");

  // 04. Sklad a lekáreň
  await captureScreen("04-01-skladove-zasoby.png", "/inventory");
  await captureScreen("04-02-kniha-opl-narkotika.png", "/controlled-substances");

  // 05. Legislatíva a štátne hlásenia
  await captureScreen("05-01-statne-registre-prehlad.png", "/statutory");

  // 06. Laboratórium a diagnostika
  await captureScreen("06-01-laboratorne-vysledky.png", "/lab-results");

  // 07. Tvorba webu kliniky
  await captureScreen("07-01-website-editor.png", "/marketing/website");

  // 08. Marketingové Štúdio a pripomienky
  await captureScreen("08-01-marketingove-kampane.png", "/marketing");

  // 10. Administrátorské nastavenia kliniky
  await captureScreen("10-01-sprava-personalu-roly.png", "/settings");

  // 11. Finančné a prevádzkové reporty
  await captureScreen("11-01-financny-dashboard.png", "/reports");

  // 14. Prirodzená komunikácia s AI asistentom
  await captureScreen("14-01-ai-sidebar-konzultacia.png", "/agent");

  console.log("\n==========================================");
  console.log("VŠETKY SCREENSHOTY BOLI ÚSPEŠNE VYGENEROVANÉ (LIGHT MODE)!");
  console.log(`Priečinok: ${OUT_DIR}`);
  console.log("==========================================\n");
});
