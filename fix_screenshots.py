#!/usr/bin/env python3
"""
Fix script to retake screenshots 05 (carousel tab 2) and get first stop names.
Based on the discovered UI: route tabs are buttons with the route name as text.
Routes: 'The Urban Oasis Trail', 'Culture & Canopy Circuit', 'Zen to Zest Express'
"""
import asyncio
import os
import json
from playwright.async_api import async_playwright

ASSETS_DIR = r"C:\Users\vjbel\hacks\wander\assets"
BASE_URL = "http://localhost:3000"
ROUTE_NAMES = ['The Urban Oasis Trail', 'Culture & Canopy Circuit', 'Zen to Zest Express']

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

        # Navigate and fill form first
        print("Navigating to app...")
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)
        
        # Fill form
        await page.locator('input[placeholder*="Starting"]').fill("Hell's Kitchen, NYC")
        await page.wait_for_timeout(300)
        await page.locator('input[placeholder*="Ending"]').fill("Flatiron District, NYC")
        await page.wait_for_timeout(300)
        await page.locator('button:has-text("🌿")').click()
        await page.wait_for_timeout(400)
        
        # Click generate
        print("Clicking generate...")
        await page.locator('button:has-text("Generate three routes")').click()
        
        # Wait for routes
        print("Waiting for routes...")
        await page.wait_for_selector('button:has-text("Start Wandering")', timeout=60000)
        await page.wait_for_timeout(2000)
        
        # ── Confirm route names and get first stop on route 1 ──────────────
        print("\n=== ROUTE DISCOVERY ===")
        
        # The route tabs ARE the route name buttons
        route1_btn = page.locator(f'button:has-text("The Urban Oasis Trail")').first
        route2_btn = page.locator(f'button:has-text("Culture & Canopy Circuit")').first
        route3_btn = page.locator(f'button:has-text("Zen to Zest Express")').first
        
        print(f"Route 1 found: {await route1_btn.count() > 0}")
        print(f"Route 2 found: {await route2_btn.count() > 0}")
        print(f"Route 3 found: {await route3_btn.count() > 0}")
        
        # Get current state - Route 1 should be active
        # Get all text content to find stop names
        page_text = await page.evaluate("document.body.innerText")
        print(f"\nPage text (first 800 chars):\n{page_text[:800]}")
        
        # Try to find stop names specifically
        # Look for numbered items (1. Stop Name, 2. Stop Name pattern)
        import re
        stop_matches = re.findall(r'(?:^|\n)(\d+)\s*[\.\)]\s*(.{5,50}?)(?:\n|$)', page_text)
        print(f"\nNumbered items found: {stop_matches[:10]}")
        
        # Also try h3/h4 elements
        h3_els = await page.locator('h3').all()
        h3_texts = []
        for el in h3_els[:10]:
            txt = await el.text_content()
            h3_texts.append(txt.strip() if txt else '')
        print(f"\nh3 elements: {h3_texts}")
        
        h4_els = await page.locator('h4').all()
        h4_texts = []
        for el in h4_els[:10]:
            txt = await el.text_content()
            h4_texts.append(txt.strip() if txt else '')
        print(f"h4 elements: {h4_texts}")
        
        # Try paragraph elements in stop cards
        p_els = await page.locator('[class*="stop"] p, [class*="Stop"] p, [class*="card"] p, [class*="Card"] p').all()
        p_texts = []
        for el in p_els[:10]:
            txt = await el.text_content()
            p_texts.append(txt.strip()[:80] if txt else '')
        print(f"\np elements in cards: {p_texts}")
        
        # ── RETAKE Screenshot 4 with better stop info ─────────────────────
        print("\n\n📸 RE-TAKING Screenshot 4: Route 1 full page...")
        
        # Make sure Route 1 is active
        if await route1_btn.count() > 0:
            await route1_btn.click()
            await page.wait_for_timeout(1500)
        
        s4 = os.path.join(ASSETS_DIR, "04-route.png")
        await page.screenshot(path=s4, full_page=True)
        print(f"  ✅ {s4} ({file_size(s4):,} bytes)")
        
        # ── RETAKE Screenshot 5: Route 2 ─────────────────────────────────
        print("\n📸 RE-TAKING Screenshot 5: Route 2 tab...")
        
        if await route2_btn.count() > 0:
            await route2_btn.click()
            print("  Clicked 'Culture & Canopy Circuit' button")
        else:
            print("  ⚠️ Route 2 button not found!")
        
        await page.wait_for_timeout(1500)
        
        # Get Route 2 content
        page_text_r2 = await page.evaluate("document.body.innerText")
        print(f"\nRoute 2 text (first 500 chars):\n{page_text_r2[:500]}")
        
        s5 = os.path.join(ASSETS_DIR, "05-carousel.png")
        await page.screenshot(path=s5, full_page=True)
        sz5 = file_size(s5)
        print(f"  ✅ {s5} ({sz5:,} bytes)")
        
        # Check if route 2 is actually different from route 1
        print(f"\nRoute 1 screenshot size: {file_size(os.path.join(ASSETS_DIR, '04-route.png')):,}")
        print(f"Route 2 screenshot size: {sz5:,}")
        if file_size(os.path.join(ASSETS_DIR, '04-route.png')) == sz5:
            print("  ⚠️ WARNING: Sizes are identical - route tab may not have changed!")
        
        # ── Also check Route 3 for completeness ──────────────────────────
        if await route3_btn.count() > 0:
            await route3_btn.click()
            await page.wait_for_timeout(1500)
            page_text_r3 = await page.evaluate("document.body.innerText")
            print(f"\nRoute 3 text (first 500 chars):\n{page_text_r3[:500]}")
        
        # ── Go back to Route 1, get insider tip ──────────────────────────
        print("\n📸 RE-TAKING Screenshot 6: Insider tip...")
        if await route1_btn.count() > 0:
            await route1_btn.click()
            await page.wait_for_timeout(1000)
        
        # Click insider tip
        tip_btn = page.locator('button:has-text("Insider tip")').first
        if await tip_btn.count() > 0:
            await tip_btn.scroll_into_view_if_needed()
            await tip_btn.click()
            print("  Clicked 'Insider tip' button")
        
        await page.wait_for_timeout(800)
        s6 = os.path.join(ASSETS_DIR, "06-insider-tip.png")
        await page.screenshot(path=s6, full_page=True)
        print(f"  ✅ {s6} ({file_size(s6):,} bytes)")
        
        # ── Sticky button ─────────────────────────────────────────────────
        print("\n📸 RE-TAKING Screenshot 7: Sticky button...")
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(800)
        s7 = os.path.join(ASSETS_DIR, "07-sticky-button.png")
        await page.screenshot(path=s7, full_page=False)
        print(f"  ✅ {s7} ({file_size(s7):,} bytes)")
        
        await browser.close()
    
    print("\n\n=== FINAL ASSET STATUS ===")
    for fname in ['01-landing.png', '02-form-filled.png', '03-loading.png', '04-route.png', '05-carousel.png', '06-insider-tip.png', '07-sticky-button.png']:
        fpath = os.path.join(ASSETS_DIR, fname)
        if os.path.exists(fpath):
            print(f"  ✅ {fname}: {os.path.getsize(fpath):,} bytes")
        else:
            print(f"  ❌ {fname}: MISSING")

if __name__ == "__main__":
    asyncio.run(run())
