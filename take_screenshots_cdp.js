/**
 * Screenshot script using Playwright CDP (no npm install needed).
 * Uses the already-cached Chromium at ms-playwright location.
 * Playwright's binary is found via PLAYWRIGHT_BROWSERS_PATH env var.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const CHROME_PATH = 'C:\\Users\\vjbel\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const ASSETS_DIR = 'C:\\Users\\vjbel\\hacks\\wander\\assets';
const BASE_URL = 'http://localhost:3000';

// Ensure assets dir exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(options, res => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)); } catch { resolve(responseData); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// CDP WebSocket client
function createCDPClient(wsUrl) {
  const WebSocket = require('ws');
  const ws = new WebSocket(wsUrl);
  let msgId = 1;
  const pending = new Map();
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  
  return new Promise((resolve) => {
    ws.on('open', () => {
      const send = (method, params = {}) => {
        return new Promise((res, rej) => {
          const id = msgId++;
          pending.set(id, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      };
      resolve({ send, close: () => ws.close() });
    });
  });
}

async function main() {
  // Check if ws is available
  let wsAvailable = false;
  try {
    require.resolve('ws');
    wsAvailable = true;
  } catch {}
  
  if (!wsAvailable) {
    console.log('WebSocket (ws) package not found, trying alternative...');
    // Use Chrome's --screenshot flag for simple screenshots
    // But this won't work for interaction. Let's check if we can use fetch/CDP via built-in
    console.log('ERROR: ws package required for CDP. Please install ws: npm install ws');
    process.exit(1);
  }

  console.log('Launching Chrome with remote debugging...');
  const chrome = spawn(CHROME_PATH, [
    '--remote-debugging-port=9222',
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    '--disable-extensions',
    `--user-data-dir=${path.join(ASSETS_DIR, '..', '.chrome-temp')}`,
    'about:blank'
  ], { stdio: 'pipe' });
  
  chrome.stderr.on('data', d => process.stderr.write(d));
  
  await sleep(3000); // wait for Chrome to start
  
  // Get debug endpoints
  let targets;
  for (let i = 0; i < 10; i++) {
    try {
      targets = await httpGet('http://localhost:9222/json/list');
      if (targets && targets.length) break;
    } catch {}
    await sleep(500);
  }
  
  if (!targets || !targets.length) {
    console.error('Could not connect to Chrome CDP');
    chrome.kill();
    process.exit(1);
  }
  
  const wsUrl = targets[0].webSocketDebuggerUrl;
  console.log('Connected to CDP at:', wsUrl);
  
  const cdp = await createCDPClient(wsUrl);
  
  const results = [];
  
  async function navigate(url) {
    await cdp.send('Page.navigate', { url });
    await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
    await sleep(3000);
  }
  
  async function screenshot(filePath, fullPage = true) {
    let clip;
    if (fullPage) {
      const layout = await cdp.send('Page.getLayoutMetrics');
      const { width, height } = layout.cssContentSize || layout.contentSize;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: Math.ceil(height),
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(200);
    }
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: clip,
      captureBeyondViewport: fullPage
    });
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    const size = fs.statSync(filePath).size;
    console.log(`  ✅ Saved: ${filePath} (${size} bytes)`);
    return size;
  }
  
  async function clickElement(selector) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) { el.click(); return 'clicked'; }
          return 'not found';
        })()
      `
    });
    return result.result.value;
  }
  
  async function typeInInput(selector, text) {
    // Click the input first
    await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) { el.focus(); el.click(); return 'focused'; }
          return 'not found';
        })()
      `
    });
    await sleep(200);
    // Clear and type
    await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(el, ${JSON.stringify(text)});
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return 'typed';
          }
          return 'not found';
        })()
      `
    });
    await sleep(300);
  }
  
  async function getPageHTML() {
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'document.documentElement.outerHTML'
    });
    return result.result.value;
  }
  
  async function scrollToBottom() {
    await cdp.send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, document.body.scrollHeight)'
    });
    await sleep(500);
  }
  
  try {
    // ── SCREENSHOT 1: Landing ──────────────────────────────────────────────
    console.log('\n📸 Screenshot 1: Landing...');
    await navigate(BASE_URL);
    
    const s1 = path.join(ASSETS_DIR, '01-landing.png');
    const size1 = await screenshot(s1, true);
    results.push({ file: s1, size: size1, desc: 'Landing screen' });
    
    // ── SCREENSHOT 2: Form filled ──────────────────────────────────────────
    console.log('\n📸 Screenshot 2: Form filled...');
    
    // Get page structure to find input selectors
    const html = await getPageHTML();
    console.log('  Page title:', html.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] || 'unknown');
    
    // Find input placeholders
    const inputs = html.match(/placeholder="([^"]+)"/g) || [];
    console.log('  Input placeholders found:', inputs.slice(0, 10));
    
    // Find first text input
    await typeInInput('input[type="text"]:first-of-type, input:not([type]):first-of-type', "Hell's Kitchen, NYC");
    await sleep(200);
    
    // Try to find start/end inputs by placeholder content
    const startSelector = 'input[placeholder*="Start"], input[placeholder*="start"], input[placeholder*="from"], input[placeholder*="From"]';
    const endSelector = 'input[placeholder*="End"], input[placeholder*="end"], input[placeholder*="at"], input[placeholder*="At"]';
    
    await typeInInput(startSelector, "Hell's Kitchen, NYC");
    await sleep(200);
    await typeInInput(endSelector, "Flatiron District, NYC");
    await sleep(200);
    
    // Click Green & Scenic vibe button
    const vibeResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const buttons = Array.from(document.querySelectorAll('button'));
          const greenBtn = buttons.find(b => b.textContent.includes('🌿') || 
                                           b.textContent.toLowerCase().includes('green') ||
                                           b.textContent.toLowerCase().includes('scenic'));
          if (greenBtn) { greenBtn.click(); return greenBtn.textContent.trim(); }
          // Try all buttons with emoji
          const emojiBtn = buttons.find(b => b.textContent.includes('🌿'));
          if (emojiBtn) { emojiBtn.click(); return 'emoji clicked: ' + emojiBtn.textContent.trim(); }
          return 'vibe button not found. Available: ' + buttons.slice(0,10).map(b=>b.textContent.trim()).join(' | ');
        })()
      `
    });
    console.log('  Vibe button result:', vibeResult.result.value);
    await sleep(500);
    
    const s2 = path.join(ASSETS_DIR, '02-form-filled.png');
    const size2 = await screenshot(s2, true);
    results.push({ file: s2, size: size2, desc: 'Form filled with inputs and Green & Scenic selected' });
    
    // ── SCREENSHOT 3: Loading ──────────────────────────────────────────────
    console.log('\n📸 Screenshot 3: Loading...');
    const genResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const buttons = Array.from(document.querySelectorAll('button'));
          const genBtn = buttons.find(b => 
            b.textContent.toLowerCase().includes('generate') || 
            b.textContent.toLowerCase().includes('wander') ||
            b.type === 'submit'
          );
          if (genBtn) { genBtn.click(); return 'clicked: ' + genBtn.textContent.trim(); }
          return 'gen button not found. Available: ' + buttons.map(b=>b.textContent.trim()).join(' | ');
        })()
      `
    });
    console.log('  Generate button:', genResult.result.value);
    
    await sleep(600); // Catch loading state
    const s3 = path.join(ASSETS_DIR, '03-loading.png');
    const size3 = await screenshot(s3, false); // viewport only for loading
    results.push({ file: s3, size: size3, desc: 'Loading screen' });
    
    // ── SCREENSHOT 4: Route result ────────────────────────────────────────
    console.log('\n📸 Screenshot 4: Waiting for routes (up to 60s)...');
    
    let routesLoaded = false;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const checkResult = await cdp.send('Runtime.evaluate', {
        expression: `
          (function() {
            // Look for "Start Wandering" button or route cards
            const startBtn = Array.from(document.querySelectorAll('button')).find(b => 
              b.textContent.includes('Start Wandering') || b.textContent.includes('Wandering')
            );
            const cards = document.querySelectorAll('[class*="stop"], [class*="card"], [class*="route"]');
            return JSON.stringify({ 
              hasStartBtn: !!startBtn,
              cardCount: cards.length,
              bodyText: document.body.innerText.substring(0, 200)
            });
          })()
        `
      });
      const state = JSON.parse(checkResult.result.value);
      if (state.hasStartBtn || state.cardCount > 2) {
        console.log(`  Routes loaded after ${i+1}s! Cards: ${state.cardCount}`);
        routesLoaded = true;
        break;
      }
      if (i % 10 === 0) console.log(`  Waiting... ${i}s elapsed. State:`, state);
    }
    
    await sleep(1500); // Let animations settle
    
    // Get route names from tabs
    const routeInfo = await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          // Try to find tab buttons or carousel buttons
          const allButtons = Array.from(document.querySelectorAll('button'));
          const tabs = allButtons.filter(b => {
            const cls = b.className || '';
            return cls.includes('tab') || cls.includes('route') || cls.includes('carousel');
          });
          
          // Also try role=tab
          const roleTabs = Array.from(document.querySelectorAll('[role="tab"]'));
          
          // Get route title (first h2, italic, or special class)
          const title = document.querySelector('h2, h3, [class*="title"], [class*="name"]');
          
          // Get first stop names
          const stopHeadings = Array.from(document.querySelectorAll('[class*="stop"] h3, [class*="stop"] h4, [class*="card"] h3, [class*="card"] h4'));
          
          return JSON.stringify({
            tabs: tabs.map(t => ({ text: t.textContent.trim(), cls: t.className })),
            roleTabs: roleTabs.map(t => t.textContent.trim()),
            title: title ? title.textContent.trim() : null,
            firstStop: stopHeadings.length > 0 ? stopHeadings[0].textContent.trim() : null,
            allButtons: allButtons.slice(0,20).map(b => b.textContent.trim()).filter(t => t.length > 0)
          });
        })()
      `
    });
    const routeData = JSON.parse(routeInfo.result.value);
    console.log('  Route info:', JSON.stringify(routeData, null, 2));
    
    const s4 = path.join(ASSETS_DIR, '04-route.png');
    const size4 = await screenshot(s4, true);
    results.push({ 
      file: s4, size: size4, 
      desc: `Full route result. Title: ${routeData.title}. Tabs: ${JSON.stringify(routeData.tabs)}`,
      routeData
    });
    
    // ── SCREENSHOT 5: Route 2 tab ─────────────────────────────────────────
    console.log('\n📸 Screenshot 5: Route 2 tab...');
    const tab2Result = await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const allButtons = Array.from(document.querySelectorAll('button'));
          
          // Find tab-like buttons (route carousel)
          const tabs = allButtons.filter(b => {
            const cls = b.className || '';
            return cls.includes('tab') || cls.includes('route') || cls.includes('carousel');
          });
          
          // Click the second tab if found
          if (tabs.length >= 2) {
            tabs[1].click();
            return 'clicked tab[1]: ' + tabs[1].textContent.trim();
          }
          
          // Try role=tab
          const roleTabs = Array.from(document.querySelectorAll('[role="tab"]'));
          if (roleTabs.length >= 2) {
            roleTabs[1].click();
            return 'clicked roleTab[1]: ' + roleTabs[1].textContent.trim();
          }
          
          // Try buttons with numbers or "Route 2"  
          const btn2 = allButtons.find(b => b.textContent.includes('2') || b.textContent.includes('Route 2'));
          if (btn2) { btn2.click(); return 'clicked: ' + btn2.textContent.trim(); }
          
          return 'Tab 2 not found. Available tabs: ' + tabs.map(t=>t.textContent.trim()).join(', ');
        })()
      `
    });
    console.log('  Tab 2 click:', tab2Result.result.value);
    await sleep(1500);
    
    // Get first stop for route 2
    const stop2Info = await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const stopHeadings = Array.from(document.querySelectorAll('[class*="stop"] h3, [class*="stop"] h4, [class*="card"] h3, [class*="card"] h4'));
          return stopHeadings.length > 0 ? stopHeadings[0].textContent.trim() : 'not found';
        })()
      `
    });
    console.log('  First stop Route 2:', stop2Info.result.value);
    
    const s5 = path.join(ASSETS_DIR, '05-carousel.png');
    const size5 = await screenshot(s5, true);
    results.push({ 
      file: s5, size: size5, 
      desc: `Route 2 carousel. First stop: ${stop2Info.result.value}`,
      firstStopR2: stop2Info.result.value
    });
    
    // ── SCREENSHOT 6: Insider tip ─────────────────────────────────────────
    console.log('\n📸 Screenshot 6: Insider tip...');
    // Click back to Route 1
    const tab1Result = await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const tabs = allButtons.filter(b => {
            const cls = b.className || '';
            return cls.includes('tab') || cls.includes('route') || cls.includes('carousel');
          });
          if (tabs.length >= 1) { tabs[0].click(); return 'clicked tab[0]: ' + tabs[0].textContent.trim(); }
          const roleTabs = Array.from(document.querySelectorAll('[role="tab"]'));
          if (roleTabs.length >= 1) { roleTabs[0].click(); return 'roleTab[0]'; }
          return 'not found';
        })()
      `
    });
    console.log('  Tab 1 click:', tab1Result.result.value);
    await sleep(1000);
    
    // Find and click insider tip button
    const tipResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const tipBtn = allButtons.find(b => 
            b.textContent.toLowerCase().includes('insider') ||
            b.textContent.toLowerCase().includes('tip') ||
            b.textContent.toLowerCase().includes('local') ||
            (b.className && b.className.toLowerCase().includes('tip'))
          );
          if (tipBtn) { tipBtn.click(); return 'clicked: ' + tipBtn.textContent.trim(); }
          return 'tip button not found. Buttons: ' + allButtons.slice(0,15).map(b=>b.textContent.trim()).filter(t=>t).join(' | ');
        })()
      `
    });
    console.log('  Tip button:', tipResult.result.value);
    await sleep(800);
    
    const s6 = path.join(ASSETS_DIR, '06-insider-tip.png');
    const size6 = await screenshot(s6, true);
    results.push({ file: s6, size: size6, desc: 'Insider tip expanded' });
    
    // ── SCREENSHOT 7: Sticky button ───────────────────────────────────────
    console.log('\n📸 Screenshot 7: Sticky button...');
    await scrollToBottom();
    await sleep(600);
    
    // Set viewport back to normal for this one
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
    });
    await sleep(300);
    
    const s7 = path.join(ASSETS_DIR, '07-sticky-button.png');
    const { data: data7 } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(s7, Buffer.from(data7, 'base64'));
    const size7 = fs.statSync(s7).size;
    console.log(`  ✅ Saved: ${s7} (${size7} bytes)`);
    results.push({ file: s7, size: size7, desc: 'Sticky Start Wandering button' });
    
  } catch (err) {
    console.error('❌ Error:', err.message, err.stack);
    results.push({ error: err.message });
  }
  
  cdp.close();
  chrome.kill();
  
  console.log('\n===RESULTS_JSON===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
