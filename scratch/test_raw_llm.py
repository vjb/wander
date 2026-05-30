import asyncio
import os
from dotenv import load_dotenv
from openai import OpenAI
import httpx

load_dotenv("wander-api/.env")
GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

openai_client = OpenAI(api_key=OPENAI_KEY)

# Reuse backend functions directly or simplified versions
from math import radians, cos, sin, asin, sqrt

def _midpoint(a, b):
    return {"lat": (a["lat"] + b["lat"]) / 2, "lng": (a["lng"] + b["lng"]) / 2}

async def _places_search_text(query: str, lat: float, lng: float, radius_m: float = 2000.0):
    url = "https://places.googleapis.com/v1/places:searchText"
    import math
    delta_lat = radius_m / 111111.0
    cos_lat = math.cos(math.radians(lat))
    if cos_lat < 0.01:
        cos_lat = 0.01
    delta_lng = radius_m / (111111.0 * cos_lat)
    
    bbox = {
        "rectangle": {
            "low": {"latitude": lat - delta_lat, "longitude": lng - delta_lng},
            "high": {"latitude": lat + delta_lat, "longitude": lng + delta_lng}
        }
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(
                url,
                json={
                    "textQuery": query,
                    "maxResultCount": 5,
                    "locationRestriction": bbox,
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": GOOGLE_KEY,
                    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.types,places.location",
                },
            )
            places = []
            for p in res.json().get("places", []):
                places.append({
                    "place_id": p.get("id", ""),
                    "name": p.get("displayName", {}).get("text", ""),
                    "address": p.get("formattedAddress", ""),
                    "rating": p.get("rating"),
                    "types": p.get("types", [])[:3],
                    "lat": p.get("location", {}).get("latitude"),
                    "lng": p.get("location", {}).get("longitude"),
                })
            return places
    except Exception as e:
        print(f"Error searching '{query}': {e}")
        return []

VIBE_QUERIES = {
    "Green & Scenic": [
        "park garden scenic",
        "waterfront park path",
        "community garden",
        "elevated park walkway",
        "botanical garden conservatory",
    ],
}

async def fetch_candidate_venues(start_ll, end_ll, vibe):
    queries = VIBE_QUERIES[vibe]
    center = _midpoint(start_ll, end_ll) if end_ll else start_ll
    lat, lng = center["lat"], center["lng"]
    results = await asyncio.gather(
        *[_places_search_text(q, lat, lng) for q in queries],
        return_exceptions=True,
    )
    seen = set()
    venues = []
    for batch in results:
        if isinstance(batch, list):
            for place in batch:
                pid = place.get("place_id") or place.get("name", "")
                if pid and pid not in seen and place.get("name"):
                    seen.add(pid)
                    venues.append(place)
    venues.sort(key=lambda x: x.get("rating") or 0, reverse=True)
    return venues[:20]

from pydantic import BaseModel, Field
from typing import List

class SelectedWaypointLLM(BaseModel):
    venue_index: int
    order: int
    action_description: str
    duration_mins: int
    vibe_tag: str
    insider_tip: str

class RouteOptionLLM(BaseModel):
    route_name: str
    theme_summary: str
    waypoints: List[SelectedWaypointLLM]

class V3ResponseLLM(BaseModel):
    routes: List[RouteOptionLLM]

async def main():
    start_ll = {"lat": 40.7638, "lng": -73.9918} # Hell's Kitchen
    end_ll = {"lat": 40.7411, "lng": -73.9897} # Flatiron
    
    venues = await fetch_candidate_venues(start_ll, end_ll, "Green & Scenic")
    print(f"Fetched {len(venues)} candidate venues:")
    for i, v in enumerate(venues):
        print(f"  [{i+1}] {v['name']} | {v['address']} | rating={v['rating']}")
        
    # Let's call the LLM and see what it returns
    venue_lines = [
        f"[{i+1}] {v['name']} | {v['address']} | "
        f"{'⭐ ' + str(v['rating']) if v.get('rating') else 'no rating'} | "
        f"{', '.join(v['types'][:2]) if v.get('types') else ''}"
        for i, v in enumerate(venues)
    ]
    venues_context = "\n".join(venue_lines)
    
    time_budget_minutes = 240
    _stops = 3
    _walk_per_leg_mins = 12
    _walk_allowance = _walk_per_leg_mins * _stops
    _per_stop_mins = max(15, (time_budget_minutes - _walk_allowance) // _stops)
    
    system_prompt = f"""You are Wander — an urban experience curator with encyclopedic local knowledge.
Your life isn't a chore; wander. Help the user feel that.

VERIFIED VENUES (sourced from Google Places — these are real, confirmed businesses):
{venues_context}

MISSION: Build exactly 3 distinct walking routes from Hell's Kitchen to Flatiron.
Each route uses 3–4 stops chosen ONLY from the numbered list above.

TIME BUDGET: {time_budget_minutes} minutes TOTAL per route.
→ TARGET: Each route should USE approximately {time_budget_minutes} minutes — not just fit within it.
→ Each stop should have duration_mins of approximately {_per_stop_mins} minutes (scale up for longer budgets).
→ If the budget is 60 min: stops of ~12–15 min each. If 120 min: ~25–30 min. If 240 min: ~50–60 min each.
→ DO NOT generate short 45-minute routes when given a 4-hour budget. Fill the time richly.

STRICT RULES:
1. Use ONLY venues from the list. Reference each by its [number] in venue_index. No invented stops.
2. Each route must use a DIFFERENT set of venues. No shared stops between routes.
3. Stops must flow geographically toward Flatiron. Zero backtracking.
4. Hard cap: total time (duration_mins + walk_to_next_mins for all stops) <= {time_budget_minutes} min.
5. The 3 routes must be: Route 1 = ultra-scenic/relaxed, Route 2 = culturally dense, Route 3 = fast & focused.
6. Write like a local who has lived here 10 years. Specific, warm. Never say "charming" or "vibrant."
7. Insider tips must be genuinely useful and specific to this exact venue.

Active vibe: Green & Scenic"""

    print("\nCalling OpenAI...")
    res = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Generate 3 routes. Start: Hell's Kitchen. End: Flatiron. Vibe: Green & Scenic. Select ONLY from the provided venue list."
            }
        ],
        response_format=V3ResponseLLM,
        temperature=0.85,
    )
    parsed = res.choices[0].message.parsed
    print(f"LLM returned {len(parsed.routes)} routes:")
    for i, route in enumerate(parsed.routes):
        print(f"\nRoute {i+1}: {route.route_name} - {route.theme_summary}")
        for wp in route.waypoints:
            print(f"  Order {wp.order} -> venue_index: {wp.venue_index} (stop duration: {wp.duration_mins}m)")

if __name__ == "__main__":
    asyncio.run(main())
