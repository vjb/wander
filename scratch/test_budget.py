import urllib.request
import json

API_URL = "http://localhost:8000/api/generate-route"

payload = json.dumps({
    "start_location": "515 W 52nd St, New York, NY",
    "end_location": "1 Madison Ave, New York, NY",
    "time_budget_minutes": 240,
    "vibe": "Green & Scenic"
}).encode()

print("Sending 240-minute request...")
try:
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=90) as res:
        data = json.loads(res.read())
except Exception as e:
    print(f"Error: {e}")
    raise SystemExit(1)

for i, r in enumerate(data["routes"]):
    print(f"\nRoute {i+1}: {r['route_name']}")
    print(f"  Theme: {r['theme_summary']}")
    print(f"  Total time: {r['total_walking_time_mins']} mins")
    print(f"  Stops: {len(r['waypoints'])}")
    for wp in r["waypoints"]:
        print(f"    [{wp['order']}] {wp['location_name']} (duration: {wp['duration_mins']}m, walk to next: {wp['walk_to_next_mins']}m)")
