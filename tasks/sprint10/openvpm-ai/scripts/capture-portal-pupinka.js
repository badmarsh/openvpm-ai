const { chromium } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PUPINKA_ID = '5821edf5-e13d-4085-85c4-be6b95b29c34';
const OUT_FILE = path.resolve(__dirname, '../docs/screenshots/wiki/09-02-klientsky-portal-profil.png');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'light',
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.localStorage.setItem('openvpm_gui_mode', 'light');
    window.localStorage.setItem('theme', 'light');
    window.localStorage.setItem('openvpm.cookie-consent.v1', 'essential');
  });

  // Access portal with token
  console.log('Navigating to portal access...');
  await page.goto(`${BASE_URL}/portal/access/test-portal-token-sykora`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1000);

  // Click continue if prompt appears
  const continueBtn = page.locator('button:has-text("Continue securely"), button:has-text("Pokračovať")').first();
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await Promise.all([
      page.waitForURL(url => url.pathname.includes('/portal') && !url.pathname.includes('/access'), { timeout: 25000 }),
      continueBtn.click(),
    ]);
  }
  await page.waitForTimeout(2000);

  // Navigate to Pupinka profile
  console.log(`Navigating to /portal/pets/${PUPINKA_ID}...`);
  await page.goto(`${BASE_URL}/portal/pets/${PUPINKA_ID}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  // Dismiss any overlays/cookies
  const dismissBtns = [
    page.getByRole('button', { name: /essential only|allow analytics|prijať iba nevyhnutné/i }),
    page.getByRole('button', { name: /hide for now|skryť zatiaľ|zatvoriť/i }),
  ];
  for (const btn of dismissBtns) {
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click().catch(() => {});
    }
  }

  // Verify page text
  const bodyText = await page.locator('body').innerText();
  console.log('Page text snippet:\n' + bodyText.substring(0, 500));

  const hasTricat = bodyText.includes('Nobivac Tricat Trio');
  const hasRabies = bodyText.includes('Nobivac Rabies');
  console.log('Contains Tricat?', hasTricat);
  console.log('Contains Rabies?', hasRabies);

  await page.screenshot({ path: OUT_FILE });
  console.log('✓ Successfully saved 09-02-klientsky-portal-profil.png to:', OUT_FILE);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
