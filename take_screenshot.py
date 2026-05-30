import sys
sys.path.insert(0, 'C:\\Users\\vjbel\\hacks\\wander\\pw_lib')

from playwright.sync_api import sync_playwright
import time
import os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

URL = "https://www.google.com/maps/dir/?api=1&origin=Hell%27s+Kitchen%2C+NYC&destination=Flatiron+District%2C+NYC&waypoints=750+11th+Ave%2C+New+York%2C+NY+10019%7C540+W+26th+St%2C+New+York%2C+NY+10001&travelmode=walking"

OUTPUT_PATH = r"C:\Users\vjbel\hacks\wander\assets\08-google-maps.png"

# Ensure assets directory exists
os.makedirs(r"C:\Users\vjbel\hacks\wander\assets", exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=CHROME_PATH,
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ]
    )
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="en-US",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    )
    page = context.new_page()
    
    print("Navigating to Google Maps URL...")
    try:
        page.goto(URL, wait_until="load", timeout=60000)
    except Exception as e:
        print(f"Navigation error (continuing): {e}")
    
    # Wait for map to render
    print("Waiting for map to render (10s)...")
    time.sleep(10)
    
    # Try to dismiss any cookie consent dialogs
    try:
        for selector in [
            '#L2AGLb',
            'button[aria-label="Accept all"]',
            'form[action*="consent"] button',
        ]:
            btn = page.query_selector(selector)
            if btn:
                btn.click()
                print(f"Clicked consent button: {selector}")
                time.sleep(4)
                break
    except Exception as e:
        print(f"Consent handling: {e}")
    
    # Wait more for route to fully render
    print("Waiting for route rendering (8s)...")
    time.sleep(8)
    
    # Take screenshot
    print("Taking screenshot...")
    page.screenshot(path=OUTPUT_PATH, full_page=False)
    
    size = os.path.getsize(OUTPUT_PATH)
    print(f"Screenshot saved: {OUTPUT_PATH}")
    print(f"File size: {size} bytes")
    
    # Print page title for context
    print(f"Page title: {page.title()}")
    
    browser.close()

print("Done!")
