const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'light',
  });
  const p = await ctx.newPage();

  await p.addInitScript(() => {
    window.localStorage.setItem('openvpm_gui_mode', 'light');
    window.localStorage.setItem('theme', 'light');
    window.localStorage.setItem('openvpm.cookie-consent.v1', 'essential');
    window.sessionStorage.setItem('ovpm_verify_email_dismissed', '1');
  });

  // Login
  await p.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
  await p.locator('#email').fill('martin.sykora@vetsykora.sk');
  await p.locator('#password').fill('password123');
  await p.locator('button[type="submit"]').click();
  await p.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
  await p.waitForTimeout(2000);

  // Go to /schedule
  await p.goto('http://localhost:3001/schedule', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);

  // Dismiss overlays
  const dismissBtn = p.getByRole('button', { name: /essential only|hide for now|skryť zatiaľ/i }).first();
  if (await dismissBtn.isVisible().catch(() => false)) await dismissBtn.click();

  // Switch to Týždeň (Week) view
  const weekBtn = p.locator('button:has-text("Týždeň"), button:has-text("Week")').first();
  if (await weekBtn.isVisible()) {
    await weekBtn.click();
    await p.waitForTimeout(1500);
  }

  // Open search modal via TopBar button
  const searchBtn = p.locator('button[aria-label="Open search"]').first();
  console.log('Search button visible?', await searchBtn.isVisible());
  await searchBtn.click();
  await p.waitForTimeout(1000);

  // Type Pupinka into Command.Input
  const input = p.locator('input[placeholder*="Search patients"]').first();
  console.log('Command input visible?', await input.isVisible());
  if (await input.isVisible()) {
    await input.fill('Pupinka');
    await p.waitForTimeout(2000);
  }

  const out = path.resolve('docs/screenshots/wiki/01-03-rychle-vyhladavanie-cmd-k.png');
  await p.screenshot({ path: out });
  console.log('Saved 01-03 to:', out);

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
