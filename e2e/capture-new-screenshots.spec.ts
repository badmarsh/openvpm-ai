import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

/**
 * 23 nových screenshotov pre Používateľskú príručku OpenVPM AI.
 *
 * Režim: Svetlý režim (Light Mode)
 * Rozlíšenie: 1920x1080 (Full HD)
 * Používateľ: MVDr. Martin Sýkora, Administrátor (martin.sykora@vetsykora.sk)
 * Výstup: docs/screenshots/wiki/
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "../docs/screenshots/wiki");
const PUPINKA_ID = "5821edf5-e13d-4085-85c4-be6b95b29c34";
const CLIENT_ID = "31b42847-ed4b-4fd5-970b-fbc4b489fe3f";

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
    // Whiteboard must seed FIRST so lab results can link to the new appointment
    execSync("node scripts/seed-today-whiteboard.js", { stdio: "inherit" });
    execSync("node scripts/seed-pupinka-lab-results.js", { stdio: "inherit" });
    execSync("node scripts/seed-ekasa-receipts.js", { stdio: "inherit" });
    execSync("node scripts/seed-pupinka-vitals.js", { stdio: "inherit" });
    execSync("node scripts/seed-pupinka-wellness.js", { stdio: "inherit" });
    execSync("node scripts/setup-portal-token.js", { stdio: "inherit" });
    execSync("node scripts/seed-pupinka-vaccinations.js", { stdio: "inherit" });
  } catch (e) {
    console.warn("Seed warning:", e);
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
  await page.waitForTimeout(3000);
  await dismissOverlays(page);
  console.log("✓ Prihlásený ako MVDr. Martin Sýkora (Administrátor)");
}

async function safeScreenshot(page: Page, filename: string, label: string) {
  try {
    await page.screenshot({ path: path.join(OUT_DIR, filename), timeout: 10000 });
    console.log(`✓ ${label} → ${filename}`);
  } catch (e) {
    console.warn(`⚠ ${label} — screenshot zlyhal, ukladám ERR-${filename}`);
    await page.screenshot({ path: path.join(OUT_DIR, `ERR-${filename}`), timeout: 10000 }).catch(() => {});
  }
}

test("Generovanie 23 nových screenshotov v Light Mode (1920x1080)", async ({ browser }) => {
  test.setTimeout(600000);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ═══════════════════════════════════════════════════════
  // ADMIN SESSION
  // ═══════════════════════════════════════════════════════
  const adminContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1920, height: 1080 },
    colorScheme: "light",
  });
  const page = await adminContext.newPage();
  await setupLightModeAndConsent(page);
  await loginAsDrSykora(page);

  // ─── SKUPINA A: Fakturácia a e-Kasa (Kapitola 3) ───

  // A1: 03-03-nova-faktura-tvorba.png
  console.log("1/23 — Nová faktúra tvorba...");
  await page.goto("/billing/new", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  await safeScreenshot(page, "03-03-nova-faktura-tvorba.png", "Nová faktúra");

  // A2: 03-04-ekasa-hotovostny-blok.png
  console.log("2/23 — e-Kasa hotovostný blok...");
  await page.goto("/billing/ekasa", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  try {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Nemohol som kliknúť na prvý riadok bločku");
  }
  await safeScreenshot(page, "03-04-ekasa-hotovostny-blok.png", "e-Kasa blok");

  // A3: 03-05-ekasa-denna-uzavierka.png
  console.log("3/23 — e-Kasa denná uzávierka...");
  await page.goto("/billing/ekasa", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  try {
    const closuresTab = page.locator('button:has-text("Uzávierky"), button:has-text("Closures"), [value="closures"]').first();
    if (await closuresTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closuresTab.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Tab Uzávierky nenájdený");
  }
  await safeScreenshot(page, "03-05-ekasa-denna-uzavierka.png", "e-Kasa uzávierka");

  // ─── SKUPINA B: Kartotéka a záznamy (Kapitola 2) ───

  // B1: 02-06-dialog-pridania-ockovania.png
  console.log("4/23 — Dialóg pridania očkovania...");
  await page.goto("/records", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  try {
    // Najprv vyber záložku Vakcinácie
    const vaccTab = page.locator('button:has-text("Vakcinácie"), button:has-text("Vaccinations"), [value="vaccinations"]').first();
    if (await vaccTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await vaccTab.click();
      await page.waitForTimeout(1000);
    }
    // Tlačidlo pridania očkovania má text "Pridať vakcináciu"
    const addVaccBtn = page.locator('button:has-text("Pridať vakcináciu"), button:has-text("Add Vaccination")').first();
    if (await addVaccBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addVaccBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Dialóg očkovania sa nepodarilo otvoriť");
  }
  await safeScreenshot(page, "02-06-dialog-pridania-ockovania.png", "Dialóg očkovania");

  // B2: 02-07-vahovy-graf-pupinka.png
  console.log("5/23 — Váhový graf Pupinka...");
  await page.goto(`/patients/${PUPINKA_ID}`, { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  try {
    const vitalsTab = page.locator('button:has-text("Diagnostics & Vitals"), button:has-text("Diagnostika &"), [value="diagnostics"]').first();
    if (await vitalsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await vitalsTab.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.warn("  ⚠ Záložka Vitals nenájdená");
  }
  await safeScreenshot(page, "02-07-vahovy-graf-pupinka.png", "Váhový graf");

  // B3: 02-08-finalizacia-podpis-zaznamu.png
  console.log("6/23 — Finalizácia/podpis záznamu...");
  await page.goto(`/patients/${PUPINKA_ID}`, { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  try {
    // Hľadaj SOAP/záznamy sekciu
    const recordsTab = page.locator('button:has-text("Klinická história"), button:has-text("Medical Records"), button:has-text("SOAP"), [value="history"]').first();
    if (await recordsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await recordsTab.click();
      await page.waitForTimeout(1500);
    }
    // Hľadaj finalizáciu
    const finalizeBtn = page.locator('button:has-text("Finalizovať"), button:has-text("Finalize"), button:has-text("Podpísať"), button:has-text("Sign")').first();
    if (await finalizeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await finalizeBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Finalizácia záznamu nenájdená");
  }
  await safeScreenshot(page, "02-08-finalizacia-podpis-zaznamu.png", "Finalizácia záznamu");

  // ─── SKUPINA C: OPL a sklad (Kapitola 4) ───

  // C1: 04-03-opl-dialog-zaznam-podania.png
  console.log("7/23 — OPL dialóg záznamu podania...");
  await page.goto("/controlled-substances", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  try {
    // Presný text tlačidla: "Log Entry" (translation key: controlledSubstances.logEntry)
    const logBtn = page.locator('button:has-text("Log Entry"), button:has-text("Zaznamenať")').first();
    if (await logBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Tlačidlo pre záznam OPL nenájdené");
  }
  await safeScreenshot(page, "04-03-opl-dialog-zaznam-podania.png", "OPL záznam");

  // C2: 04-04-prijem-tovaru-form.png
  console.log("8/23 — Príjem tovaru formulár...");
  await page.goto("/inventory", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  try {
    // Presný text: "Import dodacieho listu" (translation key: inventory.page.btnImportWholesaler)
    const importBtn = page.locator('button:has-text("Import dodacieho listu"), button:has-text("Import")').first();
    if (await importBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await importBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Tlačidlo príjmu tovaru nenájdené — screenshot skladu ako je");
  }
  await safeScreenshot(page, "04-04-prijem-tovaru-form.png", "Príjem tovaru");

  // ─── SKUPINA D: Legislatíva (Kapitola 5) ───

  // D1: 05-03-kvepis-prehlad.png
  console.log("9/23 — KVEPIS prehľad...");
  await page.goto("/statutory", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  try {
    const kvepisTab = page.locator('button:has-text("KVEPIS"), [value="kvepis"]').first();
    if (await kvepisTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kvepisTab.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.warn("  ⚠ KVEPIS tab nenájdený");
  }
  await safeScreenshot(page, "05-03-kvepis-prehlad.png", "KVEPIS");

  // D2: 05-04-ochranne-lehoty-potraviny.png
  console.log("10/23 — Ochranné lehoty...");
  await page.goto("/statutory", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  try {
    const withdrawalsTab = page.locator('button:has-text("Ochranné lehoty"), button:has-text("Withdrawals"), [value="withdrawals"]').first();
    if (await withdrawalsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await withdrawalsTab.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Tab Ochranné lehoty nenájdený");
  }
  await safeScreenshot(page, "05-04-ochranne-lehoty-potraviny.png", "Ochranné lehoty");

  // D3: 05-05-informovany-suhlas-dialog.png
  console.log("11/23 — Informovaný súhlas...");
  await page.goto("/statutory", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  try {
    const protocolsTab = page.locator('button:has-text("Protokoly"), button:has-text("Protocols"), [value="protocols"]').first();
    if (await protocolsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await protocolsTab.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Tab Protokoly nenájdený");
  }
  await safeScreenshot(page, "05-05-informovany-suhlas-dialog.png", "Informovaný súhlas");

  // ─── SKUPINA E: Rozvrh (Kapitola 1) ───

  // E1: 01-07-nova-rezervacia-dialog.png
  console.log("12/23 — Nová rezervácia dialóg...");
  await page.goto("/schedule", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  try {
    // Presný text tlačidla: "New Appointment" (translation key: schedule.btnNewAppointment)
    const newApptBtn = page.locator('button:has-text("New Appointment"), button:has-text("Nová objednávka")').first();
    if (await newApptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newApptBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Tlačidlo novej rezervácie nenájdené");
  }
  await safeScreenshot(page, "01-07-nova-rezervacia-dialog.png", "Nová rezervácia");

  // ─── SKUPINA F: Lab výsledky a diagnostika (Kapitola 6) ───

  // F1: 06-02-abnormalny-laboratorny-vysledok.png
  console.log("13/23 — Abnormálny laboratórny výsledok...");
  await page.goto("/lab-results", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  await safeScreenshot(page, "06-02-abnormalny-laboratorny-vysledok.png", "Lab výsledky");

  // F2: 06-03-ai-analyza-rtg-snimky.png
  console.log("14/23 — AI analýza RTG snímky...");
  await page.goto("/agent/imaging", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  await safeScreenshot(page, "06-03-ai-analyza-rtg-snimky.png", "AI RTG");

  // ─── SKUPINA G: Marketing (Kapitola 8 + 12) ───

  // G1: 08-02-customer-journeys-automacie.png
  console.log("15/23 — Customer Journeys automatizácie...");
  await page.goto("/marketing/automations", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  try {
    const journeysTab = page.locator('button:has-text("Journeys"), button:has-text("Cesty klientov"), [value="journeys"]').first();
    if (await journeysTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await journeysTab.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Tab Journeys nenájdený");
  }
  await safeScreenshot(page, "08-02-customer-journeys-automacie.png", "Customer Journeys");

  // G2: 08-03-tv-cakarena-prezentacia.png
  console.log("16/23 — TV čakáreň prezentácia...");
  await page.goto("/waiting-room", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  await safeScreenshot(page, "08-03-tv-cakarena-prezentacia.png", "TV čakáreň");

  // G3: 12-02-registracia-do-wellness-planu.png
  console.log("17/23 — Registrácia do wellness plánu...");
  await page.goto("/marketing/wellness", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  await safeScreenshot(page, "12-02-registracia-do-wellness-planu.png", "Wellness plán");

  // ─── SKUPINA H: Nastavenia (Kapitola 10) ───

  // H1: 10-02-ekasa-konfiguracia-nastavenia.png
  console.log("18/23 — e-Kasa konfigurácia...");
  await page.goto("/settings/ekasa", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  await safeScreenshot(page, "10-02-ekasa-konfiguracia-nastavenia.png", "e-Kasa nastavenia");

  // H2: 10-03-sablony-dokumentov.png
  console.log("19/23 — Šablóny dokumentov...");
  await page.goto("/settings?tab=templates", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  // Záložný pokus — klik na tab ak URL params nefungujú
  try {
    // Presný text záložky: "Templates" (translation key: settings.tabs.templates)
    const templatesTab = page.locator('button:has-text("Templates"), button:has-text("Šablóny")').first();
    if (await templatesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templatesTab.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    // ignoruj
  }
  await safeScreenshot(page, "10-03-sablony-dokumentov.png", "Šablóny dokumentov");

  // ─── SKUPINA I: Reporty (Kapitola 11) ───

  // I1: 11-02-legislativny-report-svps.png
  console.log("20/23 — Legislatívny report ŠVPS...");
  await page.goto("/reports", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  await safeScreenshot(page, "11-02-legislativny-report-svps.png", "Reporty");

  // ─── SKUPINA J: AI Agent (Kapitola 14) ───

  // J1: 14-02-ai-agent-schvalenie-akcie.png
  console.log("21/23 — AI agent schválenie akcie...");
  await page.goto("/agent", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  try {
    // Skús nájsť approval UI
    const approveEl = page.locator('button:has-text("Schváliť"), button:has-text("Approve"), button:has-text("Potvrdiť akciu")').first();
    if (await approveEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveEl.click();
      await page.waitForTimeout(1500);
    } else {
      // Napíš správu do AI chatu
      const chatInput = page.locator('textarea, input[type="text"]').last();
      if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chatInput.click();
        await chatInput.fill("Aká je dávka amoxicilínu pre mačku 4kg?");
        const sendBtn = page.locator('button:has-text("Send"), button:has-text("Odoslať"), button[aria-label*="send" i], button[aria-label*="Send"]').first();
        if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sendBtn.click();
        } else {
          await chatInput.press("Enter");
        }
        await page.waitForTimeout(5000);
      }
    }
  } catch (e) {
    console.warn("  ⚠ AI agent UI nenájdené");
  }
  await safeScreenshot(page, "14-02-ai-agent-schvalenie-akcie.png", "AI Agent");

  // ─── SKUPINA K: Website Builder a portál (Kapitola 7) ───

  // K1: 07-02-website-builder-mobilny-nahled.png
  console.log("22/23 — Website builder mobilný náhľad...");
  await page.goto("/marketing/website", { waitUntil: "domcontentloaded", timeout: 35000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  try {
    const mobileBtn = page.locator('button:has-text("Mobile"), button[aria-label*="mobile" i], button[title*="mobile" i], button[title*="Mobil"]').first();
    if (await mobileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mobileBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Prepínač mobilného náhľadu nenájdený");
  }
  await safeScreenshot(page, "07-02-website-builder-mobilny-nahled.png", "Website builder");

  await adminContext.close();

  // ═══════════════════════════════════════════════════════
  // PORTÁL SESSION (samostatný browser context)
  // ═══════════════════════════════════════════════════════

  // K2: 09-04-portal-triage-akutny-stav.png
  console.log("23/23 — Portál triage akútny stav...");
  const portalContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1920, height: 1080 },
    colorScheme: "light",
  });
  const portalPage = await portalContext.newPage();
  await setupLightModeAndConsent(portalPage);

  try {
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

    // Hľadaj triage / emergency
    const triageBtn = portalPage.locator('button:has-text("Triage"), button:has-text("Akútny stav"), button:has-text("Emergency")').first();
    if (await triageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await triageBtn.click();
      await portalPage.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("  ⚠ Portál triage — fallback na dashboard");
  }
  try {
    await portalPage.screenshot({ path: path.join(OUT_DIR, "09-04-portal-triage-akutny-stav.png"), timeout: 10000 });
    console.log("✓ Portál triage → 09-04-portal-triage-akutny-stav.png");
  } catch (e) {
    console.warn("⚠ Portál screenshot zlyhal");
    await portalPage.screenshot({ path: path.join(OUT_DIR, "ERR-09-04-portal-triage-akutny-stav.png"), timeout: 10000 }).catch(() => {});
  }

  await portalContext.close();

  // ═══════════════════════════════════════════════════════
  // ZHRNUTIE
  // ═══════════════════════════════════════════════════════
  const captured = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png") && !f.startsWith("ERR-"));
  const errors = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith("ERR-"));
  console.log(`\n==========================================`);
  console.log(`SCREENSHOTOV ZACHYTENÝCH: ${captured.length}`);
  if (errors.length > 0) {
    console.log(`CHYBOVÝCH: ${errors.length} (${errors.join(", ")})`);
  }
  console.log(`==========================================\n`);
});
