import urllib.request, json

payload = json.dumps({
    "start_location": "Hell's Kitchen, NYC",
    "end_location": "Flatiron District, NYC",
    "time_budget_minutes": 120,
    "vibe": "Green & Scenic"
}).encode()

req = urllib.request.Request(
    "http://localhost:8000/api/generate-route",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)

with urllib.request.urlopen(req, timeout=90) as res:
    data = json.loads(res.read())

print(f"✅ Routes returned: {len(data['routes'])}")
for i, route in enumerate(data["routes"]):
    print(f"\n── Route {i+1}: {route['route_name']}")
    print(f"   Theme: {route['theme_summary']}")
    print(f"   Duration: {route['total_walking_time_mins']} min")
    print(f"   Stops: {len(route['waypoints'])}")
    for wp in route["waypoints"]:
        print(f"     {wp['order']}. {wp['location_name']} ({wp['duration_mins']}min, walk_next={wp['walk_to_next_mins']}min)")
    print(f"   Deep link: {route['navigation_deep_link'][:90]}...")
