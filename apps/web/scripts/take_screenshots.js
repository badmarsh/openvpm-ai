const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1050, height: 1200 },
    deviceScaleFactor: 2 // Crisp retina screenshots
  });

  const htmlPath = path.resolve('C:/Users/marek/.gemini/antigravity/brain/00928ee6-de81-4847-a4a6-106c29f05457/reports_preview.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  // 1. Screenshot Tab 1 (Osvedčenie Besnota)
  const tab1El = await page.$('#content-tab1');
  await tab1El.screenshot({ path: path.resolve(__dirname, 'screenshot_besnota.png') });
  console.log('Saved screenshot_besnota.png');

  // 2. Screenshot Tab 2 (Eutanázia)
  await page.evaluate(() => switchTab('tab2'));
  await page.waitForTimeout(300);
  const tab2El = await page.$('#content-tab2');
  await tab2El.screenshot({ path: path.resolve(__dirname, 'screenshot_eutanazia.png') });
  console.log('Saved screenshot_eutanazia.png');

  // 3. Screenshot Tab 3 (Hospitalizácia a anestézia)
  await page.evaluate(() => switchTab('tab3'));
  await page.waitForTimeout(300);
  const tab3El = await page.$('#content-tab3');
  await tab3El.screenshot({ path: path.resolve(__dirname, 'screenshot_anestezia.png') });
  console.log('Saved screenshot_anestezia.png');

  // 4. Screenshot Tab 4 (Kniha očkovania proti besnote - RVPS)
  await page.evaluate(() => switchTab('tab4'));
  await page.waitForTimeout(300);
  const tab4El = await page.$('#content-tab4');
  await tab4El.screenshot({ path: path.resolve(__dirname, 'screenshot_kniha_besnoty.png') });
  console.log('Saved screenshot_kniha_besnoty.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(console.error);
