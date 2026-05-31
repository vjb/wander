"""
Wander V3 — RAG-Powered, Hallucination-Free Route Engine

Architecture:
  1. Geocode start → real lat/lng (Google Geocoding API)
  2. Google Places API (New) → find 15-20 verified real venues near the route
  3. GPT-4o (RAG) → selects from the verified venue list, writes descriptions
  4. Google Directions API → compute real walking minutes between every stop
  5. Build Google Maps deep links + inject google_rating on every waypoint
"""

import asyncio
import json
import logging
import math
import os
from typing import Dict, List, Optional
from urllib.parse import quote_plus

import httpx
from dotenv import load_dotenv

logger = logging.getLogger("uvicorn.error")
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field

import database


load_dotenv()

# ── Keys ──────────────────────────────────────────────────────────────────────
OPENAI_KEY  = os.getenv("OPENAI_API_KEY", "")
GOOGLE_KEY  = os.getenv("GOOGLE_MAPS_API_KEY", "")
OPENWEATHER_KEY = os.getenv("OPENWEATHER_API_KEY", "")

# ── LangSmith ─────────────────────────────────────────────────────────────────
try:
    from langsmith import traceable
    _LANGSMITH = True
except ImportError:
    def traceable(**kwargs):          # type: ignore
        def decorator(f): return f
        return decorator
    _LANGSMITH = False

openai_client = OpenAI(api_key=OPENAI_KEY)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Wander API",
    description="Your life isn't a chore; wander.",
    version="3.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Vibe → Places search queries ──────────────────────────────────────────────
VIBE_QUERIES: Dict[str, List[str]] = {
    "Caffeinated & Cultured": [
        "specialty coffee roaster",
        "independent bookstore",
        "contemporary art gallery",
        "jazz bar live music",
        "vinyl record shop",
    ],
    "Green & Scenic": [
        "park garden scenic",
        "waterfront park path",
        "community garden",
        "elevated park walkway",
        "botanical garden conservatory",
    ],
    "Spontaneous & Social": [
        "rooftop bar cocktails",
        "food hall street food",
        "live music venue bar",
        "night market pop-up",
        "neighborhood bar local craft beer",
    ],
    "Mental Break": [
        "specialty coffee roaster cafe",
        "pocket park urban garden",
        "quiet community garden",
        "scenic overlook waterfront",
        "bakery local pastry",
    ],
    "Off the Grid": [
        "secret garden community",
        "abandoned historic landmark scenic",
        "vintage thrift clothing bookstore",
        "indie zine shop record",
        "local pocket park hidden",
        "micro-bakery alleyway cafe",
    ],
    "Feeling Lucky": [
        "speakeasy hidden bar",
        "architectural folly landmark",
        "unusual oddities museum curio",
        "esoteric occult bookstore library",
        "community garden art installation",
    ],
}

# ── Vibe → Route Archetypes (Fix #9) ─────────────────────────────────────────
VIBE_ROUTE_ARCHETYPES: Dict[str, List[tuple]] = {
    "Caffeinated & Cultured": [
        ("the morning ritual", "an espresso-forward crawl through specialty roasters and artisan bakeries"),
        ("the gallery drift", "a route anchored by contemporary art spaces, vinyl shops, and design bookstores"),
        ("the literary afternoon", "a slow wander through independent bookstores, quiet reading cafes, and jazz bars"),
    ],
    "Green & Scenic": [
        ("the park connector", "a nature-first route linking green spaces, community gardens, and waterfront paths"),
        ("the scenic overlook loop", "a route built around elevated views, architectural landmarks, and open sky"),
        ("the botanist's wander", "a slow exploration of hidden gardens, tree-lined blocks, and quiet outdoor sanctuaries"),
    ],
    "Spontaneous & Social": [
        ("the rooftop circuit", "a lively route hopping between rooftop bars, food halls, and street-level energy"),
        ("the local's night out", "a social loop through neighborhood bars, live music spots, and late-night bites"),
        ("the market crawl", "a street-food-forward route through outdoor markets, pop-up stalls, and craft beer stops"),
    ],
    "Mental Break": [
        ("the decompression loop", "a quiet, short route through pocket parks, a slow coffee, and fresh air"),
        ("the mindful stroll", "a gentle wander through serene green spaces and a calm neighborhood cafe"),
        ("the reset walk", "a focused micro-route: one good coffee, one quiet park bench, one breath of city air"),
    ],
    "Off the Grid": [
        ("the secret city", "a route that consciously avoids tourists, chains, and main streets to show you local secrets"),
        ("the quiet corner", "a slow path built around hidden community gardens, quiet pocket parks, and micro-cafes"),
        ("the vintage crawl", "a route connecting retro thrift stores, old book nooks, and cozy, off-beat coffee spots"),
    ],
    "Feeling Lucky": [
        ("the serendipity drift", "a completely unpredictable walk where we trust the algorithm to take us somewhere unexpected"),
        ("the avant-garde stroll", "a theme that blends art, oddities, and unique local history into a strange but perfect afternoon"),
        ("the curiosity loop", "a path designed to spark your curiosity with places that don't fit into any standard category"),
    ],
}

# For custom vibes, fall back to generic but still varied archetypes
DEFAULT_ARCHETYPES: List[tuple] = [
    ("the discovery route", "a curious, open-ended wander shaped by the user's specific vibe"),
    ("the local's pick", "a route that leans into what locals actually do in this neighborhood"),
    ("the mood route", "a carefully sequenced path that matches the energy of the user's vibe from start to finish"),
]

# ── Pydantic Models ───────────────────────────────────────────────────────────

class WaypointV3(BaseModel):
    order: int
    location_name: str
    address_hint: str
    google_rating: Optional[float] = None
    photo_url: Optional[str] = None
    place_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    action_description: str
    duration_mins: int
    walk_to_next_mins: int = 0
    vibe_tag: str
    insider_tip: str
    estimated_cost_usd: Optional[int] = 0


class WanderRouteOptionV3(BaseModel):
    route_name: str
    theme_summary: str
    total_walking_time_mins: int
    initial_walk_mins: int = 0
    start_location: str = ""
    end_location: str = ""
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    waypoints: List[WaypointV3]
    navigation_deep_link: str
    estimated_total_cost_usd: Optional[int] = 0



class WanderV3Response(BaseModel):
    routes: List[WanderRouteOptionV3]
    weather_context: Optional[str] = None


class RouteRequest(BaseModel):
    start_location: str
    end_location: str
    time_budget_minutes: int
    vibe: str
    local_time: Optional[str] = None
    num_stops: Optional[int] = 3
    free_only: Optional[bool] = False
    companion: Optional[str] = "solo"
    avoid_slopes: Optional[bool] = False
    max_budget_usd: Optional[int] = 50


class AdvisorRequest(BaseModel):
    start_location: str
    end_location: str
    time_budget_minutes: int
    num_stops: int
    companion: str
    local_time: Optional[str] = None


class AdvisorResponse(BaseModel):
    detected_neighborhood: str
    density_level: str
    recommended_stops: int
    pacing_message: str
    feasibility_status: str
    density_badge_message: str
    weather_advice: Optional[str] = None




class ShareRequest(BaseModel):
    route: WanderRouteOptionV3
    vibe: str



# ── LLM selection models (RAG mode) ──────────────────────────────────────────

class SelectedWaypointLLM(BaseModel):
    venue_index: int = Field(
        ...,
        description="1-based index into the VERIFIED VENUES list provided in the prompt",
    )
    order: int
    action_description: str = Field(
        ...,
        description=(
            "2–3 sentences written like a knowledgeable local. "
            "Specific, warm, never generic. Reference what makes this place worth stopping for."
        ),
    )
    duration_mins: int = Field(
        ...,
        description=(
            "Realistic minutes to spend at this specific venue (excluding walking time). "
            "Use the VENUE TYPE DURATION TABLE in the system prompt — do NOT split the budget evenly. "
            "A coffee stop is 15-25 min; a gallery is 30-60 min; a park is 20-40 min. Vary across stops."
        )
    )
    vibe_tag: str = Field(..., description="1–3 word micro-label e.g. 'Hidden Gem', 'Coffee Fix'")
    insider_tip: str = Field(
        ...,
        description="One specific local secret: the best seat, off-menu item, or perfect time of day to visit",
    )
    estimated_cost_usd: int = Field(
        ...,
        description="Estimated cost in USD per person for this stop. Use 0 for free stops (parks, landmarks, free libraries). Use realistic values: coffee $5, wine/cocktail $15-$20, meal $20-$40.",
    )


class RouteOptionLLM(BaseModel):
    route_name: str = Field(..., description="Creative 3–5 word route name e.g. 'The Slow Burn Drift'")
    theme_summary: str = Field(
        ...,
        description="One sentence distinguishing this route's character from the other two",
    )
    waypoints: List[SelectedWaypointLLM] = Field(
        ...,
        min_length=2,
        max_length=5,
        description="2–5 stops selected from the verified venue list, in geographic order",
    )
    estimated_total_cost_usd: int = Field(
        ...,
        description="The sum of estimated_cost_usd for all waypoints in this route.",
    )


class V3ResponseLLM(BaseModel):
    routes: List[RouteOptionLLM] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactly 3 distinct routes",
    )


# ── Weather and Custom Vibe Helpers ───────────────────────────────────────────

async def _get_weather(lat: float, lng: float) -> Optional[dict]:
    """Fetch current weather from OpenWeather API at coordinates."""
    if not OPENWEATHER_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": lat,
                    "lon": lng,
                    "appid": OPENWEATHER_KEY,
                    "units": "metric"
                }
            )
            if res.status_code == 200:
                data = res.json()
                weather_main = data["weather"][0]["main"]
                weather_desc = data["weather"][0]["description"]
                temp = round(data["main"]["temp"])
                return {
                    "main": weather_main,
                    "description": weather_desc,
                    "temp_c": temp,
                    "is_adverse": weather_main.lower() in ["rain", "snow", "thunderstorm", "drizzle"]
                }
    except Exception as e:
        print(f"Error fetching weather: {e}")
    return None


async def _extract_custom_queries(vibe: str) -> List[str]:
    """Use GPT-4o-mini to extract search keywords from a user's custom vibe text."""
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an assistant that extracts specific Google Maps Places search terms from a descriptive vibe. "
                            "Extract 3 to 5 distinct, concrete, search queries (e.g. 'bookstore', 'ramen', 'rooftop bar') matching the user's desires. "
                            "Return ONLY a JSON object containing a 'queries' array of strings. Example: {'queries': ['query1', 'query2']}."
                        )
                    },
                    {"role": "user", "content": vibe}
                ],
                response_format={"type": "json_object"},
                temperature=0.0
            )
        )
        content = response.choices[0].message.content
        if content:
            data = json.loads(content)
            queries = data.get("queries")
            if isinstance(queries, list):
                return [str(q) for q in queries]
        return [vibe]
    except Exception as e:
        print(f"Error extracting custom queries: {e}")
        return [vibe]


async def _extract_lucky_queries() -> List[str]:
    """Generate a surprising, themed, and avant-garde set of Google Maps search queries for 'Feeling Lucky'."""
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an urban exploration planner. The user clicked 'I'm Feeling Lucky'. "
                            "Create a cohesive but completely unexpected, quirky, and themed set of 3 to 5 Google Maps search queries. "
                            "Think of strange but delightful themes: a retro neon crawl, a botanical & vintage book drift, "
                            "a speakeasy & historic mystery walk, or a vinyl record & coffee alleyway stroll. "
                            "Be creative and specific with the search queries (e.g. 'independent bookstore', 'retro arcade bar', 'historic fountain overlook'). "
                            "Return ONLY a JSON object containing a 'queries' array of strings. Example: {'queries': ['query1', 'query2', 'query3']}."
                        )
                    },
                    {"role": "user", "content": "Generate a completely unique and surprising walk vibe theme and queries."}
                ],
                response_format={"type": "json_object"},
                temperature=1.0
            )
        )
        content = response.choices[0].message.content
        if content:
            data = json.loads(content)
            queries = data.get("queries")
            if isinstance(queries, list):
                return [str(q) for q in queries]
        return ["speakeasy hidden bar", "vintage curio shop", "secret garden"]
    except Exception as e:
        print(f"Error generating lucky queries: {e}")
        return ["speakeasy hidden bar", "vintage curio shop", "secret garden"]


# ── Google Geocoding API ──────────────────────────────────────────────────────


async def geocode_location(location: str) -> Optional[Dict[str, float]]:
    """Convert a human address to lat/lng via Google Geocoding API."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": location, "key": GOOGLE_KEY},
            )
            data = res.json()
            if data.get("status") == "OK":
                loc = data["results"][0]["geometry"]["location"]
                return {"lat": loc["lat"], "lng": loc["lng"]}
    except Exception:
        pass
    return None


def _midpoint(a: Dict[str, float], b: Dict[str, float]) -> Dict[str, float]:
    """Return the geographic midpoint between two lat/lng dicts."""
    return {"lat": (a["lat"] + b["lat"]) / 2, "lng": (a["lng"] + b["lng"]) / 2}


def _coordinate_distance_m(a: Dict[str, float], b: Dict[str, float]) -> float:
    """Return approximate distance in meters between two lat/lng pairs using Haversine formula."""
    import math
    lat1, lng1 = a["lat"], a["lng"]
    lat2, lng2 = b["lat"], b["lng"]
    R = 6371000.0  # earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    a_val = math.sin(dphi/2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlng/2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a_val), math.sqrt(1.0 - a_val))
    return R * c


# ── Google Places API (New) ───────────────────────────────────────────────────

async def _places_search_text(query: str, lat: float, lng: float, radius_m: float = 2000.0) -> List[Dict]:
    """Single Places API (New) searchText call — strict radius via locationRestriction."""
    import math
    try:
        # Calculate bounding box (rectangle) from center and radius
        # 1 degree of latitude is ~111,111 meters
        delta_lat = radius_m / 111111.0
        # 1 degree of longitude is ~111,111 * cos(latitude) meters
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

        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(
                "https://places.googleapis.com/v1/places:searchText",
                json={
                    "textQuery": query,
                    "maxResultCount": 5,
                    "locationRestriction": bbox,
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": GOOGLE_KEY,
                    "X-Goog-FieldMask": (
                        "places.id,places.displayName,places.formattedAddress,"
                        "places.rating,places.types,places.location,places.photos,places.priceLevel"
                    ),
                },
            )
            if res.status_code != 200:
                err_text = res.text
                try:
                    err_json = res.json()
                    err_msg = err_json.get("error", {}).get("message", err_text)
                except Exception:
                    err_msg = err_text
                raise Exception(f"Google Places API error ({res.status_code}): {err_msg}")
            places = []
            for p in res.json().get("places", []):
                # Build photo URL from first photo reference if available
                photo_url = None
                photos = p.get("photos", [])
                if photos:
                    photo_name = photos[0].get("name", "")
                    if photo_name:
                        photo_url = (
                            f"https://places.googleapis.com/v1/{photo_name}/media"
                            f"?maxWidthPx=800&maxHeightPx=500&key={GOOGLE_KEY}"
                        )
                places.append(
                    {
                        "place_id": p.get("id", ""),
                        "name": p.get("displayName", {}).get("text", ""),
                        "address": p.get("formattedAddress", ""),
                        "rating": p.get("rating"),
                        "types": p.get("types", [])[:3],
                        "lat": p.get("location", {}).get("latitude"),
                        "lng": p.get("location", {}).get("longitude"),
                        "photo_url": photo_url,
                        "price_level": p.get("priceLevel"),
                    }
                )
            return places
    except Exception as e:
        print(f"[PLACES EXCEPTION] query={query}, error={e}")
        raise e


async def fetch_candidate_venues(start_ll: Dict, end_ll: Optional[Dict], vibe: str, time_budget_minutes: int = 90) -> List[Dict]:
    """
    Run all vibe-appropriate Places queries in parallel, centered on the route MIDPOINT.
    Uses strict locationRestriction so venues are guaranteed near the route corridor.
    Deduplicate by place_id and return top 20 sorted by rating.
    """
    queries = VIBE_QUERIES.get(vibe, VIBE_QUERIES["Spontaneous & Social"])

    # Center search on midpoint between start and end so venues are along the corridor
    center = _midpoint(start_ll, end_ll) if end_ll else start_ll
    lat, lng = center["lat"], center["lng"]

    # Dynamic search radius calculation
    if end_ll:
        dist_m = _coordinate_distance_m(start_ll, end_ll)
    else:
        dist_m = 0.0
    
    is_round_trip = dist_m < 50.0 or end_ll is None
    time_scale_radius = (time_budget_minutes / 30.0) * 500.0
    
    if is_round_trip:
        # Loop / Round Trip: search radius based solely on time budget
        radius_m = max(1000.0, min(5000.0, (time_budget_minutes / 30.0) * 1000.0))
        center = start_ll
        lat, lng = center["lat"], center["lng"]
    else:
        # Progression route: radius scales with distance and time budget
        radius_m = max(500.0, min(3000.0, (dist_m / 3.0) * 0.7 + time_scale_radius * 0.3))

    results = await asyncio.gather(
        *[_places_search_text(q, lat, lng, radius_m=radius_m) for q in queries],
        return_exceptions=True,
    )

    seen: set = set()
    venues: List[Dict] = []
    for batch in results:
        if isinstance(batch, list):
            for place in batch:
                pid = place.get("place_id") or place.get("name", "")
                if pid and pid not in seen and place.get("name"):
                    seen.add(pid)
                    venues.append(place)

    # Sort by rating descending, keep top 20
    venues.sort(key=lambda x: x.get("rating") or 0, reverse=True)
    return venues[:20]


# ── Google Directions & Elevation API ──────────────────────────────────────────

async def get_route_legs_info(addresses: List[str]) -> List[Dict]:
    """
    Call Directions API between each consecutive pair of addresses in parallel.
    Returns a list of dicts, one for each leg:
    {
      "duration_mins": int,
      "distance_m": int,
      "polyline": str
    }
    For N addresses, returns N-1 leg dicts.
    """
    if len(addresses) < 2:
        return []

    async def _fetch_leg(client: httpx.AsyncClient, origin: str, destination: str) -> Dict:
        try:
            res = await client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params={
                    "origin": origin,
                    "destination": destination,
                    "mode": "walking",
                    "key": GOOGLE_KEY,
                },
            )
            data = res.json()
            if data.get("status") == "OK":
                route = data["routes"][0]
                leg = route["legs"][0]
                secs = leg["duration"]["value"]
                dist = leg["distance"]["value"]
                poly = route.get("overview_polyline", {}).get("points", "")
                return {
                    "duration_mins": round(secs / 60),
                    "distance_m": dist,
                    "polyline": poly
                }
            return {
                "duration_mins": 8,
                "distance_m": 600,
                "polyline": ""
            }
        except Exception:
            return {
                "duration_mins": 8,
                "distance_m": 600,
                "polyline": ""
            }

    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [
            _fetch_leg(client, addresses[i], addresses[i + 1])
            for i in range(len(addresses) - 1)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    legs: List[Dict] = []
    for r in results:
        if isinstance(r, dict):
            legs.append(r)
        else:
            legs.append({
                "duration_mins": 8,
                "distance_m": 600,
                "polyline": ""
            })
    return legs


async def get_walking_times(addresses: List[str]) -> List[int]:
    """
    Call Directions API and return duration_mins list (last stop is always 0).
    """
    legs = await get_route_legs_info(addresses)
    walk_times = [leg["duration_mins"] for leg in legs]
    walk_times.append(0)
    return walk_times


async def check_leg_incline_steep(client: httpx.AsyncClient, polyline: str, distance_m: float) -> bool:
    """
    Sample 10 points along the path using Google Elevation API and calculate slope.
    Returns True if any consecutive slope exceeds 8% (0.08).
    """
    if not polyline or distance_m <= 0:
        return False
    try:
        res = await client.get(
            "https://maps.googleapis.com/maps/api/elevation/json",
            params={
                "path": f"enc:{polyline}",
                "samples": "10",
                "key": GOOGLE_KEY,
            },
        )
        data = res.json()
        if data.get("status") == "OK":
            results = data.get("results", [])
            if len(results) >= 2:
                # distance between consecutive samples
                # Since we asked for 10 samples, there are 9 intervals
                d = distance_m / (len(results) - 1)
                if d <= 0:
                    return False
                for i in range(len(results) - 1):
                    el1 = results[i]["elevation"]
                    el2 = results[i + 1]["elevation"]
                    slope = abs(el2 - el1) / d
                    if slope > 0.08:
                        logger.warning(
                            f"Steep leg detected: slope={slope:.4f} (> 0.08) "
                            f"over interval={d:.1f}m (elevations: {el1:.1f}m to {el2:.1f}m)"
                        )
                        return True
        else:
            logger.warning(f"Elevation API error status: {data.get('status')}")
    except Exception as e:
        logger.error(f"Failed to check leg incline: {e}")
    return False



# ── Deep-link builder ─────────────────────────────────────────────────────────

def build_maps_deep_link(
    start: str,
    end: str,
    waypoints: List[str],
    waypoint_place_ids: Optional[List[str]] = None
) -> str:
    """Build a URL-encoded Google Maps walking directions deep link."""
    origin      = quote_plus(start.strip())
    destination = quote_plus(end.strip())
    wp_str      = "|".join(quote_plus(w.strip()) for w in waypoints if w.strip())
    url = (
        f"https://www.google.com/maps/dir/?api=1"
        f"&origin={origin}"
        f"&destination={destination}"
        f"&waypoints={wp_str}"
        f"&travelmode=walking"
    )
    if waypoint_place_ids:
        pids_str = "|".join(quote_plus(pid.strip()) for pid in waypoint_place_ids if pid and pid.strip())
        if pids_str:
            url += f"&waypoint_place_ids={pids_str}"
    return url


# ── Single Route OpenAI generation (RAG mode) ──────────────────────────────────

def _call_openai_single_route_sync(
    request: RouteRequest,
    venues: List[Dict],
    route_type_desc: str,
    previously_selected: List[str],
    weather_info: Optional[Dict],
    local_time: Optional[str]
) -> RouteOptionLLM:
    """GPT-4o curates a single route from a verified Google Places venue list."""
    venue_lines = [
        f"[{i+1}] {v['name']} | {v['address']} | "
        f"{'⭐ ' + str(v['rating']) if v.get('rating') else 'no rating'} | "
        f"{', '.join(v['types'][:2]) if v.get('types') else ''} | "
        f"Progression: {v.get('progression', 0.0)*100:.0f}% along route"
        for i, v in enumerate(venues)
    ]
    venues_context = "\n".join(venue_lines)

    # Keep a soft per-stop floor for feasibility checking only — the LLM does the real allocation
    _stops = request.num_stops if request.num_stops else 3
    _walk_per_leg_mins = 12  # realistic city block walking between nearby stops
    _walk_allowance = _walk_per_leg_mins * _stops
    _per_stop_mins = max(15, (request.time_budget_minutes - _walk_allowance) // _stops)  # used as budget floor reference only

    weather_prompt_chunk = ""
    if weather_info:
        weather_prompt_chunk = (
            f"CURRENT WEATHER CONDITION: {weather_info['main']} ({weather_info['description']}), Temperature: {weather_info['temp_c']}°C.\n"
        )
        if weather_info["is_adverse"]:
            weather_prompt_chunk += (
                "IMPORTANT: It is currently raining/snowing/storming at the starting location. "
                "You MUST prioritize indoor stops (museums, indoor markets, cozy cafes, bookstores) and covered areas. "
                "Avoid suggesting parks, open plazas, or un-sheltered outdoor walks.\n"
            )
        else:
            weather_prompt_chunk += (
                "The weather is clear/good. You may prioritize scenic outdoor stops if appropriate for the vibe.\n"
            )

    time_prompt_chunk = ""
    if local_time:
        time_prompt_chunk = f"CURRENT LOCAL TIME: {local_time}.\n"
    time_prompt_chunk += (
        "IMPORTANT: Tailor the recommended stops to the time of day. "
        "For example, if it is late night (e.g. after 8 PM), do not recommend coffee shops or bookstores that close early; "
        "instead suggest bars, evening diners, or late-night dessert spots. If it is morning, suggest coffee shops and breakfast spots.\n"
        "DAYPART TRANSITIONING RULE: If the time budget spans across major dayparts (e.g., starting at 4:00 PM for 3 hours), logically sequence the stops to transition with the day (e.g., afternoon activity -> sunset view -> dinner/evening drinks). Do not suggest coffee shops at 7 PM.\n"
    )

    companion_prompt_chunk = ""
    comp = (request.companion or "solo").lower()
    if comp == "solo":
        companion_prompt_chunk = (
            "COMPANION PROFILE: You are walking SOLO. "
            "Prioritize quiet, contemplative spaces suitable for a single walker, such as "
            "independent bookstores, single garden benches, quiet art galleries, or quick coffee windows.\n"
        )
    elif comp == "date":
        companion_prompt_chunk = (
            "COMPANION PROFILE: You are on a DATE. "
            "Prioritize intimate, romantic, and high-vibe spaces with cozy atmospheres "
            "(e.g., dimly lit cocktail bars, scenic overlooks, beautiful architecture, shared desserts). "
            "Explain how the atmosphere accommodates conversation and connection.\n"
        )
    elif comp == "friends":
        companion_prompt_chunk = (
            "COMPANION PROFILE: You are walking with FRIENDS. "
            "Prioritize social, fun, and group-friendly spaces where multiple people can interact "
            "(e.g., food halls, park lawns, interactive pop-up galleries, lively breweries, game cafes).\n"
        )
    elif comp == "pet":
        companion_prompt_chunk = (
            "COMPANION PROFILE: You are walking with a PET (dog-friendly). "
            "You MUST strictly prioritize open-air, outdoor dog-friendly spaces "
            "(e.g., public parks, waterfront paths, open-air cafes with dog-friendly patios, pet boutiques). "
            "Avoid strictly indoor spaces where pets are prohibited unless there is an outdoor seating option.\n"
        )

    exclude_prompt_chunk = ""
    if previously_selected:
        exclude_prompt_chunk = (
            f"EXCLUDED VENUES: Do NOT use any of these venues as they have been used in previous routes: {', '.join(previously_selected)}.\n"
        )

    free_prompt_chunk = ""
    if request.free_only:
        free_prompt_chunk = (
            "IMPORTANT: The user requested FREE stops only. You MUST prioritize public parks, "
            "free museums, public libraries, landmarks, open plazas, or public sights. "
            "Do NOT select any commercial restaurants, bars, cafes, or retail stores unless "
            "the stop is strictly for a free activity (e.g. browsing a public space) "
            "and specify that it does not require a purchase. "
            "If a venue has no confirmed free entry, DO NOT select it. Only pick venues where entry is definitively free: "
            "public parks, free museums on free-entry days, public plazas, public libraries, or stated free attractions.\n"
        )

    budget_prompt_chunk = ""
    if request.max_budget_usd is not None:
        budget_limit = request.max_budget_usd
        if budget_limit >= 150:
            budget_prompt_chunk = (
                "BUDGET CONSTRAINT: The user has set an UNLIMITED budget. Feel free to suggest premium venues "
                "or high-end spots if appropriate for the vibe, but keep estimations realistic.\n"
            )
        else:
            budget_prompt_chunk = (
                f"BUDGET CONSTRAINT: The user has set a MAXIMUM budget of ${budget_limit} USD per person for the entire route.\n"
                f"You MUST select stops such that the sum of estimated_cost_usd for all stops does NOT exceed ${budget_limit} USD.\n"
                "To stay within budget, curate a mix of free stops (parks, galleries, free landmarks) and paid stops. "
                "Do NOT recommend high-end/expensive venues if the budget is low. Be extremely conscious of cost allocation.\n"
            )

    system_prompt = f"""You are wander — an urban experience curator with encyclopedic local knowledge.
Your life isn't a chore; wander. Help the user feel that.

VERIFIED VENUES (sourced from Google Places — these are real, confirmed businesses, sorted in order of geographical progression from Start (0%) to End (100%)):
{venues_context}

MISSION: Build exactly ONE walking route from {request.start_location} to {request.end_location} matching this theme: {route_type_desc}.
The route must use exactly {_stops} stops chosen ONLY from the numbered list above.

TIME BUDGET: {request.time_budget_minutes} minutes TOTAL.
→ TARGET: The route should USE approximately {request.time_budget_minutes} minutes.
→ IMPORTANT: Do NOT split duration_mins evenly across stops. Assign realistic durations based on venue type:

VENUE TYPE DURATION TABLE (use as your reference — adjust within ranges based on vibe and companion):
  • coffee shop / café / espresso bar     → 15–25 min  (quick fuel-up, not a sit-down meal)
  • cocktail bar / wine bar / brewery     → 25–45 min  (a drink or two, social pace)
  • restaurant / brunch spot              → 35–60 min  (depends on companion; date = longer)
  • art gallery / museum                  → 30–60 min  (browsing, reading labels, absorbing)
  • bookstore / record shop / boutique    → 20–40 min  (browsing, discovery)
  • park / garden / waterfront / plaza    → 15–35 min  (stroll, sit, decompress)
  • market / food hall                    → 25–45 min  (tasting, wandering stalls)
  • cultural landmark / historic site     → 20–35 min  (viewing, photo, reflection)
  • spa / wellness / fitness              → 45–90 min  (experience-based)
  • rooftop / scenic viewpoint            → 15–25 min  (soak in the view, move on)

Rules for duration:
  1. Vary durations meaningfully — no two stops should have the exact same duration unless it's genuinely fitting.
  2. Ensure: sum of all duration_mins + sum of all walk_to_next_mins + initial_walk_mins ≤ {request.time_budget_minutes}.
  3. If budget is tight, shorten coffee/viewpoint stops first. Never cut a gallery or restaurant below its minimum.
  4. Solo and pet walks trend shorter per stop; date and friends trend longer.

For reference, remaining time after walking ≈ {_per_stop_mins * _stops} min to split across {_stops} stops.

{weather_prompt_chunk}
{time_prompt_chunk}
{companion_prompt_chunk}
{exclude_prompt_chunk}
{free_prompt_chunk}
{budget_prompt_chunk}

STRICT RULES:
1. Use ONLY venues from the list. Reference each by its [number] in venue_index. No invented stops.
2. Stops must progress geographically from {request.start_location} to {request.end_location}. Because the list above is sorted in increasing order of geographical progression, you MUST select your stops in strictly increasing index order (e.g., if your first stop is [3], your next stop must be [5] or higher, and the next even higher). Select stops that are distributed along the progression of the route (e.g., one from the early part of the list, one from the middle, and one from the later part of the list). Do NOT cluster all stops at the start or the end. Zero backtracking.
3. Hard cap: total time (duration_mins + walk_to_next_mins for all stops) ≤ {request.time_budget_minutes} min.
4. Write like a local who has lived here 10 years. Specific, warm. Never say "charming" or "vibrant."
5. Insider tips must be genuinely useful and specific to this exact venue.
6. Culinary Targeting: If the user's custom vibe explicitly mentions specific cuisines, high-end dining, or specific food items, you MUST heavily weight your selection toward venues in the verified list that match this, ignoring generic stops.
7. Accessibility: If the user requests wheelchair accessibility or 'no stairs', you must explicitly select venues that are accessible and plan routes that avoid known steep inclines or stairways based on your geographic knowledge.

Active vibe / custom request: {request.vibe}"""

    class DynamicRouteOptionLLM(BaseModel):
        route_name: str = Field(..., description="Creative 3–5 word route name e.g. 'The Slow Burn Drift'")
        theme_summary: str = Field(
            ...,
            description="One sentence distinguishing this route's character from the other two",
        )
        waypoints: List[SelectedWaypointLLM] = Field(
            ...,
            min_length=_stops,
            max_length=_stops,
            description=f"Exactly {_stops} stops selected from the verified venue list, in geographic order",
        )
        estimated_total_cost_usd: int = Field(
            ...,
            description="The sum of estimated_cost_usd for all waypoints in this route.",
        )

    response = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Generate ONE route matching theme '{route_type_desc}' from {request.start_location} to {request.end_location}. "
                    f"Vibe: {request.vibe}."
                ),
            },
        ],
        response_format=DynamicRouteOptionLLM,
        temperature=0.35,
    )
    return response.choices[0].message.parsed





async def _enrich_route(
    request: RouteRequest,
    raw_route: RouteOptionLLM,
    venues: List[Dict],
    start_ll: Dict,
    end_ll: Dict
) -> WanderRouteOptionV3:
    """Enrich LLM selected stops with Google Places details, geocodes, and walking times."""
    waypoints: List[WaypointV3] = []
    addresses: List[str] = []

    for i, wp in enumerate(raw_route.waypoints):
        idx = wp.venue_index - 1
        venue = venues[idx] if (0 <= idx < len(venues)) else None

        name     = venue["name"].lower().rstrip('.') if venue else f"stop {i + 1}"
        address  = venue["address"]   if venue else request.start_location
        rating   = venue.get("rating")    if venue else None
        photo_url = venue.get("photo_url") if venue else None
        place_id = venue.get("place_id")  if venue else None
        lat      = venue.get("lat")       if venue else None
        lng      = venue.get("lng")       if venue else None

        addresses.append(address)
        waypoints.append(
            WaypointV3(
                order=i + 1,
                location_name=name,
                address_hint=address,
                google_rating=rating,
                photo_url=photo_url,
                place_id=place_id,
                lat=lat,
                lng=lng,
                action_description=wp.action_description.lower().rstrip('.'),
                duration_mins=wp.duration_mins,
                walk_to_next_mins=0,  # filled below
                vibe_tag=wp.vibe_tag.lower().rstrip('.'),
                insider_tip=wp.insider_tip.lower().rstrip('.'),
                estimated_cost_usd=wp.estimated_cost_usd,
            )
        )

    # Real walking times from Directions API using coordinates to avoid mismatched text addresses
    directions_locations = []
    if start_ll:
        directions_locations.append(f"{start_ll['lat']},{start_ll['lng']}")
    else:
        directions_locations.append(request.start_location)
        
    for wp in waypoints:
        if wp.lat is not None and wp.lng is not None:
            directions_locations.append(f"{wp.lat},{wp.lng}")
        else:
            directions_locations.append(wp.address_hint)
            
    if end_ll:
        directions_locations.append(f"{end_ll['lat']},{end_ll['lng']}")
    else:
        directions_locations.append(request.end_location)

    legs_info = await get_route_legs_info(directions_locations)
    
    initial_walk_mins = legs_info[0]["duration_mins"] if legs_info else 0
    for i, wp_obj in enumerate(waypoints):
        wp_obj.walk_to_next_mins = legs_info[i + 1]["duration_mins"] if i + 1 < len(legs_info) else 0

    # If avoid_slopes is requested, check the elevation profile of all legs in parallel
    if request.avoid_slopes:
        async with httpx.AsyncClient(timeout=10.0) as client:
            slope_tasks = [
                check_leg_incline_steep(client, leg["polyline"], leg["distance_m"])
                for leg in legs_info
            ]
            slope_results = await asyncio.gather(*slope_tasks, return_exceptions=True)
        
        for slope_res in slope_results:
            if isinstance(slope_res, bool) and slope_res:
                logger.warning(f"Slope reject: route '{raw_route.route_name}' discarded because it contains a steep leg (> 8% slope)")
                raise ValueError("Route contains a leg with a steep incline (> 8% slope).")

    walking_only_mins = sum(w.walk_to_next_mins for w in waypoints) + initial_walk_mins
    total_time = sum(w.duration_mins + w.walk_to_next_mins for w in waypoints) + initial_walk_mins

    # ── a) Geometry validation ─────────────────────────────────────────────────
    # If the real Google walking time alone chews >85% of the budget the AI
    # hallucinated a zigzag route — no time left for stops.  Raise so the caller
    # can skip this candidate and try another.
    budget = request.time_budget_minutes
    walk_ratio = walking_only_mins / budget if budget > 0 else 0
    if walk_ratio > 0.85:
        logger.warning(
            f"Geometry reject: walking={walking_only_mins}m budget={budget}m "
            f"ratio={walk_ratio:.2f} — route '{raw_route.route_name}' discarded"
        )
        raise ValueError(
            f"Route geometry invalid: {walking_only_mins} min walking in {budget} min budget "
            f"(ratio {walk_ratio:.2f})"
        )

    estimated_total_cost_usd = sum(w.estimated_cost_usd or 0 for w in waypoints)

    return WanderRouteOptionV3(
        route_name=raw_route.route_name.lower().rstrip('.'),
        theme_summary=raw_route.theme_summary.lower().rstrip('.'),
        total_walking_time_mins=total_time,
        initial_walk_mins=initial_walk_mins,
        start_location=request.start_location,
        end_location=request.end_location,
        start_lat=start_ll["lat"] if start_ll else None,
        start_lng=start_ll["lng"] if start_ll else None,
        end_lat=end_ll["lat"] if end_ll else None,
        end_lng=end_ll["lng"] if end_ll else None,
        waypoints=waypoints,
        navigation_deep_link=build_maps_deep_link(
            f"{start_ll['lat']},{start_ll['lng']}" if start_ll else request.start_location,
            f"{end_ll['lat']},{end_ll['lng']}" if end_ll else request.end_location,
            [f"{w.lat},{w.lng}" if (w.lat is not None and w.lng is not None) else w.address_hint for w in waypoints],
            [w.place_id for w in waypoints if w.place_id],
        ),
        estimated_total_cost_usd=estimated_total_cost_usd,
    )



# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "wandering",
        "version": "3.0.0",
        "langsmith": _LANGSMITH,
        "google": bool(GOOGLE_KEY),
        "tagline": "Your life isn't a chore; wander.",
    }


@app.post("/api/generate-route")
async def generate_route(request: RouteRequest):
    async def event_generator():
        try:
            # 0. Stops-vs-Budget Heuristic Check
            req_stops = request.num_stops or 3
            if request.time_budget_minutes < req_stops * 15:
                raise Exception(
                    f"impossible: a {request.time_budget_minutes}m budget is too short for {req_stops} stops (each stop needs 15m minimum)"
                )

            # 1. Geocode
            yield "data: " + json.dumps({"type": "status", "message": "pinpointing locations..."}) + "\n\n"
            await asyncio.sleep(0.05)
            
            start_ll = None
            end_ll = None
            if GOOGLE_KEY:
                start_ll = await geocode_location(request.start_location)
                if not start_ll:
                    raise Exception(f"could not pinpoint starting location: '{request.start_location}'")
                end_ll   = await geocode_location(request.end_location)
                if not end_ll:
                    raise Exception(f"could not pinpoint destination location: '{request.end_location}'")
            else:
                raise Exception("Google Maps API Key not configured")

            # 1.5. Base Walk Sanity Check
            yield "data: " + json.dumps({"type": "status", "message": "verifying distance feasibility..."}) + "\n\n"
            dist_m = _coordinate_distance_m(start_ll, end_ll)
            base_walk_mins = 0
            if dist_m > 100.0:  # Only check if they are not the same place
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        res = await client.get(
                            "https://maps.googleapis.com/maps/api/directions/json",
                            params={
                                "origin": f"{start_ll['lat']},{start_ll['lng']}",
                                "destination": f"{end_ll['lat']},{end_ll['lng']}",
                                "mode": "walking",
                                "key": GOOGLE_KEY,
                            },
                        )
                        data = res.json()
                        if data.get("status") == "OK":
                            secs = data["routes"][0]["legs"][0]["duration"]["value"]
                            base_walk_mins = round(secs / 60)
                        else:
                            base_walk_mins = int((dist_m * 1.3) / 80.0)
                except Exception:
                    base_walk_mins = int((dist_m * 1.3) / 80.0)

            # We need to leave at least 15 minutes of stop buffer time
            min_buffer_mins = 15
            if base_walk_mins > (request.time_budget_minutes - min_buffer_mins):
                h = base_walk_mins // 60
                m = base_walk_mins % 60
                time_str = f"{h}h {m}m" if h > 0 else f"{m} mins"
                raise Exception(
                    f"Your start and end locations are too far apart to walk within your time budget. "
                    f"It would take approximately {time_str} just to walk directly between them (leaving no time for stops). "
                    f"Try picking closer locations or increasing your time budget."
                )

            # 2. Weather
            yield "data: " + json.dumps({"type": "status", "message": "checking local weather..."}) + "\n\n"
            weather_info = await _get_weather(start_ll["lat"], start_ll["lng"])
            weather_text = ""
            if weather_info:
                weather_text = f"{weather_info['main']}, {weather_info['temp_c']}°C"
                yield "data: " + json.dumps({"type": "weather", "weather_context": weather_text}) + "\n\n"

            venues = []
            if not GOOGLE_KEY:
                raise Exception("Google Maps API Key not configured")

            yield "data: " + json.dumps({"type": "status", "message": "searching for verified venues..."}) + "\n\n"
            
            # Check for custom vibe and extract queries if needed
            if request.vibe == "Feeling Lucky":
                yield "data: " + json.dumps({"type": "status", "message": "spinning the wheel: generating a surprise theme..."}) + "\n\n"
                queries = await _extract_lucky_queries()
            elif request.vibe not in VIBE_QUERIES:
                yield "data: " + json.dumps({"type": "status", "message": f"interpreting custom vibe: '{request.vibe}'..."}) + "\n\n"
                queries = await _extract_custom_queries(request.vibe)
            else:
                queries = VIBE_QUERIES[request.vibe]
            
            # 1. Dynamic Radius & Loop Check
            dist_m = _coordinate_distance_m(start_ll, end_ll)
            is_round_trip = dist_m < 50.0  # Identical or near-identical start and end
            
            time_scale_radius = (request.time_budget_minutes / 30.0) * 500.0
            
            if is_round_trip:
                # Loop / Round Trip: search radius scaled down so walking time doesn't consume the budget
                radius_m = max(600.0, min(1500.0, time_scale_radius * 0.4))
                centers = [start_ll]
                print(f"Round Trip detected. Radius: {radius_m:.0f}m, Center: {start_ll}")
            else:
                # Progression route: radius scales with distance and time budget
                radius_m = max(500.0, min(3000.0, (dist_m / 3.0) * 0.7 + time_scale_radius * 0.3))
                
                def interpolate(a, b, fraction):
                    return {
                        "lat": a["lat"] + (b["lat"] - a["lat"]) * fraction,
                        "lng": a["lng"] + (b["lng"] - a["lng"]) * fraction
                    }
                
                centers = [
                    interpolate(start_ll, end_ll, 0.25),
                    interpolate(start_ll, end_ll, 0.50),
                    interpolate(start_ll, end_ll, 0.75),
                ]
                print(f"Progression route. Distance: {dist_m:.0f}m, Radius: {radius_m:.0f}m, Centers: 3 points")

            tasks = []
            for center in centers:
                for q in queries:
                    tasks.append(_places_search_text(q, center["lat"], center["lng"], radius_m=radius_m))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for r in results:
                if isinstance(r, Exception):
                    raise r
            
            seen = set()
            for batch in results:
                if isinstance(batch, list):
                    for place in batch:
                        pid = place.get("place_id") or place.get("name", "")
                        if pid and pid not in seen and place.get("name"):
                            seen.add(pid)
                            
                            # Compute vector progression percentage along the start -> end vector
                            if is_round_trip:
                                # For a loop route, sort by polar angle around start to form a natural loop
                                angle = math.atan2(place["lat"] - start_ll["lat"], place["lng"] - start_ll["lng"])
                                # Map angle from [-pi, pi] to [0.0, 1.0]
                                progression = (angle + math.pi) / (2.0 * math.pi)
                            else:
                                v_lat = end_ll["lat"] - start_ll["lat"]
                                v_lng = end_ll["lng"] - start_ll["lng"]
                                u_lat = place["lat"] - start_ll["lat"]
                                u_lng = place["lng"] - start_ll["lng"]
                                
                                dot_product = u_lat * v_lat + u_lng * v_lng
                                vector_sq_len = v_lat**2 + v_lng**2
                                progression = dot_product / vector_sq_len if vector_sq_len > 0 else 0.0
                            
                            place["progression"] = max(0.0, min(1.0, progression))
                            venues.append(place)
            # ── Fix #5: Better freeOnly filter ───────────────────────────────
            if request.free_only:
                FREE_FRIENDLY_TYPES = {
                    "park", "tourist_attraction", "museum", "library",
                    "art_gallery", "place_of_worship", "natural_feature", "point_of_interest",
                }
                COMMERCIAL_FOOD_TYPES = {
                    "restaurant", "bar", "cafe", "food", "bakery", "night_club", "liquor_store",
                }
                def _is_free_friendly(v: Dict) -> bool:
                    price = v.get("price_level")
                    # Exclude definitively paid venues
                    if price in ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"]:
                        return False
                    types_set = set(v.get("types", []))
                    # Always keep free-friendly venue types
                    if types_set & FREE_FRIENDLY_TYPES:
                        return True
                    # Exclude commercial food/drink venues with no price signal (likely paid)
                    if types_set and types_set.issubset(COMMERCIAL_FOOD_TYPES) and price is None:
                        return False
                    return True
                venues = [v for v in venues if _is_free_friendly(v)]
            
            # Raise an explicit exception if we cannot construct a valid RAG route
            req_stops = request.num_stops if request.num_stops else 3
            if len(venues) < req_stops:
                raise Exception("We couldn't find enough verified venues matching this vibe in this exact area. Try expanding your search or changing the vibe.")

            # Sort by rating and keep top 25 candidates to provide a rich spatial spread
            venues.sort(key=lambda x: x.get("rating") or 0, reverse=True)
            venues = venues[:25]
            
            # Sort the final candidates by geographical progression to prevent backtracking and ease LLM sequencing
            venues.sort(key=lambda x: x.get("progression", 0.0))

            # ── Fix #9: Dynamic route archetypes based on vibe ────────────────
            route_types_list = VIBE_ROUTE_ARCHETYPES.get(request.vibe, DEFAULT_ARCHETYPES)
            route_types = [(f"Route {i+1} ({label})", desc) for i, (label, desc) in enumerate(route_types_list)]

            previously_selected = []
            
            # ── RAG route generation ──
            for idx, (route_label, route_type_desc) in enumerate(route_types):
                yield "data: " + json.dumps({"type": "status", "message": f"curating {route_label}..."}) + "\n\n"
                try:
                    raw_route = await asyncio.to_thread(
                        _call_openai_single_route_sync,
                        request,
                        venues,
                        route_type_desc,
                        previously_selected,
                        weather_info,
                        request.local_time
                    )
                    # Programmatically sort waypoints by progression to guarantee zero backtracking (only on progression routes)
                    if not is_round_trip:
                        raw_route.waypoints.sort(
                            key=lambda wp: venues[wp.venue_index - 1].get("progression", 0.0)
                            if (0 <= wp.venue_index - 1 < len(venues)) else 0.0
                        )
                    enriched = await _enrich_route(request, raw_route, venues, start_ll, end_ll)
                    for wp in enriched.waypoints:
                        if wp.location_name:
                            previously_selected.append(wp.location_name)
                            
                    yield "data: " + json.dumps({
                        "type": "route",
                        "index": idx,
                        "route": enriched.model_dump()
                    }) + "\n\n"
                except ValueError as geo_err:
                    # Geometry validation failure — skip this route, log to client
                    logger.warning(f"Skipping {route_label} due to geometry: {geo_err}")
                    yield "data: " + json.dumps({
                        "type": "geometry_skip",
                        "index": idx,
                        "reason": str(geo_err)
                    }) + "\n\n"
                except Exception as e:
                    print(f"Error curating RAG {route_label}: {e}")
                    raise Exception(f"Curator encountered an error making {route_label}: {str(e)}")

            yield "data: " + json.dumps({"type": "done"}) + "\n\n"
            
        except Exception as e:
            print(f"Streaming error: {e}")
            yield "data: " + json.dumps({"type": "error", "detail": str(e)}) + "\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/shares")
def create_share(request: ShareRequest):
    try:
        share_id = database.save_route(request.route.model_dump(), request.vibe)
        return {"id": share_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/shares/{id}", response_model=WanderV3Response)
def get_share(id: str):
    try:
        route_data = database.get_route(id)
        if not route_data:
            raise HTTPException(status_code=404, detail="Route not found")
        # Return as a list of routes with a single element
        return WanderV3Response(routes=[WanderRouteOptionV3(**route_data)])
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reverse-geocode")
async def reverse_geocode(lat: float, lng: float):
    """Securely reverse geocode coordinates to a neighborhood name for passport stamps."""
    if not GOOGLE_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")
    
    async with httpx.AsyncClient() as client:
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={GOOGLE_KEY}"
        resp = await client.get(url)
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            result = data["results"][0]
            formatted_address = result.get("formatted_address", f"{lat:.4f}, {lng:.4f}")

            # ── Fix #3: Extract neighborhood from address_components ──────────
            components = result.get("address_components", [])
            neighborhood = None
            # Try types in priority order
            for target_type in ["neighborhood", "sublocality_level_1", "sublocality", "locality"]:
                for comp in components:
                    if target_type in comp.get("types", []):
                        neighborhood = comp["long_name"]
                        break
                if neighborhood:
                    break

            # Fallback: split formatted_address and take the second-to-last component before state
            if not neighborhood:
                parts = [p.strip() for p in formatted_address.split(",")]
                # formatted_address is typically: street, neighborhood/city, state zip, country
                if len(parts) >= 3:
                    neighborhood = parts[-3]  # second-to-last before "State ZIP, Country"
                elif len(parts) >= 2:
                    neighborhood = parts[-2]
                else:
                    neighborhood = formatted_address

            return {"address": neighborhood, "full_address": formatted_address}
        
        # If ZERO_RESULTS or other errors, fallback to coordinates
        return {"address": f"{lat:.4f}, {lng:.4f}", "full_address": f"{lat:.4f}, {lng:.4f}"}


@app.post("/api/pacing-advisor", response_model=AdvisorResponse)
async def pacing_advisor(request: AdvisorRequest):
    # Try geocoding start and end
    start_ll = await geocode_location(request.start_location)
    if not start_ll:
        raise HTTPException(status_code=400, detail=f"could not pinpoint starting location: '{request.start_location}'")
    end_ll = await geocode_location(request.end_location)
    if not end_ll:
        raise HTTPException(status_code=400, detail=f"could not pinpoint destination location: '{request.end_location}'")
        
    dist_m = _coordinate_distance_m(start_ll, end_ll)
    
    # Query Google Directions API if distance > 100 meters, matching route generation
    base_walk_mins = 0
    if dist_m > 100.0:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://maps.googleapis.com/maps/api/directions/json",
                    params={
                        "origin": f"{start_ll['lat']},{start_ll['lng']}",
                        "destination": f"{end_ll['lat']},{end_ll['lng']}",
                        "mode": "walking",
                        "key": GOOGLE_KEY,
                    },
                )
                data = res.json()
                if data.get("status") == "OK":
                    secs = data["routes"][0]["legs"][0]["duration"]["value"]
                    base_walk_mins = round(secs / 60)
                else:
                    base_walk_mins = int((dist_m * 1.3) / 80.0)
        except Exception:
            base_walk_mins = int((dist_m * 1.3) / 80.0)
    else:
        base_walk_mins = 0
    
    # Heuristics safety check: force impossible status if budget is less than 15 mins per stop
    if request.time_budget_minutes < request.num_stops * 15:
        return AdvisorResponse(
            detected_neighborhood="unknown neighborhood",
            density_level="medium",
            recommended_stops=max(2, request.time_budget_minutes // 15),
            pacing_message=f"impossible: a {request.time_budget_minutes}m budget is too short for {request.num_stops} stops (each stop needs 15m minimum)",
            feasibility_status="impossible",
            density_badge_message="tight spacing detected",
            weather_advice="too rushed to enjoy"
        )
        
    if base_walk_mins > (request.time_budget_minutes - 10):
        return AdvisorResponse(
            detected_neighborhood="unknown neighborhood",
            density_level="medium",
            recommended_stops=2,
            pacing_message=f"impossible: walking directly between these places takes {base_walk_mins}m, exceeding your {request.time_budget_minutes}m budget",
            feasibility_status="impossible",
            density_badge_message="locations too far",
            weather_advice="locations are too far apart"
        )

    # Call weather API at start location
    weather_info = await _get_weather(start_ll["lat"], start_ll["lng"])
    weather_str = "unknown weather"
    if weather_info:
        weather_str = f"{weather_info['main']} ({weather_info['description']}), {weather_info['temp_c']}°C"
        
    system_prompt = (
        "you are a smart walking pacing advisor for the 'wander' app. "
        "your goal is to evaluate if a walking itinerary is feasible and provide a warm, all-lowercase advice message.\n\n"
        "guidelines:\n"
        "1. never use any capital letters (e.g. use 'chelsea', not 'Chelsea').\n"
        "2. never end any sentences with a period. use playful, relaxed punctuation (like commas or exclamation marks if needed).\n"
        "3. assess the walking distance (in meters), budget (in minutes), requested stop count, weather, companion type, and local time.\n"
        "4. assign a feasibility_status:\n"
        "   - 'optimal' if there is plenty of time to walk and enjoy each stop (at least 15-20 minutes per stop + walk time).\n"
        "   - 'tight' if they are cutting it close (under 15 minutes per stop including walking, but physically possible).\n"
        "   - 'impossible' if the base walk time alone exceeds the budget, or if budget is less than 12 mins per stop.\n"
        "5. detect the neighborhood based on the start/end location (e.g. 'greenwich village').\n"
        "6. detect density: 'high' for high-density areas (many venues nearby, e.g. Manhattan, downtowns), 'medium', or 'low'.\n"
        "7. recommend an optimal stop count (recommended_stops) between 2 and 5: high density allows more stops (3-4), low density or adverse weather should recommend fewer stops (2-3).\n"
        "8. provide a pacing_message in lowercase explaining your assessment (e.g. '3 stops is perfect for a breezy stroll through Soho').\n"
        "9. write a density_badge_message like: 'density-optimized: 3 stops suggested for greenwich village'.\n"
        "10. write a weather_advice string if weather is rainy/cold (e.g., 'rainy today: we recommend 2 indoor stops')."
    )

    # Query OpenAI to get the advice
    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(
            None,
            lambda: openai_client.beta.chat.completions.parse(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Start Location: {request.start_location}\n"
                            f"End Location: {request.end_location}\n"
                            f"Distance: {dist_m:.1f} meters (direct line), base walk time: {base_walk_mins} minutes\n"
                            f"Time Budget: {request.time_budget_minutes} minutes\n"
                            f"Requested Stops: {request.num_stops}\n"
                            f"Companion: {request.companion}\n"
                            f"Local Time: {request.local_time or 'unknown'}\n"
                            f"Current Weather: {weather_str}"
                        )
                    }
                ],
                response_format=AdvisorResponse,
                temperature=0.2
            )
        )
        parsed = response.choices[0].message.parsed
        # If there's weather advice and weather is adverse, fill it
        if weather_info and weather_info["is_adverse"] and not parsed.weather_advice:
            parsed.weather_advice = f"rainy weather: we recommend choosing fewer outdoor stops today"
        
        # Enforce all-lowercase branding and period-free on text fields
        parsed.detected_neighborhood = parsed.detected_neighborhood.lower().rstrip(".")
        parsed.pacing_message = parsed.pacing_message.lower().rstrip(".")
        parsed.density_badge_message = parsed.density_badge_message.lower().rstrip(".")
        if parsed.weather_advice:
            parsed.weather_advice = parsed.weather_advice.lower().rstrip(".")
            
        return parsed
    except Exception as e:
        print(f"Error calling pacing advisor LLM: {e}")
        # fallback
        return AdvisorResponse(
            detected_neighborhood="local area",
            density_level="medium",
            recommended_stops=request.num_stops,
            pacing_message=f"looks good: {request.num_stops} stops in {request.time_budget_minutes}m",
            feasibility_status="optimal",
            density_badge_message="density-optimized suggestions active",
            weather_advice=None
        )


class SwappedWaypointLLM(BaseModel):
    selected_candidate_index: int = Field(..., description="Index (1-based) of the selected candidate from the list")
    action_description: str = Field(..., description="Playful, lowercase action description tailored to this stop and the companion profile")
    duration_mins: int = Field(..., description="Realistic duration in minutes (e.g. 15-45 mins depending on type)")
    vibe_tag: str = Field(..., description="1-2 word micro-label e.g. 'Coffee Fix', 'Secret Garden'")
    insider_tip: str = Field(..., description="Genuinely useful insider tip specific to this venue")
    estimated_cost_usd: int = Field(..., description="Estimated cost in USD per person for this stop. Use 0 for free stops.")


class WaypointSwapRequest(BaseModel):
    route: WanderRouteOptionV3
    index: int
    vibe: str
    custom_refinement: Optional[str] = None
    max_budget_usd: Optional[int] = 50


def _call_openai_single_venue_swap_sync(
    route: WanderRouteOptionV3,
    index: int,
    vibe: str,
    custom_refinement: Optional[str],
    candidates: List[Dict],
    max_budget_usd: Optional[int] = 50
) -> SwappedWaypointLLM:
    candidate_lines = [
        f"[{i+1}] {c['name']} | {c['address']} | "
        f"{'⭐ ' + str(c['rating']) if c.get('rating') else 'no rating'} | "
        f"{', '.join(c['types'][:2]) if c.get('types') else ''}"
        for i, c in enumerate(candidates)
    ]
    candidates_context = "\n".join(candidate_lines)

    # Context about the route
    prev_wp = route.waypoints[index - 1].location_name if index > 0 else "Start Location"
    next_wp = route.waypoints[index + 1].location_name if index + 1 < len(route.waypoints) else "End Location"
    current_wp = route.waypoints[index].location_name

    refinement_chunk = f"The user rejected the stop '{current_wp}' and wants a replacement stop instead."
    if custom_refinement:
        refinement_chunk += f" Specifically, they want: '{custom_refinement}'."

    current_other_stops_cost = sum(
        w.estimated_cost_usd or 0 for idx, w in enumerate(route.waypoints) if idx != index
    )
    remaining_budget = max(0, max_budget_usd - current_other_stops_cost) if max_budget_usd is not None and max_budget_usd < 150 else None

    budget_chunk = ""
    if remaining_budget is not None:
        budget_chunk = (
            f"BUDGET CONSTRAINT: The current route has a total budget constraint. "
            f"The other stops already cost a total of ${current_other_stops_cost} USD. "
            f"This replacement stop MUST have an estimated_cost_usd of at most ${remaining_budget} USD "
            f"so that the overall route remains within the user's budget.\n"
        )

    system_prompt = f"""You are wander — an urban experience curator.
We need to replace exactly one stop in an existing itinerary.

CURRENT ROUTE SUMMARY:
- Route Name: {route.route_name}
- Current Stops: {', '.join(w.location_name for w in route.waypoints)}
- Swap Target Stop: '{current_wp}' at index {index} (between '{prev_wp}' and '{next_wp}')

REPLACEMENT REQUEST:
{refinement_chunk}

{budget_chunk}
CANDIDATE VENUES:
{candidates_context}

MISSION:
Choose exactly ONE venue from the candidate list that is the best replacement for the target stop. It must fit between the previous stop ('{prev_wp}') and next stop ('{next_wp}') logistically and thematically.
Return the index (1-based) of your choice and write a local, warm, lowercased action description and a specific insider tip.
Do not use capital letters or end sentences with periods. Write like a local who has lived here 10 years."""

    response = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Choose the best candidate and curate the waypoint details."}
        ],
        response_format=SwappedWaypointLLM,
        temperature=0.7
    )
    return response.choices[0].message.parsed


@app.post("/api/swap-waypoint", response_model=WanderRouteOptionV3)
async def swap_waypoint(request: WaypointSwapRequest):
    route = request.route
    index = request.index
    
    if index < 0 or index >= len(route.waypoints):
        raise HTTPException(status_code=400, detail="Invalid waypoint index")
        
    target_wp = route.waypoints[index]
    # Geocode fallbacks
    lat = target_wp.lat or route.start_lat or 40.7580
    lng = target_wp.lng or route.start_lng or -73.9855
    
    # 1. Places queries centered at the target stop coordinate
    if request.custom_refinement:
        # Extract specific queries from custom text
        queries = await _extract_custom_queries(request.custom_refinement)
    else:
        # Surprise me: pull from current vibe queries, or default
        queries = VIBE_QUERIES.get(request.vibe, ["unique cafe", "pocket park", "community garden", "independent bookstore", "scenic spot"])
        
    # Search around target waypoint
    results = await asyncio.gather(
        *[_places_search_text(q, lat, lng, radius_m=1200.0) for q in queries],
        return_exceptions=True
    )
    
    # Filter out current route waypoints (dedup by name/place_id)
    existing_place_ids = {wp.place_id for wp in route.waypoints if wp.place_id}
    existing_names = {wp.location_name.lower().strip() for wp in route.waypoints}
    
    def process_batches(batches):
        for r in batches:
            if isinstance(r, Exception):
                raise r
        seen = set()
        cands = []
        for batch in batches:
            if isinstance(batch, list):
                for place in batch:
                    pid = place.get("place_id") or place.get("name", "")
                    if pid and pid not in seen and place.get("name"):
                        seen.add(pid)
                        # Check if already in route
                        if pid in existing_place_ids:
                            continue
                        if place["name"].lower().strip() in existing_names:
                            continue
                        cands.append(place)
        return cands

    candidates = process_batches(results)
    
    # Fallback search if zero candidates found in 1.2km
    if not candidates:
        if request.custom_refinement:
            # Custom refinement fallback: just expand the radius to 2500m
            print(f"[SWAP FALLBACK] Retrying custom queries {queries} with radius=2500m")
            fallback_results = await asyncio.gather(
                *[_places_search_text(q, lat, lng, radius_m=2500.0) for q in queries],
                return_exceptions=True
            )
            candidates = process_batches(fallback_results)
        else:
            # Surprise me fallback: broaden queries and expand radius to 2500m
            broad_queries = []
            for q in queries:
                words = q.split()
                if len(words) > 1:
                    broad_queries.append(" ".join(words[:2]))
                    broad_queries.append(words[-1])
                else:
                    broad_queries.append(q)
            
            vibe_generics = {
                "Caffeinated & Cultured": ["cafe", "bookstore", "art gallery"],
                "Green & Scenic": ["park", "garden", "waterfront"],
                "Spontaneous & Social": ["bar", "food hall", "music venue"],
                "Mental Break": ["park", "cafe", "bakery"],
                "Off the Grid": ["historic landmark", "thrift store", "hidden garden"],
                "Feeling Lucky": ["speakeasy", "museum", "oddities"]
            }
            generics = vibe_generics.get(request.vibe, ["cafe", "park", "scenic spot"])
            broad_queries = list(set(broad_queries + generics))
            
            print(f"[SWAP FALLBACK] Retrying vibe queries {broad_queries} with radius=2500m")
            fallback_results = await asyncio.gather(
                *[_places_search_text(q, lat, lng, radius_m=2500.0) for q in broad_queries],
                return_exceptions=True
            )
            candidates = process_batches(fallback_results)
            
    # Sort candidates by rating
    candidates.sort(key=lambda x: x.get("rating") or 0, reverse=True)
    candidates = candidates[:10]
    
    if not candidates:
        raise HTTPException(status_code=404, detail="No suitable swap candidates found nearby. Try a different request.")
        
    # 2. Select replacement with LLM
    loop = asyncio.get_event_loop()
    try:
        swapped_llm = await loop.run_in_executor(
            None,
            lambda: _call_openai_single_venue_swap_sync(
                route,
                index,
                request.vibe,
                request.custom_refinement,
                candidates,
                request.max_budget_usd
            )
        )
    except Exception as e:
        print(f"Error calling swap LLM: {e}")
        raise HTTPException(status_code=500, detail=f"LLM swap curation failed: {str(e)}")
        
    # Build replacement WaypointV3
    idx = swapped_llm.selected_candidate_index - 1
    if idx < 0 or idx >= len(candidates):
        idx = 0
        
    selected_venue = candidates[idx]
    
    new_wp = WaypointV3(
        order=index + 1,
        location_name=selected_venue["name"].lower().rstrip('.'),
        address_hint=selected_venue["address"],
        google_rating=selected_venue.get("rating"),
        photo_url=selected_venue.get("photo_url"),
        place_id=selected_venue.get("place_id"),
        lat=selected_venue.get("lat"),
        lng=selected_venue.get("lng"),
        action_description=swapped_llm.action_description.lower().rstrip('.'),
        duration_mins=swapped_llm.duration_mins,
        walk_to_next_mins=0,
        vibe_tag=swapped_llm.vibe_tag.lower().rstrip('.'),
        insider_tip=swapped_llm.insider_tip.lower().rstrip('.'),
        estimated_cost_usd=swapped_llm.estimated_cost_usd,
    )
    
    # 3. Swap in route waypoints list
    route.waypoints[index] = new_wp
    
    # 4. Recompute walking times
    directions_locations = []
    if route.start_lat is not None and route.start_lng is not None:
        directions_locations.append(f"{route.start_lat},{route.start_lng}")
    else:
        directions_locations.append(route.start_location)
        
    for wp in route.waypoints:
        if wp.lat is not None and wp.lng is not None:
            directions_locations.append(f"{wp.lat},{wp.lng}")
        else:
            directions_locations.append(wp.address_hint)
            
    if route.end_lat is not None and route.end_lng is not None:
        directions_locations.append(f"{route.end_lat},{route.end_lng}")
    else:
        directions_locations.append(route.end_location)
        
    walk_times = await get_walking_times(directions_locations)
    
    route.initial_walk_mins = walk_times[0] if walk_times else 0
    for i, wp_obj in enumerate(route.waypoints):
        wp_obj.walk_to_next_mins = walk_times[i + 1] if i + 1 < len(walk_times) else 0
        
    # Recalculate total time
    route.total_walking_time_mins = sum(w.duration_mins + w.walk_to_next_mins for w in route.waypoints) + route.initial_walk_mins
    
    # Recalculate route total cost
    route.estimated_total_cost_usd = sum(w.estimated_cost_usd or 0 for w in route.waypoints)

    # Update navigation deep link
    route.navigation_deep_link = build_maps_deep_link(
        f"{route.start_lat},{route.start_lng}" if (route.start_lat is not None) else route.start_location,
        f"{route.end_lat},{route.end_lng}" if (route.end_lat is not None) else route.end_location,
        [f"{w.lat},{w.lng}" if (w.lat is not None and w.lng is not None) else w.address_hint for w in route.waypoints],
        [w.place_id for w in route.waypoints if w.place_id],
    )
    
    return route



