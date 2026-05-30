import { chromium } from 'playwright';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

const ASSETS_DIR = 'C:\\Users\\vjbel\\hacks\\wander\\assets';
const BASE_URL = 'http://localhost:3000';

if (!existsSync(ASSETS_DIR)) {
  mkdirSync(ASSETS_DIR, { recursive: true });
}

function fileSize(path) {
  try { return statSync(path).size; } catch { return 0; }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const results = [];

try {
  // ── SCREENSHOT 1: Landing screen ──────────────────────────────────────────
  console.log('📸 Screenshot 1: Landing screen...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  const s1 = join(ASSETS_DIR, '01-landing.png');
  await page.screenshot({ path: s1, fullPage: true });
  results.push({ file: s1, size: fileSize(s1), desc: 'Landing screen (dark background, serif headline)' });
  console.log(`  ✅ Saved ${s1} (${fileSize(s1)} bytes)`);

  // ── SCREENSHOT 2: Form filled in ──────────────────────────────────────────
  console.log('📸 Screenshot 2: Form filled in...');

  // Fill "Starting from…"
  const startInput = page.locator('input[placeholder*="Starting"], input[placeholder*="starting"], input[placeholder*="Start"]').first();
  await startInput.click();
  await startInput.fill("Hell's Kitchen, NYC");
  await sleep(500);

  // Fill "Ending up at…"
  const endInput = page.locator('input[placeholder*="Ending"], input[placeholder*="ending"], input[placeholder*="End"]').first();
  await endInput.click();
  await endInput.fill("Flatiron District, NYC");
  await sleep(500);

  // Click the 🌿 Green & Scenic vibe button
  const vibeBtn = page.locator('button:has-text("🌿"), button:has-text("Green")');
  await vibeBtn.first().click();
  await sleep(500);

  const s2 = join(ASSETS_DIR, '02-form-filled.png');
  await page.screenshot({ path: s2, fullPage: true });
  results.push({ file: s2, size: fileSize(s2), desc: 'Form filled with Hell\'s Kitchen → Flatiron, Green & Scenic selected' });
  console.log(`  ✅ Saved ${s2} (${fileSize(s2)} bytes)`);

  // ── SCREENSHOT 3: Loading screen ──────────────────────────────────────────
  console.log('📸 Screenshot 3: Loading screen...');
  // Click the generate button
  const genBtn = page.locator('button:has-text("Generate"), button:has-text("generate")').first();
  await genBtn.click();
  // Take screenshot immediately (within ~500ms to catch the loading state)
  await sleep(400);
  const s3 = join(ASSETS_DIR, '03-loading.png');
  await page.screenshot({ path: s3, fullPage: true });
  results.push({ file: s3, size: fileSize(s3), desc: 'Loading screen with 🗺️ emoji and italic serif loading text' });
  console.log(`  ✅ Saved ${s3} (${fileSize(s3)} bytes)`);

  // ── SCREENSHOT 4: Three-route result ──────────────────────────────────────
  console.log('📸 Screenshot 4: Three-route result (waiting up to 60s)...');
  // Wait for route cards to appear
  await page.waitForSelector('[class*="route"], [class*="stop"], [class*="card"], button:has-text("Start Wandering")', { 
    timeout: 60000 
  });
  await sleep(2000); // let animations settle

  // Capture route names from carousel tabs
  const routeTabs = await page.locator('button[class*="tab"], button[class*="route"], [role="tab"]').all();
  const routeNames = [];
  for (const tab of routeTabs) {
    const text = await tab.textContent();
    if (text && text.trim()) routeNames.push(text.trim());
  }
  console.log('  Route tabs found:', routeNames);

  // Also try to grab route title
  const routeTitle = await page.locator('h2, h3, [class*="title"], [class*="name"]').first().textContent().catch(() => '');
  console.log('  Route title:', routeTitle);

  const s4 = join(ASSETS_DIR, '04-route.png');
  await page.screenshot({ path: s4, fullPage: true });
  results.push({ 
    file: s4, 
    size: fileSize(s4), 
    desc: `Full-page route result. Route tabs: ${routeNames.join(' | ')}. Title: ${routeTitle}`,
    routeNames,
    routeTitle
  });
  console.log(`  ✅ Saved ${s4} (${fileSize(s4)} bytes)`);

  // Collect first stop names for route 1
  const firstStopR1 = await page.locator('[class*="stop"] h3, [class*="stop"] h4, [class*="card"] h3, [class*="card"] h4').first().textContent().catch(() => '');
  console.log('  First stop (Route 1):', firstStopR1);
  results[results.length-1].firstStopR1 = firstStopR1;

  // ── SCREENSHOT 5: Carousel tab switch (Route 2) ───────────────────────────
  console.log('📸 Screenshot 5: Carousel tab 2...');
  // Click second route tab
  if (routeTabs.length >= 2) {
    await routeTabs[1].click();
  } else {
    // Fallback: try numbered tabs
    const tab2 = page.locator('button:has-text("2"), button:has-text("Route 2")').first();
    await tab2.click();
  }
  await sleep(1500); // wait for re-animation

  // Capture first stop for route 2
  const firstStopR2 = await page.locator('[class*="stop"] h3, [class*="stop"] h4, [class*="card"] h3, [class*="card"] h4').first().textContent().catch(() => '');
  console.log('  First stop (Route 2):', firstStopR2);

  const s5 = join(ASSETS_DIR, '05-carousel.png');
  await page.screenshot({ path: s5, fullPage: true });
  results.push({ 
    file: s5, 
    size: fileSize(s5), 
    desc: `Route 2 tab selected, showing Route 2 stops. First stop: ${firstStopR2}`,
    firstStopR2
  });
  console.log(`  ✅ Saved ${s5} (${fileSize(s5)} bytes)`);

  // ── SCREENSHOT 6: Insider tip expanded ────────────────────────────────────
  console.log('📸 Screenshot 6: Insider tip...');
  // Click back to Route 1
  if (routeTabs.length >= 1) {
    await routeTabs[0].click();
  }
  await sleep(1000);

  // Find and click the first "Insider tip" button
  const tipBtn = page.locator('button:has-text("Insider"), button:has-text("insider"), button:has-text("tip"), [class*="tip"]').first();
  await tipBtn.click();
  await sleep(800);

  const s6 = join(ASSETS_DIR, '06-insider-tip.png');
  await page.screenshot({ path: s6, fullPage: true });
  results.push({ file: s6, size: fileSize(s6), desc: 'Insider tip expanded on first stop card, showing italic tip text' });
  console.log(`  ✅ Saved ${s6} (${fileSize(s6)} bytes)`);

  // ── SCREENSHOT 7: Sticky button close-up ──────────────────────────────────
  console.log('📸 Screenshot 7: Sticky button...');
  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(800);

  const s7 = join(ASSETS_DIR, '07-sticky-button.png');
  await page.screenshot({ path: s7, fullPage: false }); // viewport only to show button
  results.push({ file: s7, size: fileSize(s7), desc: 'Bottom of page showing sticky green \'Start Wandering\' button prominently' });
  console.log(`  ✅ Saved ${s7} (${fileSize(s7)} bytes)`);

} catch (err) {
  console.error('❌ Error:', err.message);
  results.push({ error: err.message });
}

await browser.close();

// Print summary JSON for parsing
console.log('\n===RESULTS_JSON===');
console.log(JSON.stringify(results, null, 2));
