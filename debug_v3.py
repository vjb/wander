import urllib.request, json

payload = json.dumps({
    "start_location": "515 W 52nd St, New York, NY",
    "end_location": "1 Madison Ave, New York, NY",
    "time_budget_minutes": 120,
    "vibe": "Caffeinated & Cultured"
}).encode()

req = urllib.request.Request(
    "http://localhost:8000/api/generate-route",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(req, timeout=90) as res:
    data = json.loads(res.read())

for i, route in enumerate(data["routes"]):
    print(f"Route {i+1}: {route['route_name']}")
    print(f"  deep_link repr: {repr(route.get('navigation_deep_link', 'MISSING'))[:120]}")
    for wp in route["waypoints"]:
        print(f"  [{wp['order']}] {wp['location_name']} | rating={wp.get('google_rating')}")
    print()
