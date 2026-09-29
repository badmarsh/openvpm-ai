import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Cielené pregenerovanie 4 screenshotov podľa požiadaviek používateľa:
 * 1. 01-03-rychle-vyhladavanie-cmd-k.png - Rozvrh v zobrazení "Týždeň" + Cmd+K vyhľadávanie
 * 2. 01-04-whiteboard-ambulancie.png - Ordinančná tabuľa s aktívnymi demo pacientmi (Pupinka, Max, Luna, Bella, Charlie)
 * 3. 02-02-profil-pacienta.png - Reálny profil pacienta Pupinka (/patients/5821edf5-e13d-4085-85c4-be6b95b29c34)
 * 4. 02-03-soap-klinicky-zaznam.png - Vyhľadanie pacienta "Pupinka" v /records a zobrazenie jej SOAP záznamov
 *
 * Režim: Svetlý režim (Light Mode), 1920x1080
 * Používateľ: MVDr. Martin Sýkora (Administrátor)
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "../docs/screenshots/wiki");
const PUPINKA_ID = "5821edf5-e13d-4085-85c4-be6b95b29c34";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "light",
});

test.describe.configure({ mode: "serial" });

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
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await dismissOverlays(page);

  const emailInput = page.locator('input[type="email"], #email').first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.click();
  await emailInput.fill("martin.sykora@vetsykora.sk");

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
  await page.waitForTimeout(2500);
  await dismissOverlays(page);
  console.log("✓ Prihlásený ako MVDr. Martin Sýkora (Administrátor)");
}

test("Pregenerovanie 4 špecifických screenshotov v Light Mode (1920x1080)", async ({ page }) => {
  test.setTimeout(250000);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await setupLightModeAndConsent(page);
  await loginAsDrSykora(page);

  // ----------------------------------------------------
  // 1. 01-03-rychle-vyhladavanie-cmd-k.png
  // Požiadavka: "use Tyzden for Rozvrh" + Cmd+K vyhľadávanie
  // ----------------------------------------------------
  console.log("1. Generujem 01-03-rychle-vyhladavanie-cmd-k.png (Týždeň)...");
  await page.goto("/schedule", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);

  // Prepnúť rozvrh na "Týždeň"
  const weekButton = page.locator('button:has-text("Týždeň"), button:has-text("Week")').first();
  if (await weekButton.isVisible()) {
    await weekButton.click();
    await page.waitForTimeout(1500);
    console.log("✓ Prepnuté na zobrazenie 'Týždeň'");
  }

  // Otvoriť Cmd+K
  await page.keyboard.press("Control+K");
  await page.waitForTimeout(600);
  await page.keyboard.type("Pupinka");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "01-03-rychle-vyhladavanie-cmd-k.png") });
  console.log("✓ Uložené 01-03-rychle-vyhladavanie-cmd-k.png");

  // Zavrieť vyhľadávací dialóg
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  // ----------------------------------------------------
  // 2. 01-04-whiteboard-ambulancie.png
  // Požiadavka: Zobraziť pacientov na tabuli (aktívne demo dáta)
  // ----------------------------------------------------
  console.log("2. Generujem 01-04-whiteboard-ambulancie.png (s pacientmi)...");
  await page.goto("/whiteboard", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "01-04-whiteboard-ambulancie.png") });
  console.log("✓ Uložené 01-04-whiteboard-ambulancie.png");

  // ----------------------------------------------------
  // 3. 02-02-profil-pacienta.png
  // Požiadavka: Reálny profil pacienta Pupinka
  // ----------------------------------------------------
  console.log("3. Generujem 02-02-profil-pacienta.png (Pupinka)...");
  await page.goto(`/patients/${PUPINKA_ID}`, { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "02-02-profil-pacienta.png") });
  console.log("✓ Uložené 02-02-profil-pacienta.png");

  // ----------------------------------------------------
  // 4. 02-03-soap-klinicky-zaznam.png
  // Požiadavka: Vyhľadať pacienta "Pupinka" v /records a zobraziť jej SOAP záznamy
  // ----------------------------------------------------
  console.log("4. Generujem 02-03-soap-klinicky-zaznam.png (Pupinka SOAP)...");
  await page.goto("/records", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);

  const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="pacient"], input[placeholder*="Hľadať"]').first();
  await searchInput.waitFor({ state: "visible", timeout: 10000 });
  await searchInput.click();
  await searchInput.fill("Pupinka");
  await page.waitForTimeout(1000);

  // Kliknúť na nájdeného pacienta Pupinka v dropdown zozname
  const pupinkaOption = page.locator('button:has-text("Pupinka")').first();
  if (await pupinkaOption.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pupinkaOption.click();
    console.log("✓ Vybraný pacient Pupinka v /records");
    await page.waitForTimeout(2000);
  } else {
    console.warn("Dropdown možnosť pre Pupinka sa nezobrazila priamo, pokračujem s vyhľadávaním");
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "02-03-soap-klinicky-zaznam.png") });
  console.log("✓ Uložené 02-03-soap-klinicky-zaznam.png");

  console.log("\n==========================================");
  console.log("VŠETKY 4 POŽADOVANÉ SCREENSHOTY BOLI ÚSPEŠNE PREGENEROVANÉ!");
  console.log("==========================================\n");
});
