#!/usr/bin/env python3
"""
Screenshot script for Wander web app using Python playwright.
"""
import asyncio
import os
import sys
from pathlib import Path

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
        
        # STEP 1: Open landing page
        print("STEP 1: Opening http://localhost:3000...")
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(ASSETS_DIR, "01-landing.png"), full_page=True)
        print(f"Saved: {os.path.join(ASSETS_DIR, '01-landing.png')}")
        
        # Check what the page looks like - get title and any visible text
        title = await page.title()
        print(f"Page title: {title}")
        
        # STEP 2: Fill in the form
        print("\nSTEP 2: Filling in the form...")
        
        # Try to find the "Starting from" field
        start_selectors = [
            'input[placeholder*="Starting"]',
            'input[placeholder*="starting"]', 
            'input[placeholder*="Start"]',
            'input[placeholder*="from"]',
            'input[placeholder*="From"]',
            'input[name*="start"]',
            'input[name*="from"]',
            'input[id*="start"]',
            'input[id*="from"]',
        ]
        
        start_field = None
        for sel in start_selectors:
            try:
                el = page.locator(sel).first
                count = await el.count()
                if count > 0:
                    start_field = el
                    print(f"Found start field with: {sel}")
                    break
            except:
                pass
        
        if start_field:
            await start_field.click()
            await start_field.fill("Hell's Kitchen, NYC")
            await page.wait_for_timeout(500)
        else:
            print("WARNING: Could not find start field, trying all inputs...")
            inputs = page.locator('input[type="text"], input:not([type])').all()
            inp_list = await inputs
            if len(inp_list) > 0:
                await inp_list[0].click()
                await inp_list[0].fill("Hell's Kitchen, NYC")
                print("Filled first input")
        
        # Try to find the "Ending up at" field
        end_selectors = [
            'input[placeholder*="Ending"]',
            'input[placeholder*="ending"]',
            'input[placeholder*="End"]', 
            'input[placeholder*="Destination"]',
            'input[placeholder*="destination"]',
            'input[placeholder*="to"]',
            'input[placeholder*="To"]',
            'input[name*="end"]',
            'input[name*="to"]',
            'input[id*="end"]',
            'input[id*="to"]',
        ]
        
        end_field = None
        for sel in end_selectors:
            try:
                el = page.locator(sel).first
                count = await el.count()
                if count > 0:
                    end_field = el
                    print(f"Found end field with: {sel}")
                    break
            except:
                pass
        
        if end_field:
            await end_field.click()
            await end_field.fill("Flatiron District, NYC")
            await page.wait_for_timeout(500)
        else:
            print("WARNING: Could not find end field, trying second input...")
            inputs_list = await page.locator('input[type="text"], input:not([type])').all()
            if len(inputs_list) > 1:
                await inputs_list[1].click()
                await inputs_list[1].fill("Flatiron District, NYC")
                print("Filled second input")
        
        # Click the 'Green & Scenic' vibe button
        vibe_selectors = [
            'button:has-text("Green & Scenic")',
            'button:has-text("Green")',
            'button:has-text("Scenic")',
            '[class*="vibe"]:has-text("Green")',
            '*:has-text("🌿")',
            'button:has-text("🌿")',
        ]
        
        vibe_clicked = False
        for sel in vibe_selectors:
            try:
                el = page.locator(sel).first
                count = await el.count()
                if count > 0:
                    await el.click(timeout=5000)
                    vibe_clicked = True
                    print(f"Clicked vibe button with: {sel}")
                    break
            except Exception as e:
                print(f"  Failed {sel}: {e}")
        
        if not vibe_clicked:
            print("WARNING: Could not click vibe button")
        
        await page.wait_for_timeout(800)
        await page.screenshot(path=os.path.join(ASSETS_DIR, "02-form-filled.png"), full_page=True)
        print(f"Saved: {os.path.join(ASSETS_DIR, '02-form-filled.png')}")
        
        # STEP 3: Click the submit button
        print("\nSTEP 3: Clicking Begin wandering button...")
        submit_selectors = [
            'button:has-text("Begin wandering")',
            'button:has-text("wandering")',
            'button:has-text("Wander")',
            'button:has-text("Start")',
            'button[type="submit"]',
            'input[type="submit"]',
        ]
        
        submit_clicked = False
        for sel in submit_selectors:
            try:
                el = page.locator(sel).first
                count = await el.count()
                if count > 0:
                    await el.click(timeout=5000)
                    submit_clicked = True
                    print(f"Clicked submit with: {sel}")
                    break
            except Exception as e:
                print(f"  Failed {sel}: {e}")
        
        if not submit_clicked:
            print("WARNING: Could not find submit button, pressing Enter...")
            await page.keyboard.press("Enter")
        
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(ASSETS_DIR, "03-loading.png"), full_page=True)
        print(f"Saved: {os.path.join(ASSETS_DIR, '03-loading.png')}")
        
        # STEP 4: Wait for route to load (up to 30 seconds)
        print("\nSTEP 4: Waiting for route to load...")
        try:
            # Wait for loading to finish - look for content that indicates route is loaded
            # Try waiting for the loading indicator to disappear
            await page.wait_for_timeout(5000)
            
            # Try to wait for route-specific content
            route_loaded = False
            for _ in range(6):  # Try for 30 seconds (6 x 5s)
                content = await page.content()
                # Check for common route indicators
                if any(term in content.lower() for term in ['stop', 'route', 'walk', 'visit']):
                    # Check if loading indicator is gone
                    loading_visible = False
                    try:
                        loading_el = page.locator('text="Reading the streets", text="Loading", [class*="loading"], [class*="spinner"]').first
                        loading_visible = await loading_el.is_visible(timeout=1000)
                    except:
                        loading_visible = False
                    
                    if not loading_visible:
                        route_loaded = True
                        print("Route appears loaded!")
                        break
                
                print("Still loading, waiting 5 more seconds...")
                await page.wait_for_timeout(5000)
        except Exception as e:
            print(f"Error waiting for route: {e}")
        
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(ASSETS_DIR, "04-route.png"), full_page=True)
        print(f"Saved: {os.path.join(ASSETS_DIR, '04-route.png')}")
        
        # Get route title
        route_title = "Unknown"
        title_selectors = ['h1', 'h2', '[class*="route-title"]', '[class*="title"]', '[class*="heading"]']
        for sel in title_selectors:
            try:
                el = page.locator(sel).first
                count = await el.count()
                if count > 0:
                    route_title = await el.inner_text()
                    if route_title.strip():
                        print(f"Route title: {route_title}")
                        break
            except:
                pass
        
        # STEP 5: Click Insider tip button
        print("\nSTEP 5: Looking for Insider tip button...")
        tip_selectors = [
            'button:has-text("Insider tip")',
            'button:has-text("insider tip")',
            'button:has-text("Insider Tip")',
            'button:has-text("tip")',
            '[class*="tip"] button',
            'button[class*="tip"]',
            '*:has-text("Insider")',
        ]
        
        tip_clicked = False
        for sel in tip_selectors:
            try:
                el = page.locator(sel).first
                count = await el.count()
                if count > 0:
                    await el.scroll_into_view_if_needed()
                    await page.wait_for_timeout(500)
                    await el.click(timeout=8000)
                    tip_clicked = True
                    print(f"Clicked tip button with: {sel}")
                    break
            except Exception as e:
                print(f"  Failed {sel}: {e}")
        
        if not tip_clicked:
            print("WARNING: Could not find Insider tip button")
        
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(ASSETS_DIR, "05-insider-tip.png"), full_page=True)
        print(f"Saved: {os.path.join(ASSETS_DIR, '05-insider-tip.png')}")
        
        await browser.close()
        
        print("\n=== FINAL SUMMARY ===")
        print(f"Route title: {route_title}")
        print(f"All screenshots saved to: {ASSETS_DIR}")
        print("Files saved:")
        for fname in ["01-landing.png", "02-form-filled.png", "03-loading.png", "04-route.png", "05-insider-tip.png"]:
            fpath = os.path.join(ASSETS_DIR, fname)
            if os.path.exists(fpath):
                size = os.path.getsize(fpath)
                print(f"  ✓ {fpath} ({size:,} bytes)")
            else:
                print(f"  ✗ {fpath} (NOT FOUND)")

if __name__ == "__main__":
    asyncio.run(run())
