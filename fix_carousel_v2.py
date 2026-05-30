#!/usr/bin/env python3
"""
Screenshot fix - only retakes 04, 05, 06, 07 using proper element IDs.
Route 1-3 already shown from previous run button texts.
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
        
        # Click vibe button - use text selector which worked previously
        vibe_btn = page.locator('button:has-text("🌿")').first
        await vibe_btn.click()
        await page.wait_for_timeout(400)
        
        # Click generate
        gen_btn = page.locator('#wander-button')
        if await gen_btn.count() > 0:
            await gen_btn.click()
            print("Clicked #wander-button")
        else:
            await page.locator('button:has-text("Generate three routes")').click()
            print("Clicked Generate three routes button")
        
        print("Waiting for routes...")
        await page.wait_for_selector('#start-wandering-button', timeout=60000)
        await page.wait_for_timeout(2000)
        
        # Get route names from carousel tabs
        route_names = []
        for i in range(3):
            tab = page.locator(f'#route-tab-{i}')
            if await tab.count() > 0:
                txt = await tab.text_content()
                route_names.append(txt.strip() if txt else f"Route {i+1}")
            else:
                route_names.append(f"Route {i+1}")
        
        print(f"\nRoute names from tabs: {route_names}")
        
        # Get stop names for Route 1 (currently active)
        h3_els = await page.locator('h3').all()
        stops_r1 = [(await el.text_content() or '').strip() for el in h3_els]
        print(f"Route 1 stops: {stops_r1}")
        first_stop_r1 = stops_r1[0] if stops_r1 else 'unknown'
        
        # ── SCREENSHOT 4: Route 1 full page ──────────────────────────────────
        print("\n📸 Screenshot 4: Route 1...")
        # Ensure Route 1 is active
        tab0 = page.locator('#route-tab-0')
        if await tab0.count() > 0:
            await tab0.click()
            await page.wait_for_timeout(1200)
        
        s4 = os.path.join(ASSETS_DIR, "04-route.png")
        await page.screenshot(path=s4, full_page=True)
        print(f"  ✅ {s4} ({file_size(s4):,} bytes)")
        
        # ── SCREENSHOT 5: Route 2 ─────────────────────────────────────────────
        print("\n📸 Screenshot 5: Route 2...")
        tab1 = page.locator('#route-tab-1')
        if await tab1.count() > 0:
            txt = await tab1.text_content()
            print(f"  Clicking '#route-tab-1': '{txt.strip() if txt else ''}'")
            await tab1.click()
            await page.wait_for_timeout(1500)
        else:
            print("  ⚠️ #route-tab-1 not found!")
        
        # Get stops for route 2
        h3_r2 = await page.locator('h3').all()
        stops_r2 = [(await el.text_content() or '').strip() for el in h3_r2]
        first_stop_r2 = stops_r2[0] if stops_r2 else 'unknown'
        print(f"  Route 2 stops: {stops_r2}")
        
        s5 = os.path.join(ASSETS_DIR, "05-carousel.png")
        await page.screenshot(path=s5, full_page=True)
        sz5 = file_size(s5)
        print(f"  ✅ {s5} ({sz5:,} bytes)")
        
        if file_size(s4) == sz5:
            print("  ⚠️ WARNING: Same file size as Route 1 screenshot!")
        
        # Route 3 stops
        tab2 = page.locator('#route-tab-2')
        if await tab2.count() > 0:
            await tab2.click()
            await page.wait_for_timeout(1000)
        h3_r3 = await page.locator('h3').all()
        stops_r3 = [(await el.text_content() or '').strip() for el in h3_r3]
        first_stop_r3 = stops_r3[0] if stops_r3 else 'unknown'
        print(f"  Route 3 stops: {stops_r3}")
        
        # ── SCREENSHOT 6: Insider tip ─────────────────────────────────────────
        print("\n📸 Screenshot 6: Insider tip on Route 1...")
        if await tab0.count() > 0:
            await tab0.click()
            await page.wait_for_timeout(1000)
        
        # Click first insider tip button using the ID from source
        tip_btn = page.locator('#tip-toggle-1')
        if await tip_btn.count() > 0:
            await tip_btn.scroll_into_view_if_needed()
            await tip_btn.click()
            print("  Clicked #tip-toggle-1")
        else:
            tip_btn = page.locator('button:has-text("Insider tip")').first
            if await tip_btn.count() > 0:
                await tip_btn.scroll_into_view_if_needed()
                await tip_btn.click()
                print("  Clicked 'Insider tip' button (text fallback)")
        
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
    print(f"Route 1: '{route_names[0] if len(route_names)>0 else 'unknown'}' — First stop: '{first_stop_r1}'")
    print(f"Route 2: '{route_names[1] if len(route_names)>1 else 'unknown'}' — First stop: '{first_stop_r2}'")
    print(f"Route 3: '{route_names[2] if len(route_names)>2 else 'unknown'}' — First stop: '{first_stop_r3}'")
    print()
    for fname in ['01-landing.png', '02-form-filled.png', '03-loading.png', '04-route.png', '05-carousel.png', '06-insider-tip.png', '07-sticky-button.png']:
        fpath = os.path.join(ASSETS_DIR, fname)
        if os.path.exists(fpath):
            print(f"  ✅ {fname}: {os.path.getsize(fpath):,} bytes")
        else:
            print(f"  ❌ {fname}: MISSING")

if __name__ == "__main__":
    asyncio.run(run())
