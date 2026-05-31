r"""
Test all three enabled Google Maps API endpoints.
Run with: wander-api\venv\Scripts\python tests/test_google_apis.py
"""
import urllib.request
import urllib.parse
import json
import os
from dotenv import load_dotenv

# Resolve .env path relative to this script's directory
env_path = os.path.join(os.path.dirname(__file__), "..", "wander-api", ".env")
load_dotenv(env_path)
KEY = os.getenv("GOOGLE_MAPS_API_KEY")

PASS = "\033[92m✅ PASS\033[0m"
FAIL = "\033[91m❌ FAIL\033[0m"

results = []

# ── 1. Geocoding API ─────────────────────────────────────────────────────────
print("\n── TEST 1: Geocoding API ─────────────────────────────────")
print("   Converting 'Hell's Kitchen, NYC' → lat/lng")
try:
    address = urllib.parse.quote("Hell's Kitchen, New York, NY")
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={address}&key={KEY}"
    with urllib.request.urlopen(url, timeout=10) as res:
        data = json.loads(res.read())

    status = data.get("status")
    if status == "OK":
        loc = data["results"][0]["geometry"]["location"]
        fmt = data["results"][0]["formatted_address"]
        print(f"   Status : {status}")
        print(f"   Address: {fmt}")
        print(f"   Coords : lat={loc['lat']}, lng={loc['lng']}")
        print(f"   {PASS}")
        results.append(("Geocoding API", True))
    else:
        print(f"   Status : {status}")
        print(f"   Error  : {data.get('error_message', 'unknown')}")
        print(f"   {FAIL}")
        results.append(("Geocoding API", False))
except Exception as e:
    print(f"   Exception: {e}")
    print(f"   {FAIL}")
    results.append(("Geocoding API", False))

# ── 2. Directions API ────────────────────────────────────────────────────────
print("\n── TEST 2: Directions API (Walking) ─────────────────────")
print("   Hell's Kitchen → Flatiron District on foot")
try:
    origin = urllib.parse.quote("Hell's Kitchen, New York, NY")
    dest   = urllib.parse.quote("Flatiron District, New York, NY")
    url = (
        f"https://maps.googleapis.com/maps/api/directions/json"
        f"?origin={origin}&destination={dest}&mode=walking&key={KEY}"
    )
    with urllib.request.urlopen(url, timeout=10) as res:
        data = json.loads(res.read())

    status = data.get("status")
    if status == "OK":
        leg = data["routes"][0]["legs"][0]
        dist = leg["distance"]["text"]
        dur  = leg["duration"]["text"]
        steps = len(leg["steps"])
        print(f"   Status  : {status}")
        print(f"   Distance: {dist}")
        print(f"   Duration: {dur} walking")
        print(f"   Steps   : {steps} turn-by-turn directions")
        print(f"   {PASS}")
        results.append(("Directions API", True))
    else:
        print(f"   Status : {status}")
        print(f"   Error  : {data.get('error_message', 'unknown')}")
        print(f"   {FAIL}")
        results.append(("Directions API", False))
except Exception as e:
    print(f"   Exception: {e}")
    print(f"   {FAIL}")
    results.append(("Directions API", False))

# ── 3. Places API (New) ──────────────────────────────────────────────────────
print("\n── TEST 3: Places API (New) ──────────────────────────────")
print("   Searching for specialty coffee near Hell's Kitchen")
try:
    url = "https://places.googleapis.com/v1/places:searchText"
    payload = json.dumps({
        "textQuery": "specialty coffee shop Hell's Kitchen New York",
        "maxResultCount": 3,
        "locationBias": {
            "circle": {
                "center": {"latitude": 40.7645, "longitude": -73.9942},
                "radius": 800.0
            }
        }
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": KEY,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.types",
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        data = json.loads(res.read())

    places = data.get("places", [])
    if places:
        print(f"   Status  : 200 OK — {len(places)} results")
        for p in places:
            name    = p.get("displayName", {}).get("text", "N/A")
            address = p.get("formattedAddress", "N/A")
            rating  = p.get("rating", "N/A")
            print(f"   • {name} | {address} | ⭐ {rating}")
        print(f"   {PASS}")
        results.append(("Places API (New)", True))
    else:
        print(f"   No places returned. Response: {data}")
        print(f"   {FAIL}")
        results.append(("Places API (New)", False))
except Exception as e:
    print(f"   Exception: {e}")
    print(f"   {FAIL}")
    results.append(("Places API (New)", False))

# ── Summary ──────────────────────────────────────────────────────────────────
print("\n─────────────────────────────────────────────────────────")
print("RESULTS SUMMARY")
print("─────────────────────────────────────────────────────────")
for name, passed in results:
    icon = "✅" if passed else "❌"
    print(f"  {icon}  {name}")

passed_count = sum(1 for _, p in results if p)
print(f"\n  {passed_count}/{len(results)} APIs verified")
print("─────────────────────────────────────────────────────────\n")
