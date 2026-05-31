const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForSelector(page, selector, timeout = 15000) {
  await page.waitForSelector(selector, { timeout });
}

async function takeScreenshot(page, filename) {
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`Saved: ${filePath}`);
  return filePath;
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate to the app
    console.log('Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // ============================================================
    // 1. hero_input.png - Main input screen
    // ============================================================
    console.log('\n=== Screenshot 1: hero_input.png ===');
    await takeScreenshot(page, 'hero_input.png');
    console.log('hero_input.png captured');

    // ============================================================
    // 4. history_panel.png - Open history panel (while on input screen)
    // ============================================================
    console.log('\n=== Screenshot 4: history_panel.png ===');
    // Look for history button in the header
    try {
      // Try various selectors for history button
      const historySelectors = [
        'button[aria-label*="history" i]',
        'button[title*="history" i]',
        '[data-testid*="history"]',
        'button:has(svg)',
        '.history-btn',
        '#history-btn',
        'button.history',
      ];
      
      let historyClicked = false;
      for (const sel of historySelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const text = await page.evaluate(el => el.textContent, el);
            console.log(`Found element with selector ${sel}, text: "${text}"`);
          }
        } catch(e) {}
      }

      // Use page.evaluate to find and click history button
      const clicked = await page.evaluate(() => {
        // Find buttons with history-related text or icon
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        for (const btn of buttons) {
          const text = btn.textContent.toLowerCase().trim();
          const title = (btn.getAttribute('title') || '').toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const className = (btn.className || '').toLowerCase();
          if (text.includes('history') || title.includes('history') || 
              ariaLabel.includes('history') || className.includes('history')) {
            btn.click();
            return `clicked: ${btn.textContent.trim() || btn.className}`;
          }
        }
        // Also try SVG buttons in header area
        const header = document.querySelector('header, nav, .header, .navbar, .app-header, .top-bar');
        if (header) {
          const btns = header.querySelectorAll('button, [role="button"]');
          if (btns.length > 0) {
            btns[btns.length - 1].click(); // often history is last button
            return `clicked last header button: ${btns[btns.length - 1].textContent.trim()}`;
          }
        }
        return null;
      });
      
      console.log('History click result:', clicked);
      await sleep(1500);
      await takeScreenshot(page, 'history_panel.png');
      console.log('history_panel.png captured');
      
      // Close panel by pressing Escape or clicking elsewhere
      await page.keyboard.press('Escape');
      await sleep(500);
      
      // Try clicking outside
      await page.mouse.click(200, 200);
      await sleep(500);
    } catch (e) {
      console.log('History panel screenshot failed:', e.message);
      await takeScreenshot(page, 'history_panel.png');
    }

    // ============================================================
    // Now fill in the form and generate a route
    // ============================================================
    console.log('\n=== Filling form to generate route ===');
    
    // Navigate fresh to ensure clean state
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Fill Start input
    const startSelectors = [
      'input[placeholder*="start" i]',
      'input[placeholder*="from" i]',
      'input[name*="start" i]',
      'input[id*="start" i]',
      '#start',
      '.start-input input',
    ];
    
    let startFilled = false;
    for (const sel of startSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click({ clickCount: 3 });
          await el.type('Washington Square Park, NYC');
          console.log(`Filled start with selector: ${sel}`);
          startFilled = true;
          break;
        }
      } catch(e) {}
    }
    
    if (!startFilled) {
      // Try to find by evaluating
      const filled = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
        for (const input of inputs) {
          const placeholder = (input.placeholder || '').toLowerCase();
          if (placeholder.includes('start') || placeholder.includes('from') || placeholder.includes('origin')) {
            input.value = 'Washington Square Park, NYC';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        // Fill first input
        if (inputs.length > 0) {
          inputs[0].value = 'Washington Square Park, NYC';
          inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
          inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          return 'first';
        }
        return false;
      });
      console.log('Start fill result:', filled);
    }
    await sleep(500);

    // Fill End input
    const endSelectors = [
      'input[placeholder*="end" i]',
      'input[placeholder*="to" i]',
      'input[placeholder*="destination" i]',
      'input[name*="end" i]',
      'input[id*="end" i]',
      '#end',
      '.end-input input',
    ];
    
    let endFilled = false;
    for (const sel of endSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click({ clickCount: 3 });
          await el.type('Brooklyn Bridge, NYC');
          console.log(`Filled end with selector: ${sel}`);
          endFilled = true;
          break;
        }
      } catch(e) {}
    }
    
    if (!endFilled) {
      const filled = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
        for (const input of inputs) {
          const placeholder = (input.placeholder || '').toLowerCase();
          if (placeholder.includes('end') || placeholder.includes('to') || placeholder.includes('destination')) {
            input.value = 'Brooklyn Bridge, NYC';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        // Fill second input
        if (inputs.length > 1) {
          inputs[1].value = 'Brooklyn Bridge, NYC';
          inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
          inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
          return 'second';
        }
        return false;
      });
      console.log('End fill result:', filled);
    }
    await sleep(500);

    // Click 'Caffeinated & Cultured' vibe
    const vibeClicked = await page.evaluate(() => {
      const allElements = document.querySelectorAll('button, [role="button"], .vibe, .vibe-option, [class*="vibe"], .pill, .chip, .badge');
      for (const el of allElements) {
        const text = el.textContent.toLowerCase();
        if (text.includes('caffeinated') || text.includes('cultured')) {
          el.click();
          return `clicked: ${el.textContent.trim()}`;
        }
      }
      // Try clicking first vibe/pill button
      const vibeGrid = document.querySelector('[class*="vibe"], .vibes, .vibe-grid, .vibe-selector');
      if (vibeGrid) {
        const first = vibeGrid.querySelector('button, [role="button"], .option');
        if (first) {
          first.click();
          return `clicked first vibe: ${first.textContent.trim()}`;
        }
      }
      return null;
    });
    console.log('Vibe click result:', vibeClicked);
    await sleep(500);
    
    // Take hero_input screenshot again after filling (more informative)
    // Overwrite the first one with a filled state
    console.log('\n=== Re-capturing hero_input.png with filled form ===');
    await takeScreenshot(page, 'hero_input.png');

    // Click wander/submit button
    const wanderClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]');
      for (const btn of buttons) {
        const text = btn.textContent.toLowerCase().trim();
        if (text === 'wander' || text.includes('wander') || text === 'go' || text === 'generate' || text === 'explore') {
          btn.click();
          return `clicked: ${btn.textContent.trim()}`;
        }
      }
      // Look for submit button
      const submitBtn = document.querySelector('button[type="submit"], .submit-btn, .go-btn, .wander-btn');
      if (submitBtn) {
        submitBtn.click();
        return `clicked submit: ${submitBtn.textContent.trim()}`;
      }
      return null;
    });
    console.log('Wander button click result:', wanderClicked);

    // Wait for route to load (up to 90 seconds)
    console.log('Waiting for route to stream in (up to 90 seconds)...');
    const routeLoaded = await Promise.race([
      // Wait for map or route content to appear
      page.waitForSelector('.leaflet-container, .leaflet-map, [class*="map"], .route, .stop, .waypoint, [class*="route"], [class*="stop"]', { timeout: 90000 })
        .then(() => 'found route element'),
      sleep(90000).then(() => 'timeout'),
    ]);
    console.log('Route load status:', routeLoaded);
    
    // Extra wait for streaming to finish
    await sleep(5000);

    // ============================================================
    // 2. route_screen.png
    // ============================================================
    console.log('\n=== Screenshot 2: route_screen.png ===');
    await takeScreenshot(page, 'route_screen.png');

    // Scroll down a bit to show waypoint cards
    await page.evaluate(() => window.scrollBy(0, 400));
    await sleep(500);
    await takeScreenshot(page, 'route_screen.png');
    console.log('route_screen.png captured');

    // ============================================================
    // 3. waypoint_card.png - Single waypoint card
    // ============================================================
    console.log('\n=== Screenshot 3: waypoint_card.png ===');
    
    // Find and screenshot a single waypoint/stop card
    const cardEl = await page.$('.stop-card, .waypoint-card, [class*="stop-card"], [class*="waypoint"], .card, .poi-card, [class*="card"]');
    if (cardEl) {
      const cardPath = path.join(SCREENSHOTS_DIR, 'waypoint_card.png');
      await cardEl.screenshot({ path: cardPath });
      console.log(`waypoint_card.png captured (element screenshot)`);
    } else {
      // Just take full page screenshot scrolled to first card
      await page.evaluate(() => {
        const card = document.querySelector('[class*="card"], [class*="stop"], [class*="waypoint"]');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      await sleep(1000);
      await takeScreenshot(page, 'waypoint_card.png');
      console.log('waypoint_card.png captured (viewport screenshot)');
    }

    // ============================================================
    // 5. vibe_detour.png - Vibe detour section at bottom
    // ============================================================
    console.log('\n=== Screenshot 5: vibe_detour.png ===');
    
    // Scroll to bottom to find vibe detour section
    await page.evaluate(() => {
      const detour = document.querySelector('[class*="detour"], [class*="vibe-detour"], .detour, .vibe-section');
      if (detour) {
        detour.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      return false;
    });
    await sleep(1500);
    await takeScreenshot(page, 'vibe_detour.png');
    console.log('vibe_detour.png captured');

    console.log('\n=== All screenshots completed ===');
    console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
    
    // List all files
    const files = fs.readdirSync(SCREENSHOTS_DIR);
    console.log('Files:', files);
    
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
