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
import os
from typing import Dict, List, Optional
from urllib.parse import quote_plus

import httpx
from dotenv import load_dotenv
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
TAVILY_KEY  = os.getenv("TAVILY_API_KEY", "")
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
}

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



class WanderV3Response(BaseModel):
    routes: List[WanderRouteOptionV3]
    weather_context: Optional[str] = None


class RouteRequest(BaseModel):
    start_location: str
    end_location: str
    time_budget_minutes: int
    vibe: str
    local_time: Optional[str] = None


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
    duration_mins: int = Field(..., description="Minutes to spend here (excluding walking)")
    vibe_tag: str = Field(..., description="1–3 word micro-label e.g. 'Hidden Gem', 'Coffee Fix'")
    insider_tip: str = Field(
        ...,
        description="One specific local secret: the best seat, off-menu item, or perfect time of day to visit",
    )


class RouteOptionLLM(BaseModel):
    route_name: str = Field(..., description="Creative 3–5 word route name e.g. 'The Slow Burn Drift'")
    theme_summary: str = Field(
        ...,
        description="One sentence distinguishing this route's character from the other two",
    )
    waypoints: List[SelectedWaypointLLM] = Field(
        ...,
        min_length=3,
        max_length=4,
        description="3–4 stops selected from the verified venue list, in geographic order",
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
                        "places.rating,places.types,places.location,places.photos"
                    ),
                },
            )
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
                    }
                )
            return places
    except Exception:
        return []


async def fetch_candidate_venues(start_ll: Dict, end_ll: Optional[Dict], vibe: str) -> List[Dict]:
    """
    Run all vibe-appropriate Places queries in parallel, centered on the route MIDPOINT.
    Uses strict locationRestriction so venues are guaranteed near the route corridor.
    Deduplicate by place_id and return top 20 sorted by rating.
    """
    queries = VIBE_QUERIES.get(vibe, VIBE_QUERIES["Spontaneous & Social"])

    # Center search on midpoint between start and end so venues are along the corridor
    center = _midpoint(start_ll, end_ll) if end_ll else start_ll
    lat, lng = center["lat"], center["lng"]

    results = await asyncio.gather(
        *[_places_search_text(q, lat, lng) for q in queries],
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


# ── Google Directions API ─────────────────────────────────────────────────────

async def get_walking_times(addresses: List[str]) -> List[int]:
    """
    Call Directions API between each consecutive pair of addresses.
    Returns a list of walk_mins per stop (last stop is always 0).
    Falls back to 8 min per leg on any error.
    """
    if len(addresses) < 2:
        return [0] * len(addresses)

    walk_times: List[int] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for i in range(len(addresses) - 1):
            try:
                res = await client.get(
                    "https://maps.googleapis.com/maps/api/directions/json",
                    params={
                        "origin": addresses[i],
                        "destination": addresses[i + 1],
                        "mode": "walking",
                        "key": GOOGLE_KEY,
                    },
                )
                data = res.json()
                if data.get("status") == "OK":
                    secs = data["routes"][0]["legs"][0]["duration"]["value"]
                    walk_times.append(round(secs / 60))
                else:
                    walk_times.append(8)
            except Exception:
                walk_times.append(8)

    walk_times.append(0)  # last stop never walks to a next stop
    return walk_times


# ── Deep-link builder ─────────────────────────────────────────────────────────

def build_maps_deep_link(start: str, end: str, waypoint_addresses: List[str]) -> str:
    """Build a URL-encoded Google Maps walking directions deep link."""
    origin      = quote_plus(start.strip())
    destination = quote_plus(end.strip())
    wp_str      = "|".join(quote_plus(a.strip()) for a in waypoint_addresses if a.strip())
    return (
        f"https://www.google.com/maps/dir/?api=1"
        f"&origin={origin}"
        f"&destination={destination}"
        f"&waypoints={wp_str}"
        f"&travelmode=walking"
    )


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
        f"{', '.join(v['types'][:2]) if v.get('types') else ''}"
        for i, v in enumerate(venues)
    ]
    venues_context = "\n".join(venue_lines)

    # Per-stop duration: budget minus realistic walking time (12 min per leg × n_stops legs)
    _stops = 3
    _walk_per_leg_mins = 12  # realistic city block walking between nearby stops
    _walk_allowance = _walk_per_leg_mins * _stops
    _per_stop_mins = max(15, (request.time_budget_minutes - _walk_allowance) // _stops)

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
        time_prompt_chunk = (
            f"CURRENT LOCAL TIME: {local_time}.\n"
            "IMPORTANT: Tailor the recommended stops to this time of day. "
            "For example, if it is late night (e.g. after 8 PM), do not recommend coffee shops or bookstores that close early; "
            "instead suggest bars, evening diners, or late-night dessert spots. If it is morning, suggest coffee shops and breakfast spots.\n"
        )

    exclude_prompt_chunk = ""
    if previously_selected:
        exclude_prompt_chunk = (
            f"EXCLUDED VENUES: Do NOT use any of these venues as they have been used in previous routes: {', '.join(previously_selected)}.\n"
        )

    system_prompt = f"""You are Wander — an urban experience curator with encyclopedic local knowledge.
Your life isn't a chore; wander. Help the user feel that.

VERIFIED VENUES (sourced from Google Places — these are real, confirmed businesses):
{venues_context}

MISSION: Build exactly ONE walking route from {request.start_location} to {request.end_location} matching this theme: {route_type_desc}.
The route must use 3–4 stops chosen ONLY from the numbered list above.

TIME BUDGET: {request.time_budget_minutes} minutes TOTAL.
→ TARGET: The route should USE approximately {request.time_budget_minutes} minutes.
→ Each stop should have duration_mins of approximately {_per_stop_mins} minutes (scale up for longer budgets).

{weather_prompt_chunk}
{time_prompt_chunk}
{exclude_prompt_chunk}

STRICT RULES:
1. Use ONLY venues from the list. Reference each by its [number] in venue_index. No invented stops.
2. Stops must flow geographically toward {request.end_location}. Zero backtracking.
3. Hard cap: total time (duration_mins + walk_to_next_mins for all stops) ≤ {request.time_budget_minutes} min.
4. Write like a local who has lived here 10 years. Specific, warm. Never say "charming" or "vibrant."
5. Insider tips must be genuinely useful and specific to this exact venue.

Active vibe / custom request: {request.vibe}"""

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
        response_format=RouteOptionLLM,
        temperature=0.85,
    )
    return response.choices[0].message.parsed


# ── Single Route OpenAI generation (Fallback mode) ────────────────────────────

def _call_openai_fallback_single_sync(
    request: RouteRequest,
    route_type_desc: str,
    previously_selected: List[str],
    weather_info: Optional[Dict],
    local_time: Optional[str]
) -> RouteOptionLLM:
    """Fallback when Google Places returns no results — GPT-4o generates a single route from knowledge."""
    _stops = 3
    _walk_per_leg_mins = 12
    _walk_allowance = _walk_per_leg_mins * _stops
    _per_stop_mins = max(15, (request.time_budget_minutes - _walk_allowance) // _stops)

    weather_prompt_chunk = ""
    if weather_info:
        weather_prompt_chunk = (
            f"CURRENT WEATHER CONDITION: {weather_info['main']} ({weather_info['description']}), Temperature: {weather_info['temp_c']}°C.\n"
        )
        if weather_info["is_adverse"]:
            weather_prompt_chunk += (
                "IMPORTANT: It is currently raining/snowing/storming at the starting location. "
                "You MUST prioritize indoor venues (museums, diners, bookstores) in the route.\n"
            )

    time_prompt_chunk = ""
    if local_time:
        time_prompt_chunk = (
            f"CURRENT LOCAL TIME: {local_time}.\n"
            "IMPORTANT: Recommend stops appropriate for this time of day (bars/diners for late night, cafes/bakeries for morning).\n"
        )

    exclude_prompt_chunk = ""
    if previously_selected:
        exclude_prompt_chunk = (
            f"EXCLUDED VENUES: Do NOT reuse these venues: {', '.join(previously_selected)}.\n"
        )

    system_prompt = f"""You are Wander. Generate exactly ONE walking route matching this theme: {route_type_desc}.
Your life isn't a chore; wander.

Each waypoint MUST have a venue_index. Set venue_index = order number of the stop.

TIME BUDGET: {request.time_budget_minutes} minutes TOTAL.
→ TARGET: The route should USE approximately {request.time_budget_minutes} minutes.
→ Per stop: approximately {_per_stop_mins} minutes duration_mins each.

{weather_prompt_chunk}
{time_prompt_chunk}
{exclude_prompt_chunk}

RULES:
1. REAL PLACES ONLY. Every stop must genuinely exist with a real street address in address_hint.
   The address_hint must be a full mappable street address like "750 11th Ave, New York, NY".
2. Stops flow geographically from origin to destination. No backtracking.
3. Hard cap: total (duration_mins + walk_to_next_mins) ≤ {request.time_budget_minutes} minutes.

Vibe / custom request: {request.vibe}"""

    response = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Generate ONE route from {request.start_location} "
                    f"to {request.end_location}. Vibe: {request.vibe}."
                ),
            },
        ],
        response_format=RouteOptionLLM,
        temperature=0.9,
    )
    return response.choices[0].message.parsed


async def _generate_fallback_route_single(
    request: RouteRequest,
    route_type_desc: str,
    previously_selected: List[str],
    weather_info: Optional[Dict],
    local_time: Optional[str]
) -> WanderRouteOptionV3:
    """Run single route fallback generation and structure as WanderRouteOptionV3."""
    raw_route = await asyncio.to_thread(
        _call_openai_fallback_single_sync,
        request,
        route_type_desc,
        previously_selected,
        weather_info,
        local_time
    )
    
    waypoints_fb: List[WaypointV3] = []
    for wp in raw_route.waypoints:
        waypoints_fb.append(
            WaypointV3(
                order=wp.order,
                location_name=f"Stop {wp.venue_index}",
                address_hint=request.start_location,
                google_rating=None,
                action_description=wp.action_description,
                duration_mins=wp.duration_mins,
                walk_to_next_mins=0,
                vibe_tag=wp.vibe_tag,
                insider_tip=wp.insider_tip,
            )
        )
    
    return WanderRouteOptionV3(
        route_name=raw_route.route_name,
        theme_summary=raw_route.theme_summary,
        total_walking_time_mins=sum(w.duration_mins for w in waypoints_fb),
        initial_walk_mins=0,
        start_location=request.start_location,
        end_location=request.end_location,
        start_lat=None,
        start_lng=None,
        end_lat=None,
        end_lng=None,
        waypoints=waypoints_fb,
        navigation_deep_link=build_maps_deep_link(
            request.start_location,
            request.end_location,
            [request.start_location] * len(waypoints_fb),
        ),
    )


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

    for wp in raw_route.waypoints:
        idx = wp.venue_index - 1
        venue = venues[idx] if (0 <= idx < len(venues)) else None

        name     = venue["name"]      if venue else f"Stop {wp.order}"
        address  = venue["address"]   if venue else request.start_location
        rating   = venue.get("rating")    if venue else None
        photo_url = venue.get("photo_url") if venue else None
        place_id = venue.get("place_id")  if venue else None
        lat      = venue.get("lat")       if venue else None
        lng      = venue.get("lng")       if venue else None

        addresses.append(address)
        waypoints.append(
            WaypointV3(
                order=wp.order,
                location_name=name,
                address_hint=address,
                google_rating=rating,
                photo_url=photo_url,
                place_id=place_id,
                lat=lat,
                lng=lng,
                action_description=wp.action_description,
                duration_mins=wp.duration_mins,
                walk_to_next_mins=0,  # filled below
                vibe_tag=wp.vibe_tag,
                insider_tip=wp.insider_tip,
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

    walk_times = await get_walking_times(directions_locations)
    
    initial_walk_mins = walk_times[0] if walk_times else 0
    for i, wp_obj in enumerate(waypoints):
        wp_obj.walk_to_next_mins = walk_times[i + 1] if i + 1 < len(walk_times) else 0

    total_time = sum(w.duration_mins + w.walk_to_next_mins for w in waypoints) + initial_walk_mins

    return WanderRouteOptionV3(
        route_name=raw_route.route_name,
        theme_summary=raw_route.theme_summary,
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
            request.start_location,
            request.end_location,
            [w.address_hint for w in waypoints],
        ),
    )



# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "wandering",
        "version": "3.0.0",
        "langsmith": _LANGSMITH,
        "google": bool(GOOGLE_KEY),
        "tavily": bool(TAVILY_KEY),
        "tagline": "Your life isn't a chore; wander.",
    }


@app.post("/api/generate-route")
async def generate_route(request: RouteRequest):
    async def event_generator():
        try:
            # 1. Geocode
            yield "data: " + json.dumps({"type": "status", "message": "pinpointing locations..."}) + "\n\n"
            await asyncio.sleep(0.05)
            
            start_ll = None
            end_ll = None
            if GOOGLE_KEY:
                start_ll = await geocode_location(request.start_location)
                end_ll   = await geocode_location(request.end_location)
            
            if not start_ll:
                start_ll = {"lat": 40.7580, "lng": -73.9855}
            if not end_ll:
                end_ll = start_ll

            # 2. Weather
            yield "data: " + json.dumps({"type": "status", "message": "checking local weather..."}) + "\n\n"
            weather_info = await _get_weather(start_ll["lat"], start_ll["lng"])
            weather_text = ""
            if weather_info:
                weather_text = f"{weather_info['main']}, {weather_info['temp_c']}°C"
                yield "data: " + json.dumps({"type": "weather", "weather_context": weather_text}) + "\n\n"

            venues = []
            if GOOGLE_KEY:
                yield "data: " + json.dumps({"type": "status", "message": "searching for verified venues..."}) + "\n\n"
                # Check for custom vibe and extract queries if needed
                is_custom = request.vibe not in VIBE_QUERIES
                if is_custom:
                    yield "data: " + json.dumps({"type": "status", "message": f"interpreting custom vibe: '{request.vibe}'..."}) + "\n\n"
                    queries = await _extract_custom_queries(request.vibe)
                else:
                    queries = VIBE_QUERIES[request.vibe]
                
                # Fetch candidate venues
                center = _midpoint(start_ll, end_ll) if end_ll else start_ll
                lat, lng = center["lat"], center["lng"]
                results = await asyncio.gather(
                    *[_places_search_text(q, lat, lng) for q in queries],
                    return_exceptions=True,
                )
                seen = set()
                for batch in results:
                    if isinstance(batch, list):
                        for place in batch:
                            pid = place.get("place_id") or place.get("name", "")
                            if pid and pid not in seen and place.get("name"):
                                seen.add(pid)
                                venues.append(place)
                venues.sort(key=lambda x: x.get("rating") or 0, reverse=True)
                venues = venues[:20]

            route_types = [
                ("Route 1 (scenic & relaxed)", "scenic/relaxed walking experience"),
                ("Route 2 (culturally dense)", "culturally rich itinerary with bookstores, galleries, or history"),
                ("Route 3 (focused & social)", "highly social, focused, and lively path")
            ]

            previously_selected = []
            
            if GOOGLE_KEY and venues:
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
                        enriched = await _enrich_route(request, raw_route, venues, start_ll, end_ll)
                        for wp in enriched.waypoints:
                            if wp.location_name:
                                previously_selected.append(wp.location_name)
                                
                        yield "data: " + json.dumps({
                            "type": "route",
                            "index": idx,
                            "route": enriched.model_dump()
                        }) + "\n\n"
                    except Exception as e:
                        print(f"Error curating RAG {route_label}: {e}")
                        fallback_route = await _generate_fallback_route_single(
                            request=request,
                            route_type_desc=route_type_desc,
                            previously_selected=previously_selected,
                            weather_info=weather_info,
                            local_time=request.local_time
                        )
                        for wp in fallback_route.waypoints:
                            previously_selected.append(wp.location_name)
                        yield "data: " + json.dumps({
                            "type": "route",
                            "index": idx,
                            "route": fallback_route.model_dump()
                        }) + "\n\n"
            else:
                # ── Fallback route generation (no Google key or no candidates) ──
                for idx, (route_label, route_type_desc) in enumerate(route_types):
                    yield "data: " + json.dumps({"type": "status", "message": f"curating {route_label}..."}) + "\n\n"
                    try:
                        fallback_route = await _generate_fallback_route_single(
                            request=request,
                            route_type_desc=route_type_desc,
                            previously_selected=previously_selected,
                            weather_info=weather_info,
                            local_time=request.local_time
                        )
                        for wp in fallback_route.waypoints:
                            previously_selected.append(wp.location_name)
                        yield "data: " + json.dumps({
                            "type": "route",
                            "index": idx,
                            "route": fallback_route.model_dump()
                        }) + "\n\n"
                    except Exception as e:
                        print(f"Error curating fallback {route_label}: {e}")

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
    """Securely reverse geocode coordinates to a human-readable address."""
    if not GOOGLE_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")
    
    async with httpx.AsyncClient() as client:
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={GOOGLE_KEY}"
        resp = await client.get(url)
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            # Use the first formatted address (usually the most specific)
            return {"address": data["results"][0]["formatted_address"]}
        
        # If ZERO_RESULTS or other errors, fallback to coordinates
        return {"address": f"{lat:.4f}, {lng:.4f}"}
