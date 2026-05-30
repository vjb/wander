const { chromium } = require('playwright');
const path = require('path');

const ASSETS_DIR = 'C:\\Users\\vjbel\\hacks\\wander\\assets';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // STEP 1: Open landing page
  console.log('STEP 1: Opening http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ASSETS_DIR, '01-landing.png'), fullPage: true });
  console.log('Saved: 01-landing.png');

  // STEP 2: Fill in the form
  console.log('STEP 2: Filling in the form...');

  // Fill "Starting from" field
  const startField = page.locator('input[placeholder*="Starting"], input[placeholder*="starting"], input[placeholder*="Start"], input[placeholder*="From"], input[placeholder*="from"]').first();
  await startField.click();
  await startField.fill("Hell's Kitchen, NYC");
  await page.waitForTimeout(500);

  // Fill "Ending up at" field
  const endField = page.locator('input[placeholder*="Ending"], input[placeholder*="ending"], input[placeholder*="End"], input[placeholder*="To"], input[placeholder*="to"], input[placeholder*="Destination"]').first();
  await endField.click();
  await endField.fill('Flatiron District, NYC');
  await page.waitForTimeout(500);

  // Click the 'Green & Scenic' vibe button
  const vibeButton = page.locator('button:has-text("Green"), button:has-text("Scenic"), [role="button"]:has-text("Green")').first();
  try {
    await vibeButton.click({ timeout: 5000 });
    console.log('Clicked Green & Scenic vibe button');
  } catch (e) {
    console.log('Could not find Green & Scenic button by text, trying emoji approach...');
    // Try finding by emoji
    const emojiButton = page.locator('button:has-text("🌿")').first();
    try {
      await emojiButton.click({ timeout: 5000 });
      console.log('Clicked 🌿 button');
    } catch (e2) {
      console.log('Could not click vibe button:', e2.message);
    }
  }
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ASSETS_DIR, '02-form-filled.png'), fullPage: true });
  console.log('Saved: 02-form-filled.png');

  // STEP 3: Click "Begin wandering" button
  console.log('STEP 3: Clicking Begin wandering button...');
  const submitBtn = page.locator('button:has-text("Begin wandering"), button:has-text("Wander"), button:has-text("wandering"), button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ASSETS_DIR, '03-loading.png'), fullPage: true });
  console.log('Saved: 03-loading.png');

  // STEP 4: Wait for route to load (up to 30 seconds)
  console.log('STEP 4: Waiting for route to load...');
  try {
    // Wait for route content - look for numbered stops or route title
    await page.waitForSelector(
      'h1, h2, .route-title, [class*="route"], [class*="stop"], [class*="card"]',
      { timeout: 30000 }
    );
    // Additional wait to let everything render
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('Timeout waiting for route, taking screenshot anyway...');
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: path.join(ASSETS_DIR, '04-route.png'), fullPage: true });
  console.log('Saved: 04-route.png');

  // Get the route title
  let routeTitle = 'Unknown';
  try {
    const titleEl = await page.locator('h1, h2, [class*="title"], [class*="route-name"]').first();
    routeTitle = await titleEl.innerText();
    console.log('Route title:', routeTitle);
  } catch (e) {
    console.log('Could not get route title');
  }

  // STEP 5: Click an "Insider tip" button
  console.log('STEP 5: Looking for Insider tip button...');
  try {
    const insiderBtn = page.locator('button:has-text("Insider tip"), button:has-text("insider"), button:has-text("tip"), [class*="tip"]').first();
    await insiderBtn.scrollIntoViewIfNeeded();
    await insiderBtn.click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ASSETS_DIR, '05-insider-tip.png'), fullPage: true });
    console.log('Saved: 05-insider-tip.png');
  } catch (e) {
    console.log('Could not find/click Insider tip button:', e.message);
    // Take screenshot anyway
    await page.screenshot({ path: path.join(ASSETS_DIR, '05-insider-tip.png'), fullPage: true });
    console.log('Saved: 05-insider-tip.png (no tip expanded)');
  }

  await browser.close();

  console.log('\n=== SUMMARY ===');
  console.log('Route title found:', routeTitle);
  console.log('All screenshots saved to:', ASSETS_DIR);
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
