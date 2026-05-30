import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const OUTPUT_PATH = 'C:\\Users\\vjbel\\hacks\\wander\\assets\\09-photo-cards.png';

// Ensure output directory exists
const dir = dirname(OUTPUT_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1400, height: 900 },
});

const page = await browser.newPage();
console.log('Navigating to http://localhost:3000 ...');
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

console.log('Filling Start field...');
// Try common selectors for the start input
const startSelectors = ['input[placeholder*="Start"]', 'input[placeholder*="start"]', 'input[name="start"]', 'input[id*="start"]', '#start'];
let startFilled = false;
for (const sel of startSelectors) {
  const el = await page.$(sel);
  if (el) {
    await el.click({ clickCount: 3 });
    await el.type("Hell's Kitchen, NYC");
    startFilled = true;
    console.log(`  Filled start with selector: ${sel}`);
    break;
  }
}
if (!startFilled) {
  // Try to find by label or placeholder text in DOM
  const inputs = await page.$$('input');
  if (inputs.length >= 1) {
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type("Hell's Kitchen, NYC");
    console.log('  Filled first input as start');
  }
}

await new Promise(r => setTimeout(r, 500));

console.log('Filling End field...');
const endSelectors = ['input[placeholder*="End"]', 'input[placeholder*="end"]', 'input[name="end"]', 'input[id*="end"]', '#end'];
let endFilled = false;
for (const sel of endSelectors) {
  const el = await page.$(sel);
  if (el) {
    await el.click({ clickCount: 3 });
    await el.type("Flatiron District, NYC");
    endFilled = true;
    console.log(`  Filled end with selector: ${sel}`);
    break;
  }
}
if (!endFilled) {
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[1].click({ clickCount: 3 });
    await inputs[1].type("Flatiron District, NYC");
    console.log('  Filled second input as end');
  }
}

await new Promise(r => setTimeout(r, 500));

console.log('Looking for vibe buttons...');
// Find the Caffeinated & Cultured button
const vibeButton = await page.evaluateHandle(() => {
  const buttons = Array.from(document.querySelectorAll('button, [role="button"], div[class*="vibe"], span[class*="vibe"]'));
  return buttons.find(b => b.textContent && b.textContent.includes('Caffeinated'));
});

if (vibeButton && vibeButton.asElement()) {
  await vibeButton.asElement().click();
  console.log('  Clicked Caffeinated & Cultured vibe button');
} else {
  // Try by text content
  const [btn] = await page.$x('//*[contains(text(), "Caffeinated")]');
  if (btn) {
    await btn.click();
    console.log('  Clicked via XPath');
  } else {
    console.log('  WARNING: Could not find Caffeinated vibe button');
  }
}

await new Promise(r => setTimeout(r, 500));

console.log('Looking for Generate Routes button...');
// Find the generate button
const generateButton = await page.evaluateHandle(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  return buttons.find(b => b.textContent && (
    b.textContent.includes('Generate') ||
    b.textContent.includes('generate') ||
    b.textContent.includes('routes') ||
    b.textContent.includes('Routes')
  ));
});

if (generateButton && generateButton.asElement()) {
  await generateButton.asElement().click();
  console.log('  Clicked Generate Routes button');
} else {
  console.log('  WARNING: Could not find Generate Routes button, trying XPath');
  const [btn] = await page.$x('//*[contains(text(), "Generate") or contains(text(), "routes")]');
  if (btn) {
    await btn.click();
    console.log('  Clicked via XPath');
  }
}

console.log('Waiting up to 60 seconds for routes to load...');
// Wait for route cards or carousel to appear
try {
  await page.waitForFunction(
    () => {
      // Look for route cards, carousel tabs, or stop cards
      const selectors = [
        '[class*="route"]',
        '[class*="Route"]',
        '[class*="card"]',
        '[class*="carousel"]',
        '[class*="stop"]',
        '[class*="venue"]',
      ];
      for (const s of selectors) {
        const els = document.querySelectorAll(s);
        if (els.length > 3) return true;
      }
      return false;
    },
    { timeout: 60000 }
  );
  console.log('  Routes appear to have loaded!');
} catch (e) {
  console.log('  Timeout or no route cards found, taking screenshot anyway...');
}

// Extra wait for images to load
await new Promise(r => setTimeout(r, 3000));

console.log(`Taking screenshot and saving to ${OUTPUT_PATH}...`);
await page.screenshot({ path: OUTPUT_PATH, fullPage: false });
console.log('Screenshot saved!');

// Collect info about what's on the page
const pageInfo = await page.evaluate(() => {
  const info = {};
  
  // Get tab/route names
  const tabs = Array.from(document.querySelectorAll('[class*="tab"], [role="tab"], [class*="Tab"]'));
  info.tabTexts = tabs.map(t => t.textContent?.trim()).filter(Boolean);
  
  // Get images
  const imgs = Array.from(document.querySelectorAll('img'));
  info.images = imgs.map(img => ({
    src: img.src,
    alt: img.alt,
    width: img.offsetWidth,
    height: img.offsetHeight,
  }));
  
  // Get card/route text
  const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"], [class*="route"], [class*="Route"]'));
  info.cardCount = cards.length;
  info.cardTexts = cards.slice(0, 5).map(c => c.textContent?.trim().slice(0, 100));
  
  // Full body text sample
  info.bodyText = document.body.innerText?.slice(0, 1000);
  
  return info;
});

console.log('\n=== PAGE INFO ===');
console.log('Tab/Route names:', JSON.stringify(pageInfo.tabTexts));
console.log('Image count:', pageInfo.images.length);
console.log('Images:', JSON.stringify(pageInfo.images.slice(0, 10)));
console.log('Card count:', pageInfo.cardCount);
console.log('Card texts:', JSON.stringify(pageInfo.cardTexts));
console.log('Body text sample:', pageInfo.bodyText);

await browser.close();
console.log('\nDone!');
