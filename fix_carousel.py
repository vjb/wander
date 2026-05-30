#!/usr/bin/env python3
"""
Final fix for screenshot 05-carousel.png.
Uses the actual tab structure: finds all buttons, identifies the carousel tabs,
and clicks the second one.
"""
import asyncio
import os
from playwright.async_api import async_playwright

ASSETS_DIR = r"C:\Users\vjbel\hacks\wander\assets"
BASE_URL = "http://localhost:3000"

async def run():
    os.makedirs(ASSETS_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path=r"C:\Users\vjbel\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe"
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        def file_size(path):
            try: return os.path.getsize(path)
            except: return 0

        # Navigate and fill form
        print("Navigating and filling form...")
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)
        await page.locator('input[placeholder*="Starting"]').fill("Hell's Kitchen, NYC")
        await page.wait_for_timeout(300)
        await page.locator('input[placeholder*="Ending"]').fill("Flatiron District, NYC")
        await page.wait_for_timeout(300)
        await page.locator('button:has-text("🌿")').click()
        await page.wait_for_timeout(400)
        await page.locator('button:has-text("Generate three routes")').click()
        
        print("Waiting for routes...")
        await page.wait_for_selector('button:has-text("Start Wandering")', timeout=60000)
        await page.wait_for_timeout(2000)
        
        # Get the COMPLETE page source to find carousel structure
        content = await page.content()
        
        # Get all button texts to identify carousel tabs
        all_buttons = await page.locator('button').all()
        btn_info = []
        for i, b in enumerate(all_buttons):
            txt = await b.text_content()
            cls = await b.get_attribute('class') or ''
            aria = await b.get_attribute('aria-selected') or ''
            data = await b.get_attribute('data-state') or ''
            if txt:
                btn_info.append({'idx': i, 'text': txt.strip()[:80], 'class': cls[:60], 'aria-selected': aria, 'data-state': data})
        
        print(f"\nAll {len(btn_info)} buttons:")
        for b in btn_info:
            print(f"  [{b['idx']}] '{b['text'][:60]}' | cls={b['class'][:40]} | aria-selected={b['aria-selected']}")
        
        # The carousel tabs appear to be buttons that contain the route names.
        # From the page text analysis, we know the page contains 3 route names as buttons.
        # They appear consecutively in the DOM.
        # Identify route name buttons: they typically have short text (1-5 words), 
        # appear before "Insider tip" and "Start Wandering"
        
        # Get page text to find route names
        page_text = await page.evaluate("document.body.innerText")
        lines = [l.strip() for l in page_text.split('\n') if l.strip()]
        print(f"\nPage text lines (first 30):")
        for i, l in enumerate(lines[:30]):
            print(f"  {i}: {l[:100]}")
        
        # Find the h3 elements (stop names)
        h3_els = await page.locator('h3').all()
        h3_texts = []
        for el in h3_els:
            txt = await el.text_content()
            if txt:
                h3_texts.append(txt.strip())
        print(f"\nh3 elements (stop names): {h3_texts}")
        
        # Now find carousel tabs - they should be before the stop cards
        # Look for elements with CSS class patterns common to tab implementations
        # Try data attributes
        for attr_sel in [
            '[data-tab]', '[data-index]', '[data-route]',
            'nav button', 'ul button', 'ol button',
            '[class*="nav"] button', '[class*="Nav"] button',
            '[class*="carousel"] button', '[class*="Carousel"] button',
            '[class*="tabs"] button', '[class*="Tabs"] button',
            '[class*="switcher"] button', '[class*="Switcher"] button',
        ]:
            els = await page.locator(attr_sel).all()
            if els:
                print(f"\nFound elements with '{attr_sel}':")
                for el in els[:5]:
                    txt = await el.text_content()
                    print(f"  '{txt.strip()[:60] if txt else ''}'" )
        
        # Now attempt the actual click - use the button INDEX approach
        # From previous run we know the structure:
        # buttons[0] = Route 1 name
        # buttons[1] = Route 2 name  
        # buttons[2] = Route 3 name
        # buttons[3+] = Insider tip buttons, Plan another wander, Start Wandering
        
        # So the carousel tabs are the FIRST 3 buttons
        route_buttons = [b for b in btn_info if b['idx'] < 3 and 'tip' not in b['text'].lower() and 'start' not in b['text'].lower() and 'plan' not in b['text'].lower() and 'generate' not in b['text'].lower() and 'wander' not in b['text'].lower()]
        
        print(f"\nIdentified route buttons: {route_buttons}")
        
        # Also try: the tab buttons with highest likelihood
        # From page_text we got: "The Urban Oasis Trail\nArtful Corridor Trek\nExpress Landmark Stroll"
        # These are very likely the carousel tabs
        # But button text matching failed - maybe they use different text encoding
        
        # Let's try clicking by index based on the buttons array
        # First, click button[0] and screenshot, then button[1] and screenshot
        
        print("\n\n📸 SCREENSHOT 4: Route 1 (clicking button 0)...")
        # Click button index 0 (first route tab)
        first_btn = page.locator('button').nth(0)
        first_txt = await first_btn.text_content()
        print(f"  Button 0 text: '{first_txt.strip()[:60] if first_txt else ''}'")
        await first_btn.click()
        await page.wait_for_timeout(1500)
        
        s4 = os.path.join(ASSETS_DIR, "04-route.png")
        await page.screenshot(path=s4, full_page=True)
        print(f"  ✅ {s4} ({file_size(s4):,} bytes)")
        
        print("\n📸 SCREENSHOT 5: Route 2 (clicking button 1)...")
        # Click button index 1 (second route tab)
        second_btn = page.locator('button').nth(1)
        second_txt = await second_btn.text_content()
        print(f"  Button 1 text: '{second_txt.strip()[:60] if second_txt else ''}'")
        await second_btn.click()
        await page.wait_for_timeout(1500)
        
        # Check if page changed by getting h3 elements
        h3_after = await page.locator('h3').all()
        h3_after_texts = []
        for el in h3_after:
            txt = await el.text_content()
            if txt:
                h3_after_texts.append(txt.strip())
        print(f"  h3 after route 2 click: {h3_after_texts}")
        
        # Get the route title (em element or first strong text)
        route_title_el = page.locator('em, [class*="route"] em, h2 em').first
        route_title_txt = ""
        if await route_title_el.count() > 0:
            route_title_txt = await route_title_el.text_content()
        print(f"  Route 2 title (em): {route_title_txt}")
        
        s5 = os.path.join(ASSETS_DIR, "05-carousel.png")
        await page.screenshot(path=s5, full_page=True)
        sz5 = file_size(s5)
        print(f"  ✅ {s5} ({sz5:,} bytes)")
        
        if file_size(s4) == sz5:
            print("  ⚠️ Sizes still identical - trying button 2...")
            # Try 3rd button
            third_btn = page.locator('button').nth(2)
            third_txt = await third_btn.text_content()
            print(f"  Button 2 text: '{third_txt.strip()[:60] if third_txt else ''}'")
            await third_btn.click()
            await page.wait_for_timeout(1500)
            
            h3_after3 = await page.locator('h3').all()
            h3_after3_texts = []
            for el in h3_after3:
                txt = await el.text_content()
                if txt:
                    h3_after3_texts.append(txt.strip())
            print(f"  h3 after button 2 click: {h3_after3_texts}")
            
            await page.screenshot(path=s5, full_page=True)
            print(f"  ✅ Retook {s5} ({file_size(s5):,} bytes)")
        
        await browser.close()
    
    print("\n\n=== FINAL STATUS ===")
    for fname in ['04-route.png', '05-carousel.png']:
        fpath = os.path.join(ASSETS_DIR, fname)
        if os.path.exists(fpath):
            print(f"  {fname}: {os.path.getsize(fpath):,} bytes")

if __name__ == "__main__":
    asyncio.run(run())
