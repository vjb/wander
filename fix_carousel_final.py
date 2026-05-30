#!/usr/bin/env python3
"""
Final fix for screenshot 05-carousel.png.
Uses the exact IDs from the source: #route-tab-0, #route-tab-1, #route-tab-2
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
        await page.locator('#vibe-green---scenic').click()
        await page.wait_for_timeout(400)
        await page.locator('#wander-button').click()
        
        print("Waiting for routes...")
        await page.wait_for_selector('#start-wandering-button', timeout=60000)
        await page.wait_for_timeout(2000)
        
        # Get all three route names from tab buttons
        tab0 = page.locator('#route-tab-0')
        tab1 = page.locator('#route-tab-1')
        tab2 = page.locator('#route-tab-2')
        
        route1_name = (await tab0.text_content() or '').strip()
        route2_name = (await tab1.text_content() or '').strip()
        route3_name = (await tab2.text_content() or '').strip()
        
        print(f"\n=== ROUTE NAMES ===")
        print(f"Route 1: {route1_name}")
        print(f"Route 2: {route2_name}")
        print(f"Route 3: {route3_name}")
        
        # Get stop names (h3 elements)
        h3_els = await page.locator('h3').all()
        stop_names = []
        for el in h3_els:
            txt = await el.text_content()
            if txt:
                stop_names.append(txt.strip())
        print(f"\n=== ROUTE 1 STOPS ===")
        for s in stop_names:
            print(f"  - {s}")
        first_stop_r1 = stop_names[0] if stop_names else 'unknown'
        
        # ── SCREENSHOT 4: Route 1 (already active) ───────────────────────────
        print("\n📸 Screenshot 4: Route 1...")
        await tab0.click()
        await page.wait_for_timeout(1500)
        
        s4 = os.path.join(ASSETS_DIR, "04-route.png")
        await page.screenshot(path=s4, full_page=True)
        print(f"  ✅ {s4} ({file_size(s4):,} bytes)")
        
        # ── SCREENSHOT 5: Route 2 ─────────────────────────────────────────────
        print("\n📸 Screenshot 5: Route 2 tab...")
        await tab1.click()
        await page.wait_for_timeout(1500)
        
        # Verify route changed - get h3 elements
        h3_r2 = await page.locator('h3').all()
        stop_names_r2 = []
        for el in h3_r2:
            txt = await el.text_content()
            if txt:
                stop_names_r2.append(txt.strip())
        first_stop_r2 = stop_names_r2[0] if stop_names_r2 else 'unknown'
        print(f"  Route 2 stops: {stop_names_r2}")
        
        s5 = os.path.join(ASSETS_DIR, "05-carousel.png")
        await page.screenshot(path=s5, full_page=True)
        sz5 = file_size(s5)
        print(f"  ✅ {s5} ({sz5:,} bytes)")
        
        if file_size(s4) == sz5 and stop_names == stop_names_r2:
            print("  ⚠️ WARNING: Same stops shown - carousel may not have changed!")
        else:
            print(f"  ✅ Route changed! R1 first stop: {first_stop_r1} → R2 first stop: {first_stop_r2}")
        
        # Also get Route 3 info
        await tab2.click()
        await page.wait_for_timeout(1000)
        h3_r3 = await page.locator('h3').all()
        stop_names_r3 = [((await el.text_content()) or '').strip() for el in h3_r3]
        first_stop_r3 = stop_names_r3[0] if stop_names_r3 else 'unknown'
        print(f"\nRoute 3 stops: {stop_names_r3}")
        
        # ── SCREENSHOT 6: Insider tip (Route 1) ──────────────────────────────
        print("\n📸 Screenshot 6: Insider tip...")
        await tab0.click()
        await page.wait_for_timeout(1000)
        
        # Click the first insider tip button (id="tip-toggle-1")
        tip_btn = page.locator('#tip-toggle-1')
        if await tip_btn.count() > 0:
            await tip_btn.scroll_into_view_if_needed()
            await tip_btn.click()
            print("  Clicked #tip-toggle-1")
        else:
            # Fallback to text
            tip_btn = page.locator('button:has-text("Insider tip")').first
            if await tip_btn.count() > 0:
                await tip_btn.scroll_into_view_if_needed()
                await tip_btn.click()
                print("  Clicked 'Insider tip' button (fallback)")
        
        await page.wait_for_timeout(800)
        s6 = os.path.join(ASSETS_DIR, "06-insider-tip.png")
        await page.screenshot(path=s6, full_page=True)
        print(f"  ✅ {s6} ({file_size(s6):,} bytes)")
        
        # ── SCREENSHOT 7: Sticky button ───────────────────────────────────────
        print("\n📸 Screenshot 7: Sticky button...")
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(600)
        s7 = os.path.join(ASSETS_DIR, "07-sticky-button.png")
        await page.screenshot(path=s7, full_page=False)
        print(f"  ✅ {s7} ({file_size(s7):,} bytes)")
        
        await browser.close()
    
    print("\n\n=== FINAL SUMMARY ===")
    print(f"Route 1: '{route1_name}' — First stop: '{first_stop_r1}'")
    print(f"Route 2: '{route2_name}' — First stop: '{first_stop_r2}'")
    print(f"Route 3: '{route3_name}' — First stop: '{first_stop_r3}'")
    print()
    for fname in ['01-landing.png', '02-form-filled.png', '03-loading.png', '04-route.png', '05-carousel.png', '06-insider-tip.png', '07-sticky-button.png']:
        fpath = os.path.join(ASSETS_DIR, fname)
        if os.path.exists(fpath):
            print(f"  ✅ {fname}: {os.path.getsize(fpath):,} bytes")
        else:
            print(f"  ❌ {fname}: MISSING")

if __name__ == "__main__":
    asyncio.run(run())
