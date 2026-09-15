const { chromium } = require('@playwright/test');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, 'docs/screenshots/wiki');
const BASE_URL = 'http://localhost:3001';

async function captureLogin() {
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

  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  });
  await page.waitForTimeout(1000);

  const outPath = require('path').join(OUT_DIR, '01-01-prihlasenie.png');
  await page.screenshot({ path: outPath });
  console.log('Uložené: ' + outPath);
  await browser.close();
}

captureLogin().catch(e => { console.error(e); process.exit(1); });
