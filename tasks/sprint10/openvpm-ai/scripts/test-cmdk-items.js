const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'light' });
  const p = await ctx.newPage();

  await p.addInitScript(() => {
    window.localStorage.setItem('openvpm_gui_mode', 'light');
    window.localStorage.setItem('theme', 'light');
    window.localStorage.setItem('openvpm.cookie-consent.v1', 'essential');
    window.sessionStorage.setItem('ovpm_verify_email_dismissed', '1');
  });

  await p.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
  await p.locator('#email').fill('martin.sykora@vetsykora.sk');
  await p.locator('#password').fill('password123');
  await p.locator('button[type="submit"]').click();
  await p.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
  await p.waitForTimeout(1500);

  await p.goto('http://localhost:3001/schedule', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);

  const searchBtn = p.locator('button[aria-label="Open search"]').first();
  await searchBtn.click();
  await p.waitForTimeout(1000);

  const input = p.locator('input[placeholder*="Search patients"]').first();
  await input.fill('Pupinka');
  await p.waitForTimeout(2000);

  const items = await p.locator('[cmdk-item]').allInnerTexts();
  console.log('CmdK Items found:', items);
  const groups = await p.locator('[cmdk-group-heading]').allInnerTexts();
  console.log('CmdK Groups:', groups);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
