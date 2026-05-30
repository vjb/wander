import urllib.request
import json
import sys

API_URL = "http://localhost:8000/api/generate-route"

payload = json.dumps({
    "start_location": "515 W 52nd St, New York, NY",
    "end_location": "1 Madison Ave, New York, NY",
    "time_budget_minutes": 240,
    "vibe": "Green & Scenic"
}).encode()

try:
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=90) as res:
        data = json.loads(res.read())
        print(f"Returned route count: {len(data.get('routes', []))}")
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
