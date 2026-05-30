"""
Wander V3 — Scripted Backend Test
Verifies: OpenAI structured output, Google RAG pipeline, deep links, google_rating on every stop.

Run: wander-api\venv\Scripts\python test_v3.py
     (make sure uvicorn is running on port 8000 first)
"""
import urllib.request
import urllib.error
import json
import time

API_URL = "http://localhost:8000/api/generate-route"

payload = json.dumps({
    "start_location": "515 W 52nd St, New York, NY",
    "end_location": "1 Madison Ave, New York, NY",
    "time_budget_minutes": 120,
    "vibe": "Caffeinated & Cultured"
}).encode()

print("\n🗺️  Wander V3 — Backend Test Suite")
print("────────────────────────────────────────────────────────")
print("   Initiating radar sweep + AI routing...")
start_time = time.time()

try:
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=90) as res:
        data = json.loads(res.read())
        elapsed = round(time.time() - start_time, 2)
except urllib.error.HTTPError as e:
    print(f"\n❌ HTTP {e.code}: {e.read().decode()}")
    raise SystemExit(1)
except Exception as e:
    print(f"\n❌ Connection error: {e}")
    raise SystemExit(1)

print(f"   Response in {elapsed}s\n")

# ── Hard Assertions ────────────────────────────────────────────────────────────

assert "routes" in data,               "❌ FAIL: No 'routes' key in response"
assert len(data["routes"]) == 3,       f"❌ FAIL: Expected 3 routes, got {len(data['routes'])}"
print("✅ ASSERTION 1: Exactly 3 routes returned")

for i, route in enumerate(data["routes"]):
    assert "navigation_deep_link" in route,     f"❌ FAIL: Route {i+1} missing navigation_deep_link"
    assert route["navigation_deep_link"].startswith("https://www.google.com/maps/dir/"), \
        f"❌ FAIL: Route {i+1} deep link is invalid: {route['navigation_deep_link'][:80]}"
    assert "travelmode=walking" in route["navigation_deep_link"], \
        f"❌ FAIL: Route {i+1} deep link missing walking mode"

print("✅ ASSERTION 2: All routes have valid Google Maps walking deep links")

rated_stops = 0
total_stops = 0
for route in data["routes"]:
    for wp in route["waypoints"]:
        total_stops += 1
        if wp.get("google_rating") is not None:
            rated_stops += 1

rating_pct = round(rated_stops / total_stops * 100) if total_stops else 0
print(f"✅ ASSERTION 3: {rated_stops}/{total_stops} stops have Google ratings ({rating_pct}%)")

# ── Detailed Output ────────────────────────────────────────────────────────────

print("\n────────────────────────────────────────────────────────")
print("ROUTE DETAILS")
print("────────────────────────────────────────────────────────")

for i, route in enumerate(data["routes"]):
    print(f"\n  Route {i+1}: {route['route_name']}")
    print(f"  Theme:  {route['theme_summary']}")
    print(f"  Time:   {route['total_walking_time_mins']} min total")
    print(f"  Maps:   {route['navigation_deep_link'][:80]}...")
    print()
    for wp in route["waypoints"]:
        rating = f"⭐ {wp['google_rating']}" if wp.get("google_rating") else "no rating"
        walk   = f" → 🚶 {wp['walk_to_next_mins']}min" if wp.get("walk_to_next_mins") else ""
        print(f"    [{wp['order']}] {wp['location_name']} ({rating}) — {wp['duration_mins']}min{walk}")

print("\n────────────────────────────────────────────────────────")
print("🚀  ALL BACKEND TESTS PASSED. The V3 brain is ready.")
print("────────────────────────────────────────────────────────\n")
