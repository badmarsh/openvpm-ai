import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://host.docker.internal:3001';
const EMAIL = 'martin.sykora@vetsykora.sk';
const PASS = 'password123';
const DIR = './docs/product-discovery/sim-screenshots';
const CHROME = '/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
fs.mkdirSync(DIR, { recursive: true });
const results = [];

function log(sim, status, notes) {
  results.push({ sim, status, notes });
  console.log('[' + status + '] ' + sim + ': ' + notes);
}
async function ss(page, name) {
  await page.screenshot({ path: DIR + '/' + name + '.png', fullPage: false });
}
async function checkPage(page, route, label) {
  await page.goto(BASE + route);
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await ss(page, label);
  const url = page.url();
  const is404 = await page.locator('text=/404|not found|nenajden/i').count() > 0;
  const isLogin = url.includes('/login');
  const redirectedTo = url.replace(BASE, '');
  return { url, is404, isLogin, redirectedTo };
}

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));

  try {
    // LOGIN
    await page.goto(BASE + '/login');
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await ss(page, '00-login');
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.count() === 0) {
      log('Login', 'FAIL', 'No email input at /login');
    } else {
      await emailInput.fill(EMAIL);
      await page.locator('input[type="password"]').first().fill(PASS);
      await ss(page, '00-login-filled');
      const navP = page.waitForNavigation({ timeout: 25000 }).catch(() => {});
      await page.locator('button[type="submit"]').first().click();
      await navP;
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await ss(page, '00-post-login');
      const url = page.url();
      if (url.includes('/login')) {
        const errEl = page.locator('[role="alert"]').first();
        const errMsg = await errEl.count() > 0 ? await errEl.textContent() : 'no error element';
        log('Login', 'FAIL', 'Still on login. ' + errMsg);
      } else {
        log('Login', 'PASS', 'Authenticated to ' + url);
      }
    }

    // J1: SEARCH Cmd+K
    await page.goto(BASE);
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await ss(page, '01-dashboard');
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1000);
    let searchOpen = await page.locator('[role="dialog"]').count() > 0;
    if (!searchOpen) { await page.keyboard.press('Meta+k'); await page.waitForTimeout(1000); searchOpen = await page.locator('[role="dialog"]').count() > 0; }
    await ss(page, '01-search-open');
    if (searchOpen) {
      const inp = page.locator('[role="dialog"] input').first();
      if (await inp.count() > 0) {
        await inp.fill('Rex');
        await page.waitForTimeout(1200);
        await ss(page, '01-search-rex');
        const n = await page.locator('[role="option"], [data-cmdk-item]').count();
        log('J1 Search Cmd+K', 'PASS', 'Rex results: ' + n);
      } else { log('J1 Search Cmd+K', 'PARTIAL', 'Dialog open, no input'); }
    } else { log('J1 Search Cmd+K', 'FAIL', 'Ctrl+K/Meta+K no dialog'); }
    await page.keyboard.press('Escape');

    // J2: PATIENT CARD
    let p = await checkPage(page, '/patients', '02-patients');
    if (p.isLogin) { log('J2 Patient Card', 'AUTH-FAIL', p.url); }
    else {
      const pLink = page.locator('a[href*="/patients/"]').first();
      if (await pLink.count() > 0) {
        await pLink.click();
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
        await ss(page, '02-patient-card');
        const hasHistory = await page.locator('text=/zaznam|record|SOAP|History/i').count() > 0;
        log('J2 Patient Card', 'PASS', 'Opened card. Records visible: ' + hasHistory);
      } else { log('J2 Patient Card', 'PARTIAL', 'No patient links on /patients'); }
    }

    // J3–J19 route checks
    const routes = [
      ['/records', '03-records', 'J3 Records/SOAP'],
      ['/agent/voice', '04-voice', 'J4 Voice Dictation'],
      ['/schedule', '07-schedule', 'J7 Schedule'],
      ['/whiteboard', '08-whiteboard', 'J8 Whiteboard'],
      ['/clients/new', '09-new-client', 'J9 New Client'],
      ['/pharmacy', '10-pharmacy', 'J10 Pharmacy'],
      ['/billing', '11-billing', 'J11 Billing'],
      ['/billing/ekasa', '12-ekasa', 'J12 e-Kasa'],
      ['/vaccinations', '13-vaccinations', 'J13 Vaccinations'],
      ['/recalls', '14-recalls', 'J14 Recalls'],
      ['/wellness', '15-wellness', 'J15 Wellness'],
      ['/lab-results', '16-lab', 'J16 Lab Results'],
      ['/agent/imaging', '17-imaging', 'J17 Imaging AI'],
      ['/marketing', '18-marketing', 'J18 Marketing Studio'],
      ['/marketing/reviews', '19-reviews', 'J19 Reviews'],
      ['/controlled-substances', 'cs', 'Controlled Substances'],
      ['/statutory', 'statutory', 'Statutory/KVEPIS'],
      ['/automations', 'automations', 'Automations CRM'],
    ];
    for (const [route, label, name] of routes) {
      p = await checkPage(page, route, label);
      const status = p.isLogin ? 'AUTH-FAIL' : (p.is404 ? 'GAP-404' : 'PASS');
      log(name, status, p.url);
    }

    // GAP ROUTES - expected to 404 or auth-redirect (interesting either way)
    const gapRoutes = [
      ['/hospitalization', 'gap-hospitalization', 'J20 Hospitalization'],
      ['/surgery', 'gap-surgery', 'J21 Surgery'],
      ['/triage', 'gap-triage', 'J22 Triage'],
      ['/telemedicine', 'gap-telemedicine', 'J23 Telemedicine'],
      ['/inventory', 'gap-inventory', 'J24 Inventory'],
      ['/reports', 'gap-reports', 'J25 Reports'],
    ];
    for (const [route, label, name] of gapRoutes) {
      p = await checkPage(page, route, label);
      const status = p.is404 ? 'GAP-404' : (p.isLogin ? 'AUTH-REDIRECT' : 'EXISTS-UNEXPECTEDLY');
      log(name, status, p.redirectedTo);
    }

    // CLIENT PORTAL
    p = await checkPage(page, '/portal', '27-portal');
    log('J27 Client Portal', p.is404 ? 'GAP-404' : 'PASS', p.url);
    p = await checkPage(page, '/book', '27-public-booking');
    log('J27 Public Booking', p.is404 ? 'GAP-404' : 'PASS', p.url);
    p = await checkPage(page, '/postop', 'postop');
    log('Postop Owner Page', p.is404 ? 'GAP-404' : 'PASS', p.url);

  } finally {
    const report = {
      runAt: new Date().toISOString(), baseUrl: BASE,
      consoleErrors: errs.slice(0,10), results,
      summary: {
        pass: results.filter(r=>r.status==='PASS').length,
        partial: results.filter(r=>r.status==='PARTIAL').length,
        fail: results.filter(r=>r.status==='FAIL').length,
        authFail: results.filter(r=>r.status==='AUTH-FAIL').length,
        gap404: results.filter(r=>r.status==='GAP-404').length,
        authRedirect: results.filter(r=>r.status==='AUTH-REDIRECT').length,
        total: results.length,
      }
    };
    fs.writeFileSync('./docs/product-discovery/simulation-report.json', JSON.stringify(report, null, 2));
    console.log('SUMMARY: ' + JSON.stringify(report.summary));
    await browser.close();
  }
}
run().catch(e => { console.error(e.message); process.exit(1); });
