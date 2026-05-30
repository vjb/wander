import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv("wander-api/.env")
GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

VIBE_QUERIES = {
    "Green & Scenic": [
        "botanical garden conservatory",
        "community garden",
    ],
}

def get_bounding_box(lat: float, lng: float, margin_degrees: float = 0.015):
    # For testing, center around Hell's Kitchen to Flatiron midpoint
    min_lat = lat - margin_degrees
    max_lat = lat + margin_degrees
    min_lng = lng - margin_degrees
    max_lng = lng + margin_degrees
    return {
        "rectangle": {
            "low": {"latitude": min_lat, "longitude": min_lng},
            "high": {"latitude": max_lat, "longitude": max_lng}
        }
    }

async def _places_search_text(query: str, lat: float, lng: float):
    url = "https://places.googleapis.com/v1/places:searchText"
    bbox = get_bounding_box(lat, lng)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
                    "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.location",
                },
            )
            print(f"\nQuery: '{query}' -> Status code: {res.status_code}")
            if res.status_code != 200:
                print(f"Response: {res.text}")
                return
            data = res.json()
            places = data.get("places", [])
            for p in places:
                name = p.get("displayName", {}).get("text", "")
                addr = p.get("formattedAddress", "")
                loc = p.get("location", {})
                plat = loc.get("latitude")
                plng = loc.get("longitude")
                # Calculate simple distance (in km) from center
                from math import radians, cos, sin, asin, sqrt
                def haversine(lon1, lat1, lon2, lat2):
                    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
                    dlon = lon2 - lon1
                    dlat = lat2 - lat1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                    c = 2 * asin(sqrt(a))
                    r = 6371 # Radius of earth in kilometers
                    return c * r

                dist_km = haversine(lng, lat, plng, plat)
                print(f"  - {name} | {addr} | Distance: {dist_km:.2f} km | Coords: {plat}, {plng}")
    except Exception as e:
        print(f"Error for '{query}': {e}")

async def main():
    # Hell's Kitchen to Flatiron midpoint
    lat, lng = 40.7525, -73.9908
    print(f"Midpoint: {lat}, {lng}")
    for q in VIBE_QUERIES["Green & Scenic"]:
        await _places_search_text(q, lat, lng)

if __name__ == "__main__":
    asyncio.run(main())
