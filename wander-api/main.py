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
import os
from typing import Dict, List, Optional
from urllib.parse import quote_plus

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

# ── Keys ──────────────────────────────────────────────────────────────────────
OPENAI_KEY  = os.getenv("OPENAI_API_KEY", "")
GOOGLE_KEY  = os.getenv("GOOGLE_MAPS_API_KEY", "")
TAVILY_KEY  = os.getenv("TAVILY_API_KEY", "")

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
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    waypoints: List[WaypointV3]
    navigation_deep_link: str


class WanderV3Response(BaseModel):
    routes: List[WanderRouteOptionV3]


class RouteRequest(BaseModel):
    start_location: str
    end_location: str
    time_budget_minutes: int
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


# (Fallback uses the same V3ResponseLLM so "exactly 3 routes" is always enforced)


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


# ── OpenAI RAG generation ─────────────────────────────────────────────────────

@traceable(name="wander_v3_rag", run_type="llm")       # type: ignore
def _call_openai_rag(request: RouteRequest, venues: List[Dict]) -> V3ResponseLLM:
    """GPT-4o curates routes from a verified Google Places venue list."""
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

    system_prompt = f"""You are Wander — an urban experience curator with encyclopedic local knowledge.
Your life isn't a chore; wander. Help the user feel that.

VERIFIED VENUES (sourced from Google Places — these are real, confirmed businesses):
{venues_context}

MISSION: Build exactly 3 distinct walking routes from {request.start_location} to {request.end_location}.
Each route uses 3–4 stops chosen ONLY from the numbered list above.

TIME BUDGET: {request.time_budget_minutes} minutes TOTAL per route.
→ TARGET: Each route should USE approximately {request.time_budget_minutes} minutes — not just fit within it.
→ Each stop should have duration_mins of approximately {_per_stop_mins} minutes (scale up for longer budgets).
→ If the budget is 60 min: stops of ~12–15 min each. If 120 min: ~25–30 min. If 240 min: ~50–60 min each.
→ DO NOT generate short 45-minute routes when given a 4-hour budget. Fill the time richly.

STRICT RULES:
1. Use ONLY venues from the list. Reference each by its [number] in venue_index. No invented stops.
2. Each route must use a DIFFERENT set of venues. No shared stops between routes.
3. Stops must flow geographically toward {request.end_location}. Zero backtracking.
4. Hard cap: total time (duration_mins + walk_to_next_mins for all stops) ≤ {request.time_budget_minutes} min.
5. The 3 routes must be: Route 1 = ultra-scenic/relaxed, Route 2 = culturally dense, Route 3 = fast & focused.
6. Write like a local who has lived here 10 years. Specific, warm. Never say "charming" or "vibrant."
7. Insider tips must be genuinely useful and specific to this exact venue.

Active vibe: {request.vibe}"""

    response = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Generate 3 routes. Start: {request.start_location}. "
                    f"End: {request.end_location}. "
                    f"Vibe: {request.vibe}. "
                    f"Select ONLY from the provided venue list."
                ),
            },
        ],
        response_format=V3ResponseLLM,
        temperature=0.85,
    )
    return response.choices[0].message.parsed


@traceable(name="wander_v3_fallback", run_type="llm")  # type: ignore
def _call_openai_fallback(request: RouteRequest) -> V3ResponseLLM:
    """Fallback when Google Places returns no results — GPT-4o generates from knowledge."""
    _stops = 3
    _walk_per_leg_mins = 12
    _walk_allowance = _walk_per_leg_mins * _stops
    _per_stop_mins = max(15, (request.time_budget_minutes - _walk_allowance) // _stops)

    system_prompt = f"""You are Wander. Generate exactly 3 distinct walking routes.
Your life isn't a chore; wander.

Each waypoint MUST have a venue_index (use 1, 2, 3 ... sequentially across all routes).
Set venue_index = order number of the stop globally across all routes.

TIME BUDGET: {request.time_budget_minutes} minutes TOTAL per route.
→ TARGET: Each route should USE approximately {request.time_budget_minutes} minutes.
→ Per stop: approximately {_per_stop_mins} minutes duration_mins each.
→ DO NOT generate short routes when given a large time budget. Fill the time.

RULES:
1. REAL PLACES ONLY. Every stop must genuinely exist with a real street address in address_hint.
   The address_hint must be a full mappable street address like "750 11th Ave, New York, NY".
2. Stops flow geographically from origin to destination. No backtracking.
3. Routes: Route 1 = ultra-scenic, Route 2 = culturally dense, Route 3 = fast & focused.
4. No shared stops between routes.
5. Hard cap: total (duration_mins + walk_to_next_mins) per route ≤ {request.time_budget_minutes} minutes.

Vibe: {request.vibe}"""

    response = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Generate 3 routes from {request.start_location} "
                    f"to {request.end_location}. "
                    f"Vibe: {request.vibe}. Time: {request.time_budget_minutes} min."
                ),
            },
        ],
        response_format=V3ResponseLLM,
        temperature=0.9,
    )
    return response.choices[0].message.parsed


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


@app.post("/api/generate-route", response_model=WanderV3Response)
async def generate_route(request: RouteRequest):
    try:
        enriched_routes: List[WanderRouteOptionV3] = []

        if GOOGLE_KEY:
            # ── V3 RAG path ───────────────────────────────────────────────────
            start_ll = await geocode_location(request.start_location)
            end_ll   = await geocode_location(request.end_location)
            if not start_ll:
                start_ll = {"lat": 40.7580, "lng": -73.9855}  # NYC midtown default
            if not end_ll:
                end_ll = start_ll

            venues = await fetch_candidate_venues(start_ll, end_ll, request.vibe)

            if venues:
                raw = _call_openai_rag(request, venues)

                for raw_route in raw.routes:
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

                    # Real walking times from Directions API
                    full_addresses = [request.start_location] + addresses + [request.end_location]
                    walk_times = await get_walking_times(full_addresses)
                    
                    initial_walk_mins = walk_times[0] if walk_times else 0
                    for i, wp_obj in enumerate(waypoints):
                        wp_obj.walk_to_next_mins = walk_times[i + 1] if i + 1 < len(walk_times) else 0

                    total_time = sum(w.duration_mins + w.walk_to_next_mins for w in waypoints) + initial_walk_mins

                    enriched_routes.append(
                        WanderRouteOptionV3(
                            route_name=raw_route.route_name,
                            theme_summary=raw_route.theme_summary,
                            total_walking_time_mins=total_time,
                            initial_walk_mins=initial_walk_mins,
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
                    )

        if not enriched_routes:
            # ── Fallback path (no Google key or no Places results) ────────────
            raw_fb = _call_openai_fallback(request)
            # raw_fb is now V3ResponseLLM — venue_index maps to a fake venue list
            # We just use location_name from the prompt context (GPT-4o puts real names there)
            # For fallback we treat venue_index as a sequential counter and use
            # the waypoint fields directly from action_description + insider_tip
            for raw_route in raw_fb.routes:
                # Build a synthetic venue list from the LLM's own waypoints
                waypoints_fb: List[WaypointV3] = []
                for wp in raw_route.waypoints:
                    # In fallback mode, venue_index is 1-based stop order
                    # GPT-4o writes the location name and address in the description
                    # We extract them from a parallel synthetic venue list
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
                enriched_routes.append(
                    WanderRouteOptionV3(
                        route_name=raw_route.route_name,
                        theme_summary=raw_route.theme_summary,
                        total_walking_time_mins=sum(
                            w.duration_mins for w in waypoints_fb
                        ),
                        initial_walk_mins=0,
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
                )

        return WanderV3Response(routes=enriched_routes)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
