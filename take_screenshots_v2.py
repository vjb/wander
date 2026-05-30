#!/usr/bin/env python3
"""
Wander V2 Screenshot Script
Takes all 7 screenshots as specified for the V2 app with 3-route carousel.
"""
import asyncio
import os
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

ASSETS_DIR = r"C:\Users\vjbel\hacks\wander\assets"
BASE_URL = "http://localhost:3000"

async def run():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path=r"C:\Users\vjbel\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe"
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        def file_size(path):
            try:
                return os.path.getsize(path)
            except:
                return 0

        # ── SCREENSHOT 1: Landing screen ─────────────────────────────────────
        print("📸 Screenshot 1: Landing screen...")
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)
        
        # Capture page info
        title = await page.title()
        print(f"  Page title: {title}")
        
        s1 = os.path.join(ASSETS_DIR, "01-landing.png")
        await page.screenshot(path=s1, full_page=True)
        sz1 = file_size(s1)
        print(f"  ✅ Saved {s1} ({sz1:,} bytes)")
        results.append({"file": s1, "size": sz1, "desc": f"Landing screen. Title: {title}"})

        # ── SCREENSHOT 2: Form filled ─────────────────────────────────────────
        print("\n📸 Screenshot 2: Filling form...")
        
        # Get all inputs for debugging
        inputs = await page.locator('input').all()
        print(f"  Found {len(inputs)} input elements")
        for i, inp in enumerate(inputs[:5]):
            placeholder = await inp.get_attribute('placeholder') or ''
            type_attr = await inp.get_attribute('type') or 'text'
            print(f"  Input {i}: type={type_attr}, placeholder={placeholder[:50]}")
        
        # Fill start location
        start_selectors = [
            'input[placeholder*="Starting"]',
            'input[placeholder*="starting"]',
            'input[placeholder*="Start"]',
            'input[placeholder*="from"]',
            'input[placeholder*="From"]',
            'input[placeholder*="Hell"]',
        ]
        start_filled = False
        for sel in start_selectors:
            try:
                el = page.locator(sel).first
                if await el.count() > 0:
                    await el.click()
                    await el.fill("Hell's Kitchen, NYC")
                    print(f"  Start field filled with selector: {sel}")
                    start_filled = True
                    break
            except Exception as e:
                pass
        
        if not start_filled:
            print("  Trying first text input for start...")
            all_inputs = await page.locator('input[type="text"], input:not([type])').all()
            if all_inputs:
                await all_inputs[0].click()
                await all_inputs[0].fill("Hell's Kitchen, NYC")
                print("  Filled first text input")

        await page.wait_for_timeout(400)
        
        # Fill end location
        end_selectors = [
            'input[placeholder*="Ending"]',
            'input[placeholder*="ending"]',
            'input[placeholder*="End"]',
            'input[placeholder*="Destination"]',
            'input[placeholder*="destination"]',
            'input[placeholder*="to"]',
            'input[placeholder*="Flatiron"]',
        ]
        end_filled = False
        for sel in end_selectors:
            try:
                el = page.locator(sel).first
                if await el.count() > 0:
                    await el.click()
                    await el.fill("Flatiron District, NYC")
                    print(f"  End field filled with selector: {sel}")
                    end_filled = True
                    break
            except:
                pass
        
        if not end_filled:
            print("  Trying second text input for end...")
            all_inputs = await page.locator('input[type="text"], input:not([type])').all()
            if len(all_inputs) >= 2:
                await all_inputs[1].click()
                await all_inputs[1].fill("Flatiron District, NYC")
                print("  Filled second text input")

        await page.wait_for_timeout(400)
        
        # Click Green & Scenic vibe button
        vibe_selectors = [
            'button:has-text("🌿")',
            '*:has-text("🌿")',
            'button:has-text("Green")',
            '[class*="vibe"]:has-text("Green")',
        ]
        vibe_clicked = False
        for sel in vibe_selectors:
            try:
                el = page.locator(sel).first
                if await el.count() > 0:
                    await el.click(timeout=5000)
                    text = await el.text_content()
                    print(f"  Vibe clicked: {text.strip()[:50]} (selector: {sel})")
                    vibe_clicked = True
                    break
            except Exception as e:
                print(f"  Vibe selector {sel} failed: {e}")
        
        if not vibe_clicked:
            # Debug: list all buttons
            buttons = await page.locator('button').all()
            print(f"  Available buttons ({len(buttons)}):")
            for b in buttons[:15]:
                txt = await b.text_content()
                print(f"    '{txt.strip()[:60]}'")

        await page.wait_for_timeout(600)
        
        s2 = os.path.join(ASSETS_DIR, "02-form-filled.png")
        await page.screenshot(path=s2, full_page=True)
        sz2 = file_size(s2)
        print(f"  ✅ Saved {s2} ({sz2:,} bytes)")
        results.append({"file": s2, "size": sz2, "desc": "Form filled: Hell's Kitchen → Flatiron, Green & Scenic selected"})

        # ── SCREENSHOT 3: Loading screen ──────────────────────────────────────
        print("\n📸 Screenshot 3: Clicking generate, capturing loading state...")
        
        # Find and click the generate button
        gen_selectors = [
            'button:has-text("Generate three routes")',
            'button:has-text("Generate")',
            'button:has-text("generate")',
            'button[type="submit"]',
            'form button',
        ]
        gen_clicked = False
        for sel in gen_selectors:
            try:
                el = page.locator(sel).first
                if await el.count() > 0:
                    txt = await el.text_content()
                    print(f"  Clicking generate button: '{txt.strip()[:60]}'")
                    await el.click(timeout=5000)
                    gen_clicked = True
                    break
            except Exception as e:
                print(f"  Generate selector {sel} failed: {e}")
        
        if not gen_clicked:
            print("  Trying form submit via keyboard...")
            await page.keyboard.press("Enter")
        
        # Wait ~600ms to catch loading state
        await page.wait_for_timeout(600)
        
        s3 = os.path.join(ASSETS_DIR, "03-loading.png")
        await page.screenshot(path=s3, full_page=True)
        sz3 = file_size(s3)
        print(f"  ✅ Saved {s3} ({sz3:,} bytes)")
        results.append({"file": s3, "size": sz3, "desc": "Loading screen with animated text"})

        # ── SCREENSHOT 4: Three-route result ──────────────────────────────────
        print("\n📸 Screenshot 4: Waiting for routes to load (up to 60s)...")
        
        route_loaded = False
        route_tab_texts = []
        for attempt in range(60):
            await page.wait_for_timeout(1000)
            
            # Check for Start Wandering button (indicates routes loaded)
            try:
                start_btn = page.locator('button:has-text("Start Wandering"), button:has-text("Wandering")')
                if await start_btn.count() > 0:
                    print(f"  ✅ 'Start Wandering' button found after {attempt+1}s")
                    route_loaded = True
                    break
            except:
                pass
            
            # Also check for stop cards
            try:
                cards = page.locator('[class*="stop"], [class*="StopCard"], [class*="stop-card"]')
                if await cards.count() >= 2:
                    print(f"  ✅ Stop cards found ({await cards.count()}) after {attempt+1}s")
                    route_loaded = True
                    break
            except:
                pass
            
            if attempt % 10 == 0:
                print(f"  Still waiting... {attempt}s elapsed")
        
        if not route_loaded:
            print("  ⚠️ Routes may not be fully loaded after 60s")
        
        await page.wait_for_timeout(2000)  # Let animations settle
        
        # Collect route names and tab info
        try:
            # Try to find carousel/tab buttons
            all_buttons = await page.locator('button').all()
            btn_texts = []
            for b in all_buttons:
                txt = await b.text_content()
                if txt:
                    btn_texts.append(txt.strip())
            print(f"  All buttons: {btn_texts[:20]}")
            
            # Look for route tab elements (numbered or named)
            # These are likely in a tab bar or carousel nav
            # Try common selectors
            for tab_sel in ['[role="tab"]', '[class*="tab"]', '[class*="Tab"]', '[class*="route-tab"]', '[class*="RouteTab"]', '[class*="carousel"]']:
                tabs = page.locator(tab_sel)
                count = await tabs.count()
                if count >= 2:
                    for i in range(count):
                        txt = await tabs.nth(i).text_content()
                        route_tab_texts.append(txt.strip() if txt else f"Tab {i+1}")
                    print(f"  Found {count} tabs with selector '{tab_sel}': {route_tab_texts}")
                    break
        except Exception as e:
            print(f"  Error getting tabs: {e}")
        
        # Get route title
        route_title_r1 = ""
        for title_sel in ['em', 'i', '[class*="route-name"]', '[class*="routeName"]', '[class*="RouteTitle"]', 'h2.italic', 'h2 em', 'p em']:
            try:
                el = page.locator(title_sel).first
                if await el.count() > 0:
                    txt = await el.text_content()
                    if txt and len(txt.strip()) > 3:
                        route_title_r1 = txt.strip()
                        print(f"  Route title (selector {title_sel}): {route_title_r1}")
                        break
            except:
                pass
        
        # Get first stop name
        first_stop_r1 = ""
        for stop_sel in ['[class*="stop-name"]', '[class*="StopName"]', '[class*="stop"] h3', '[class*="stop"] h4', '[class*="card"] h3', '[class*="card"] h4', '[class*="Stop"] h3']:
            try:
                el = page.locator(stop_sel).first
                if await el.count() > 0:
                    txt = await el.text_content()
                    if txt and len(txt.strip()) > 2:
                        first_stop_r1 = txt.strip()
                        print(f"  First stop R1 (selector {stop_sel}): {first_stop_r1}")
                        break
            except:
                pass
        
        s4 = os.path.join(ASSETS_DIR, "04-route.png")
        await page.screenshot(path=s4, full_page=True)
        sz4 = file_size(s4)
        print(f"  ✅ Saved {s4} ({sz4:,} bytes)")
        results.append({
            "file": s4, "size": sz4, 
            "desc": f"Full route result. Route 1 title: '{route_title_r1}'. First stop: '{first_stop_r1}'",
            "routeTabs": route_tab_texts,
            "routeTitle_R1": route_title_r1,
            "firstStop_R1": first_stop_r1
        })

        # ── SCREENSHOT 5: Carousel tab 2 ──────────────────────────────────────
        print("\n📸 Screenshot 5: Clicking Route 2 tab...")
        
        tab2_clicked = False
        tab_el = None
        
        # Try to find tabs
        for tab_sel in ['[role="tab"]', '[class*="tab"]', '[class*="Tab"]', '[class*="route-tab"]', '[class*="RouteTab"]']:
            tabs = page.locator(tab_sel)
            count = await tabs.count()
            if count >= 2:
                tab_el = tabs.nth(1)
                tab2_txt = await tab_el.text_content()
                await tab_el.click()
                print(f"  Clicked tab 2 ('{tab2_txt.strip()[:40]}') with selector '{tab_sel}'")
                tab2_clicked = True
                break
        
        if not tab2_clicked:
            print("  ⚠️ Tab 2 not found via role/class, trying button approach...")
            # Look for numbered buttons or route name buttons in a nav area
            buttons = await page.locator('button').all()
            for i, b in enumerate(buttons):
                txt = await b.text_content()
                cls = await b.get_attribute('class') or ''
                if txt and ('2' in txt or 'route' in txt.lower() or 'tab' in cls.lower()):
                    await b.click()
                    print(f"  Clicked button: '{txt.strip()[:40]}'")
                    tab2_clicked = True
                    break
        
        await page.wait_for_timeout(1500)
        
        # Get Route 2 first stop
        first_stop_r2 = ""
        for stop_sel in ['[class*="stop-name"]', '[class*="StopName"]', '[class*="stop"] h3', '[class*="stop"] h4', '[class*="card"] h3', '[class*="card"] h4']:
            try:
                el = page.locator(stop_sel).first
                if await el.count() > 0:
                    txt = await el.text_content()
                    if txt and len(txt.strip()) > 2:
                        first_stop_r2 = txt.strip()
                        print(f"  First stop R2: {first_stop_r2}")
                        break
            except:
                pass
        
        # Get Route 2 title
        route_title_r2 = ""
        for title_sel in ['em', 'i', '[class*="route-name"]', '[class*="RouteTitle"]', 'h2 em']:
            try:
                el = page.locator(title_sel).first
                if await el.count() > 0:
                    txt = await el.text_content()
                    if txt and len(txt.strip()) > 3:
                        route_title_r2 = txt.strip()
                        print(f"  Route 2 title: {route_title_r2}")
                        break
            except:
                pass
        
        s5 = os.path.join(ASSETS_DIR, "05-carousel.png")
        await page.screenshot(path=s5, full_page=True)
        sz5 = file_size(s5)
        print(f"  ✅ Saved {s5} ({sz5:,} bytes)")
        results.append({
            "file": s5, "size": sz5, 
            "desc": f"Route 2 carousel tab. Title: '{route_title_r2}'. First stop: '{first_stop_r2}'",
            "routeTitle_R2": route_title_r2,
            "firstStop_R2": first_stop_r2
        })

        # ── SCREENSHOT 6: Insider tip ──────────────────────────────────────────
        print("\n📸 Screenshot 6: Insider tip...")
        
        # Click back to Route 1
        for tab_sel in ['[role="tab"]', '[class*="tab"]', '[class*="Tab"]', '[class*="route-tab"]']:
            tabs = page.locator(tab_sel)
            count = await tabs.count()
            if count >= 1:
                await tabs.nth(0).click()
                print(f"  Clicked back to Route 1 (selector: {tab_sel})")
                break
        
        await page.wait_for_timeout(1000)
        
        # Find and click the insider tip button on the FIRST stop
        tip_selectors = [
            'button:has-text("Insider tip")',
            'button:has-text("insider tip")',
            'button:has-text("Insider Tip")',
            'button:has-text("Insider")',
            '*:has-text("Insider tip")',
            '[class*="tip"] button',
            'button[class*="tip"]',
            'button[class*="Tip"]',
        ]
        tip_clicked = False
        for sel in tip_selectors:
            try:
                el = page.locator(sel).first
                if await el.count() > 0:
                    await el.scroll_into_view_if_needed()
                    await page.wait_for_timeout(300)
                    txt = await el.text_content()
                    await el.click(timeout=8000)
                    print(f"  Insider tip clicked: '{txt.strip()[:50]}' (selector: {sel})")
                    tip_clicked = True
                    break
            except Exception as e:
                print(f"  Tip selector {sel} failed: {str(e)[:80]}")
        
        if not tip_clicked:
            print("  ⚠️ Insider tip button not found")
            # Print all buttons for debugging
            buttons = await page.locator('button').all()
            print(f"  All {len(buttons)} buttons:")
            for b in buttons:
                txt = await b.text_content()
                if txt:
                    print(f"    '{txt.strip()[:60]}'")
        
        await page.wait_for_timeout(1000)
        
        s6 = os.path.join(ASSETS_DIR, "06-insider-tip.png")
        await page.screenshot(path=s6, full_page=True)
        sz6 = file_size(s6)
        print(f"  ✅ Saved {s6} ({sz6:,} bytes)")
        results.append({"file": s6, "size": sz6, "desc": f"Insider tip expanded (clicked: {tip_clicked})"})

        # ── SCREENSHOT 7: Sticky button close-up ──────────────────────────────
        print("\n📸 Screenshot 7: Sticky button (scrolled to bottom)...")
        
        # Scroll to bottom
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(800)
        
        # Take viewport screenshot (not full page) to show bottom
        s7 = os.path.join(ASSETS_DIR, "07-sticky-button.png")
        await page.screenshot(path=s7, full_page=False)
        sz7 = file_size(s7)
        print(f"  ✅ Saved {s7} ({sz7:,} bytes)")
        results.append({"file": s7, "size": sz7, "desc": "Bottom viewport showing sticky 'Start Wandering' button"})

        await browser.close()

    print("\n\n===RESULTS_JSON===")
    print(json.dumps(results, indent=2, ensure_ascii=False))
    return results

if __name__ == "__main__":
    asyncio.run(run())
