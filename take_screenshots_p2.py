#!/usr/bin/env python3
"""
Screenshot script - Part 2: Get route and insider tip screenshots.
This assumes the form has already been submitted and we need to wait for the route.
"""
import asyncio
import os
import sys
import time

from playwright.async_api import async_playwright

ASSETS_DIR = r"C:\Users\vjbel\hacks\wander\assets"
BASE_URL = "http://localhost:3000"

async def run():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900}
        )
        page = await context.new_page()
        
        # Open landing page and fill form again
        print("Opening http://localhost:3000...")
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)
        
        # Fill start field
        start_field = page.locator('input[placeholder*="Starting"]').first
        await start_field.click()
        await start_field.fill("Hell's Kitchen, NYC")
        await page.wait_for_timeout(300)
        
        # Fill end field
        end_field = page.locator('input[placeholder*="Ending"]').first
        await end_field.click()
        await end_field.fill("Flatiron District, NYC")
        await page.wait_for_timeout(300)
        
        # Click Green & Scenic vibe
        vibe = page.locator('button:has-text("Green & Scenic")').first
        await vibe.click()
        await page.wait_for_timeout(500)
        
        # Click Begin wandering
        print("Submitting form...")
        submit = page.locator('button:has-text("Begin wandering")').first
        await submit.click()
        
        # Wait for the loading screen to appear first
        await page.wait_for_timeout(1500)
        
        # Now wait up to 60 seconds for the route to load
        # We look for content that is NOT on the loading screen
        print("Waiting for route to fully load (up to 60 seconds)...")
        
        max_wait = 60  # seconds
        start_time = time.time()
        route_loaded = False
        
        while time.time() - start_time < max_wait:
            await page.wait_for_timeout(2000)
            
            # Check page content
            content = await page.content()
            
            # Check if loading indicators are gone
            loading_phrases = [
                "Reading the streets",
                "Uncovering the hidden gems",
                "Plotting your path",
                "GPT-4o is consulting",
                "Crafting your adventure",
            ]
            
            is_loading = any(phrase in content for phrase in loading_phrases)
            
            # Also check if we have route content (stop numbers, etc.)
            route_phrases = ["insider tip", "Insider tip", "insider_tip", "stop-card", "route-card", "stop-number"]
            has_route = any(phrase.lower() in content.lower() for phrase in route_phrases)
            
            elapsed = time.time() - start_time
            print(f"  {elapsed:.0f}s elapsed - Loading: {is_loading}, Has route content: {has_route}")
            
            if not is_loading and has_route:
                route_loaded = True
                print("Route fully loaded!")
                break
            elif not is_loading:
                # Not loading but no obvious route... wait a bit more
                await page.wait_for_timeout(3000)
                content = await page.content()
                is_loading2 = any(phrase in content for phrase in loading_phrases)
                if not is_loading2:
                    route_loaded = True
                    print("Loading done (no clear route markers found, assuming loaded)")
                    break
        
        # Wait a bit more for animations to settle
        await page.wait_for_timeout(2000)
        
        # Take the route screenshot
        await page.screenshot(path=os.path.join(ASSETS_DIR, "04-route.png"), full_page=True)
        print(f"Saved: {os.path.join(ASSETS_DIR, '04-route.png')}")
        
        # Get page content to find what's there
        content = await page.content()
        print(f"\nContent snippet (first 2000 chars of body text):")
        # Try to get all text
        body_text = await page.evaluate("document.body.innerText")
        print(body_text[:2000] if len(body_text) > 2000 else body_text)
        
        # Try to find the route title
        route_title = "Unknown"
        for sel in ['h1', 'h2', '[class*="route-title"]', '[class*="title"]']:
            try:
                els = page.locator(sel)
                count = await els.count()
                for i in range(count):
                    el = els.nth(i)
                    text = (await el.inner_text()).strip()
                    if text and len(text) > 3:
                        route_title = text
                        print(f"\nFound potential title ({sel}): {text}")
                        break
                if route_title != "Unknown":
                    break
            except:
                pass
        
        # Find and click "Insider tip" button
        print("\nLooking for Insider tip button...")
        
        # First, dump all buttons on the page
        buttons_text = await page.evaluate("""
            () => {
                const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                return buttons.map(b => b.innerText || b.textContent).filter(t => t.trim()).slice(0, 30);
            }
        """)
        print(f"Buttons found: {buttons_text}")
        
        # Try various selectors for insider tip
        tip_selectors = [
            'button:has-text("Insider tip")',
            'button:has-text("Insider Tip")',
            'button:has-text("insider")',
            '[class*="insider"]',
            'button:has-text("tip")',
            'details summary',
            '[data-tip]',
        ]
        
        tip_clicked = False
        for sel in tip_selectors:
            try:
                el = page.locator(sel).first
                count = await el.count()
                if count > 0:
                    await el.scroll_into_view_if_needed()
                    await page.wait_for_timeout(300)
                    await el.click(timeout=5000)
                    tip_clicked = True
                    print(f"Clicked tip with: {sel}")
                    await page.wait_for_timeout(1000)
                    break
            except Exception as e:
                print(f"  Failed {sel}: {e}")
        
        if not tip_clicked:
            # Scroll down and try clicking any button with "tip" text
            await page.keyboard.press("End")
            await page.wait_for_timeout(500)
            print("Scrolled to bottom, trying again...")
            for sel in tip_selectors:
                try:
                    el = page.locator(sel).first
                    count = await el.count()
                    if count > 0:
                        await el.scroll_into_view_if_needed()
                        await el.click(timeout=5000)
                        tip_clicked = True
                        print(f"Clicked tip with: {sel} (after scroll)")
                        await page.wait_for_timeout(1000)
                        break
                except Exception as e:
                    pass
        
        await page.screenshot(path=os.path.join(ASSETS_DIR, "05-insider-tip.png"), full_page=True)
        print(f"Saved: {os.path.join(ASSETS_DIR, '05-insider-tip.png')}")
        
        await browser.close()
        
        print("\n=== FINAL SUMMARY ===")
        print(f"Route loaded: {route_loaded}")
        print(f"Route title: {route_title}")
        print(f"Insider tip clicked: {tip_clicked}")
        for fname in ["04-route.png", "05-insider-tip.png"]:
            fpath = os.path.join(ASSETS_DIR, fname)
            if os.path.exists(fpath):
                size = os.path.getsize(fpath)
                print(f"  ✓ {fpath} ({size:,} bytes)")
            else:
                print(f"  ✗ {fpath} (NOT FOUND)")

if __name__ == "__main__":
    asyncio.run(run())
