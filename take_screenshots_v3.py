#!/usr/bin/env python3
"""
Precise V3 screenshot script for Wander app.
Uses exact element IDs from the source code.
"""
import asyncio
import os
import json
import sys

from playwright.async_api import async_playwright

ASSETS_DIR = r"C:\Users\vjbel\hacks\wander\assets"
BASE_URL = "http://localhost:3000"

# Chromium from ms-playwright cache
CHROME_PATH = r"C:\Users\vjbel\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe"

async def run():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    results = {}

    print("Launching browser...", flush=True)
    async with async_playwright() as p:
        # Use the cached Chromium if available, otherwise let playwright find it
        launch_opts = {"headless": True}
        if os.path.exists(CHROME_PATH):
            launch_opts["executable_path"] = CHROME_PATH
            print(f"Using Chromium: {CHROME_PATH}", flush=True)
        
        browser = await p.chromium.launch(**launch_opts)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # ─────────────────────────────────────────────────────────────────────
        # STEP 1: Landing
        # ─────────────────────────────────────────────────────────────────────
        print("\n=== STEP 1: Landing ===", flush=True)
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        title = await page.title()
        body_text = await page.evaluate("() => document.body.innerText.substring(0, 200)")
        print(f"Title: {title}", flush=True)
        print(f"Body: {body_text[:150]}", flush=True)

        path1 = os.path.join(ASSETS_DIR, "01-landing.png")
        await page.screenshot(path=path1, full_page=True)
        size1 = os.path.getsize(path1)
        print(f"✅ {path1} ({size1:,} bytes)", flush=True)
        results["01-landing"] = {"path": path1, "size": size1, "title": title}

        # ─────────────────────────────────────────────────────────────────────
        # STEP 2: Fill Form
        # ─────────────────────────────────────────────────────────────────────
        print("\n=== STEP 2: Fill form ===", flush=True)

        # Fill start field (id="start-location")
        start_input = page.locator('#start-location')
        if await start_input.count() > 0:
            await start_input.click()
            await start_input.fill("Hell's Kitchen, NYC")
            print("✅ Start field filled (#start-location)", flush=True)
        else:
            # Fallback: use placeholder
            fallback = page.locator('input[placeholder*="Starting"]').first
            await fallback.click()
            await fallback.fill("Hell's Kitchen, NYC")
            print("✅ Start field filled (fallback placeholder)", flush=True)

        await page.wait_for_timeout(400)

        # Fill end field (id="end-location")
        end_input = page.locator('#end-location')
        if await end_input.count() > 0:
            await end_input.click()
            await end_input.fill("Flatiron District, NYC")
            print("✅ End field filled (#end-location)", flush=True)
        else:
            fallback = page.locator('input[placeholder*="Ending"]').first
            await fallback.click()
            await fallback.fill("Flatiron District, NYC")
            print("✅ End field filled (fallback placeholder)", flush=True)

        await page.wait_for_timeout(400)

        # Click Green & Scenic vibe button
        # id="vibe-green-&-scenic" (from: v.id.toLowerCase().replace(/[\s&]+/g, "-"))
        # "Green & Scenic" -> "green-&-scenic"
        vibe_btn = page.locator('#vibe-green-\\&-scenic')
        vibe_count = await vibe_btn.count()
        print(f"Vibe btn count (exact id): {vibe_count}", flush=True)
        
        if vibe_count > 0:
            await vibe_btn.click()
            print("✅ Green & Scenic clicked (#vibe-green-&-scenic)", flush=True)
        else:
            # Try by text content
            vibe_btn2 = page.get_by_text("Green & Scenic", exact=False).first
            if await vibe_btn2.count() > 0:
                await vibe_btn2.click()
                print("✅ Green & Scenic clicked (by text)", flush=True)
            else:
                # Try JS
                result = await page.evaluate("""() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const b = btns.find(b => b.textContent.includes('🌿') || 
                                            b.textContent.includes('Green'));
                    if (b) { b.click(); return b.textContent.trim(); }
                    return 'NOT FOUND: ' + btns.map(b => b.textContent.trim()).slice(0,15).join(' | ');
                }""")
                print(f"Vibe JS result: {result}", flush=True)

        await page.wait_for_timeout(800)

        path2 = os.path.join(ASSETS_DIR, "02-form-filled.png")
        await page.screenshot(path=path2, full_page=True)
        size2 = os.path.getsize(path2)
        print(f"✅ {path2} ({size2:,} bytes)", flush=True)
        results["02-form-filled"] = {"path": path2, "size": size2}

        # ─────────────────────────────────────────────────────────────────────
        # STEP 3: Generate Routes & Wait
        # ─────────────────────────────────────────────────────────────────────
        print("\n=== STEP 3: Click Generate ===", flush=True)

        # Generate button id="wander-button"
        gen_btn = page.locator('#wander-button')
        if await gen_btn.count() > 0:
            btn_text = await gen_btn.inner_text()
            print(f"Found #wander-button: '{btn_text}'", flush=True)
            is_disabled = await gen_btn.get_attribute("disabled")
            print(f"Button disabled: {is_disabled}", flush=True)
            if is_disabled is None:  # not disabled
                await gen_btn.click()
                print("✅ Generate button clicked", flush=True)
            else:
                print("⚠️ Button is disabled - form may not be complete!", flush=True)
                # Check form state
                form_state = await page.evaluate("""() => ({
                    startVal: document.getElementById('start-location')?.value,
                    endVal: document.getElementById('end-location')?.value,
                    allBtnText: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
                })""")
                print(f"Form state: {json.dumps(form_state)}", flush=True)
                # Try clicking anyway
                await gen_btn.click(force=True)
        else:
            # Fallback: look for "Generate" text button
            gen_btn2 = page.get_by_text("Generate three routes")
            if await gen_btn2.count() > 0:
                await gen_btn2.click()
                print("✅ Generate clicked (by text)", flush=True)
            else:
                gen_result = await page.evaluate("""() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const b = btns.find(b => b.textContent.toLowerCase().includes('generat') ||
                                            b.textContent.toLowerCase().includes('wander'));
                    if (b) { b.click(); return b.textContent.trim(); }
                    return 'NOT FOUND';
                }""")
                print(f"Generate JS: {gen_result}", flush=True)

        print("Waiting up to 90s for routes to load...", flush=True)

        # Wait for "Three routes found" text or "Start Wandering" button
        route_loaded = False
        for i in range(90):
            await page.wait_for_timeout(1000)
            
            state = await page.evaluate("""() => {
                const text = document.body.innerText;
                const hasRouteFound = text.includes('Three routes found');
                const hasStartWandering = document.getElementById('start-wandering-button') !== null;
                const hasRouteTabs = document.getElementById('route-tab-0') !== null;
                const isLoading = text.includes('Reading the streets') || 
                                  text.includes('Curating three paths') ||
                                  text.includes('Consulting the locals') ||
                                  text.includes('Perfecting the timing') ||
                                  text.includes('Uncovering hidden gems') ||
                                  text.includes('Almost ready to wander');
                const hasStarRating = text.includes('★');
                return {
                    hasRouteFound, hasStartWandering, hasRouteTabs,
                    isLoading, hasStarRating,
                    preview: text.substring(0, 300)
                };
            }""")
            
            if i % 10 == 0 or state['hasRouteTabs']:
                print(f"[{i}s] Loading:{state['isLoading']} RoutesFound:{state['hasRouteFound']} Tabs:{state['hasRouteTabs']} Star:{state['hasStarRating']}", flush=True)
            
            if state['hasRouteTabs'] or state['hasRouteFound']:
                print(f"✅ Routes loaded at {i}s!", flush=True)
                route_loaded = True
                break

        if not route_loaded:
            print("⚠️ Routes not detected after 90s, taking screenshot anyway", flush=True)

        await page.wait_for_timeout(2000)  # Let animations settle

        # Gather detailed info about the route screen
        route_detail = await page.evaluate("""() => {
            const text = document.body.innerText;
            
            // Get tab names
            const tab0 = document.getElementById('route-tab-0');
            const tab1 = document.getElementById('route-tab-1');
            const tab2 = document.getElementById('route-tab-2');
            const tabNames = [tab0, tab1, tab2]
                .filter(t => t)
                .map(t => t.textContent.trim());
            
            // Get star ratings
            const starMatches = text.match(/★\\s*[\\d.]+/g) || [];
            
            // Get all visible button texts
            const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t);
            
            return {
                tabNames,
                starMatches,
                hasStarSymbol: text.includes('★'),
                hasThreeRoutesFound: text.includes('Three routes found'),
                buttons: buttons.slice(0, 20),
                bodyPreview: text.substring(0, 500)
            };
        }""")

        print(f"\nRoute detail:", flush=True)
        print(f"  Tab names: {route_detail['tabNames']}", flush=True)
        print(f"  Star ratings: {route_detail['starMatches']}", flush=True)
        print(f"  Has ★ symbol: {route_detail['hasStarSymbol']}", flush=True)
        print(f"  Three routes found text: {route_detail['hasThreeRoutesFound']}", flush=True)
        print(f"  Buttons: {route_detail['buttons']}", flush=True)
        print(f"  Body preview: {route_detail['bodyPreview'][:300]}", flush=True)

        path4 = os.path.join(ASSETS_DIR, "04-route.png")
        await page.screenshot(path=path4, full_page=True)
        size4 = os.path.getsize(path4)
        print(f"✅ {path4} ({size4:,} bytes)", flush=True)
        results["04-route"] = {
            "path": path4, "size": size4,
            "tab_names": route_detail['tabNames'],
            "star_ratings": route_detail['starMatches'],
            "has_star_symbol": route_detail['hasStarSymbol'],
            "route_loaded": route_loaded
        }

        # ─────────────────────────────────────────────────────────────────────
        # STEP 4: Click Second Tab
        # ─────────────────────────────────────────────────────────────────────
        print("\n=== STEP 4: Click second route tab ===", flush=True)

        # Tab 2 has id="route-tab-1"
        tab2 = page.locator('#route-tab-1')
        if await tab2.count() > 0:
            tab_text = await tab2.inner_text()
            await tab2.click()
            print(f"✅ Clicked #route-tab-1: '{tab_text}'", flush=True)
        else:
            # Fallback: JS click by tab index
            result = await page.evaluate("""() => {
                const tab = document.getElementById('route-tab-1');
                if (tab) { tab.click(); return 'clicked: ' + tab.textContent.trim(); }
                // Try querySelectorAll approach
                const btns = document.querySelectorAll('[id^="route-tab-"]');
                if (btns.length >= 2) { btns[1].click(); return 'clicked btn[1]: ' + btns[1].textContent.trim(); }
                return 'NOT FOUND';
            }""")
            print(f"Tab2 JS: {result}", flush=True)

        await page.wait_for_timeout(1500)

        # Get updated info after tab switch
        tab2_detail = await page.evaluate("""() => {
            const text = document.body.innerText;
            const tab1el = document.getElementById('route-tab-1');
            return {
                activeTab: tab1el ? tab1el.textContent.trim() : 'unknown',
                hasStarSymbol: text.includes('★'),
                starMatches: text.match(/★\\s*[\\d.]+/g) || [],
                bodyPreview: text.substring(0, 300)
            };
        }""")
        print(f"After tab2 click - Active: {tab2_detail['activeTab']}, Stars: {tab2_detail['starMatches']}", flush=True)

        path5 = os.path.join(ASSETS_DIR, "05-carousel.png")
        await page.screenshot(path=path5, full_page=True)
        size5 = os.path.getsize(path5)
        print(f"✅ {path5} ({size5:,} bytes)", flush=True)
        results["05-carousel"] = {"path": path5, "size": size5}

        await browser.close()

    # ─────────────────────────────────────────────────────────────────────────
    # Final Report
    # ─────────────────────────────────────────────────────────────────────────
    print("\n" + "="*60, flush=True)
    print("FINAL REPORT", flush=True)
    print("="*60, flush=True)

    for key, info in results.items():
        print(f"\n📸 {key}:", flush=True)
        print(f"   Path: {info['path']}", flush=True)
        print(f"   Size: {info.get('size', 0):,} bytes", flush=True)
    
    route_info = results.get("04-route", {})
    print(f"\nCarousel tab names: {route_info.get('tab_names', [])}", flush=True)
    print(f"Star rating badge visible: {'YES' if route_info.get('has_star_symbol') else 'NO'}", flush=True)
    print(f"Star ratings found: {route_info.get('star_ratings', [])}", flush=True)
    print(f"Route loaded successfully: {route_info.get('route_loaded', False)}", flush=True)

    print("\n===JSON_RESULTS===", flush=True)
    print(json.dumps(results, indent=2), flush=True)

if __name__ == "__main__":
    asyncio.run(run())
