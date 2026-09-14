import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Rozšírené generovanie screenshotov pre všetky chýbajúce kapitoly a sekcie:
 * - 01-05-cakaren-ambulancie.png (/waiting-room)
 * - 01-06-inbox-notifikacie.png (/inbox)
 * - 02-05-profil-klienta.png (/clients/31b42847-ed4b-4fd5-970b-fbc4b489fe3f)
 * - 05-02-kniha-besnoty.png (/statutory -> Kniha besnoty)
 * - 12-01-wellness-plany-prehlad.png (/marketing/wellness)
 * - 13-01-sprava-dat-exporty.png (/settings?tab=data)
 * - 15-01-ical-subscribe-dialog.png (/schedule -> popover "Add to your calendar")
 * - 09-01-klientsky-portal-prehlad.png (/portal)
 * - 09-02-klientsky-portal-profil.png (/portal/pets/5821edf5-e13d-4085-85c4-be6b95b29c34)
 * - 09-03-klientsky-portal-objednavanie.png (/portal/book)
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "../docs/screenshots/wiki");
const CLIENT_ID = "31b42847-ed4b-4fd5-970b-fbc4b489fe3f";
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
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
  console.log("✓ Prihlásený ako MVDr. Martin Sýkora (Administrátor)");
}

test("Generovanie 10 dodatočných screenshotov v Light Mode (1920x1080)", async ({ browser }) => {
  test.setTimeout(300000);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const adminContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1920, height: 1080 },
    colorScheme: "light",
  });
  const page = await adminContext.newPage();
  await setupLightModeAndConsent(page);
  await loginAsDrSykora(page);

  // 1. Čakáreň ambulancie
  console.log("1. Generujem 01-05-cakaren-ambulancie.png (/waiting-room)...");
  await page.goto("/waiting-room", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "01-05-cakaren-ambulancie.png") });
  console.log("✓ Uložené 01-05-cakaren-ambulancie.png");

  // 2. Interná pošta / notifikácie
  console.log("2. Generujem 01-06-inbox-notifikacie.png (/inbox)...");
  await page.goto("/inbox", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "01-06-inbox-notifikacie.png") });
  console.log("✓ Uložené 01-06-inbox-notifikacie.png");

  // 3. Karta majiteľa / profil klienta
  console.log(`3. Generujem 02-05-profil-klienta.png (/clients/${CLIENT_ID})...`);
  await page.goto(`/clients/${CLIENT_ID}`, { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "02-05-profil-klienta.png") });
  console.log("✓ Uložené 02-05-profil-klienta.png");

  // 4. Kniha besnoty (/statutory)
  console.log("4. Generujem 05-02-kniha-besnoty.png (/statutory)...");
  await page.goto("/statutory", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(1500);

  const rabiesTab = page.locator('button:has-text("Kniha besnoty"), button:has-text("Besnota"), [value="rabies"]').first();
  if (await rabiesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await rabiesTab.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "05-02-kniha-besnoty.png") });
  console.log("✓ Uložené 05-02-kniha-besnoty.png");

  // 5. Wellness plány a programy (/marketing/wellness)
  console.log("5. Generujem 12-01-wellness-plany-prehlad.png (/marketing/wellness)...");
  await page.goto("/marketing/wellness", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "12-01-wellness-plany-prehlad.png") });
  console.log("✓ Uložené 12-01-wellness-plany-prehlad.png");

  // 6. Správa dát, exporty a zálohy (/settings?tab=data)
  console.log("6. Generujem 13-01-sprava-dat-exporty.png (/settings?tab=data)...");
  await page.goto("/settings?tab=data", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "13-01-sprava-dat-exporty.png") });
  console.log("✓ Uložené 13-01-sprava-dat-exporty.png");

  // 7. iCal Subscribe dialóg (/schedule)
  console.log("7. Generujem 15-01-ical-subscribe-dialog.png (/schedule)...");
  await page.goto("/schedule", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);

  const subscribeBtn = page.locator('[data-tour="calendar-subscribe"], button:has-text("Add to your calendar"), button:has-text("Odoberať")').first();
  if (await subscribeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await subscribeBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "15-01-ical-subscribe-dialog.png") });
  console.log("✓ Uložené 15-01-ical-subscribe-dialog.png");

  await adminContext.close();

  // ----------------------------------------------------
  // Klientsky portál (PWA) v samostatnom klientskom kontexte
  // ----------------------------------------------------
  console.log("\nOtváram reláciu klientskeho portálu pre majiteľa Pupinky...");
  const portalContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1920, height: 1080 },
    colorScheme: "light",
  });
  const portalPage = await portalContext.newPage();
  await setupLightModeAndConsent(portalPage);

  // 8. Klientsky portál - Magic link exchange & prehľad (/portal)
  console.log("8. Generujem 09-01-klientsky-portal-prehlad.png (/portal)...");
  await portalPage.goto("/portal/access/test-portal-token-sykora", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(portalPage);
  await portalPage.waitForTimeout(1000);

  const continueBtn = portalPage.locator('button:has-text("Continue securely"), button:has-text("Pokračovať")').first();
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await Promise.all([
      portalPage.waitForURL((url) => url.pathname.includes("/portal") && !url.pathname.includes("/access"), { timeout: 25000 }),
      continueBtn.click(),
    ]);
  }
  await dismissOverlays(portalPage);
  await portalPage.waitForTimeout(2500);
  await portalPage.screenshot({ path: path.join(OUT_DIR, "09-01-klientsky-portal-prehlad.png") });
  console.log("✓ Uložené 09-01-klientsky-portal-prehlad.png");

  // 9. Klientsky portál - Profil zvieratka (Pupinka)
  console.log(`9. Generujem 09-02-klientsky-portal-profil.png (/portal/pets/${PUPINKA_ID})...`);
  await portalPage.goto(`/portal/pets/${PUPINKA_ID}`, { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(portalPage);
  await portalPage.waitForTimeout(2500);
  await portalPage.screenshot({ path: path.join(OUT_DIR, "09-02-klientsky-portal-profil.png") });
  console.log("✓ Uložené 09-02-klientsky-portal-profil.png");

  // 10. Klientsky portál - Online rezervácia termínu (/portal/book)
  console.log("10. Generujem 09-03-klientsky-portal-objednavanie.png (/portal/book)...");
  await portalPage.goto("/portal/book", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(portalPage);
  await portalPage.waitForTimeout(2500);
  await portalPage.screenshot({ path: path.join(OUT_DIR, "09-03-klientsky-portal-objednavanie.png") });
  console.log("✓ Uložené 09-03-klientsky-portal-objednavanie.png");

  await portalContext.close();

  console.log("\n==========================================");
  console.log("VŠETKÝCH 10 NOVÝCH SCREENSHOTOV BOLO ÚSPEŠNE VYGENEROVANÝCH!");
  console.log("==========================================\n");
});
