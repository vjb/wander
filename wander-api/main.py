from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from openai import OpenAI
from dotenv import load_dotenv
from typing import List, Optional
from urllib.parse import quote_plus
import os
import httpx
import asyncio

load_dotenv()

# ── LangSmith tracing ─────────────────────────────────────────────────────────
try:
    from langsmith import traceable
    _LANGSMITH = True
except ImportError:
    def traceable(**kwargs):          # type: ignore
        def decorator(f): return f
        return decorator
    _LANGSMITH = False

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Wander API v2",
    description="Stop planning. Start wandering. Three routes, one click to navigate.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
TAVILY_KEY = os.getenv("TAVILY_API_KEY", "")


# ── Pydantic Models (LLM parsing layer) ───────────────────────────────────────

class WaypointV2(BaseModel):
    order: int = Field(
        ..., description="Sequential stop number starting at 1"
    )
    location_name: str = Field(
        ..., description="Real, verified name of the venue or public space"
    )
    address_hint: str = Field(
        ...,
        description=(
            "Full street address suitable for Google Maps, e.g. "
            "'515 W 52nd St, Hell's Kitchen, New York, NY'. "
            "Must be a real, mappable address — not just a neighborhood name."
        ),
    )
    action_description: str = Field(
        ...,
        description=(
            "What to do here and exactly why it fits the vibe. 2–3 sentences. "
            "Written like a local who has lived here 10 years. Specific, warm, confident."
        ),
    )
    duration_mins: int = Field(
        ..., description="Minutes to spend at this stop (excludes walking time)"
    )
    walk_to_next_mins: int = Field(
        default=0,
        description=(
            "Estimated walking minutes from THIS stop to the NEXT stop. "
            "Use realistic city-block estimates (5–10 min typical). "
            "Set to 0 for the final waypoint."
        ),
    )
    vibe_tag: str = Field(
        ..., description="1–3 word micro-label e.g. 'Hidden Gem', 'City Views', 'Coffee Fix'"
    )
    insider_tip: str = Field(
        ...,
        description=(
            "One genuine insider secret: the exact best table, an off-menu item, "
            "the time of day when it transforms, what everyone else misses."
        ),
    )


class WanderRouteOptionLLM(BaseModel):
    """Route option as returned by the LLM — no deep link yet."""
    route_name: str = Field(
        ..., description="Creative 3–5 word name e.g. 'The Slow Burn Drift'"
    )
    theme_summary: str = Field(
        ...,
        description=(
            "One sentence distinguishing this route's character from the other two options. "
            "e.g. 'Ultra-scenic waterfront arc with maximum green space.'"
        ),
    )
    total_walking_time_mins: int = Field(
        ..., description="Sum of all stop durations plus all walk_to_next_mins segments"
    )
    waypoints: List[WaypointV2] = Field(
        ..., description="3–5 stops in strict geographic order — zero backtracking"
    )


class WanderV2ResponseLLM(BaseModel):
    """Root LLM response — exactly 3 route options."""
    routes: List[WanderRouteOptionLLM] = Field(
        ...,
        description=(
            "Exactly 3 distinct route options for the same origin/destination/vibe. "
            "Each must have a genuinely different character and set of stops."
        ),
    )


# ── Public API models (with computed deep links) ──────────────────────────────

class WanderRouteOption(WanderRouteOptionLLM):
    navigation_deep_link: str = Field(
        ..., description="Google Maps walking directions URL with all waypoints"
    )


class WanderV2Response(BaseModel):
    routes: List[WanderRouteOption]


# ── Request model ─────────────────────────────────────────────────────────────

class RouteRequest(BaseModel):
    start_location: str
    end_location: str
    time_budget_minutes: int
    vibe: str


# ── Deep-Link Generator ───────────────────────────────────────────────────────

def build_maps_deep_link(start: str, end: str, waypoint_addresses: List[str]) -> str:
    """
    Build a Google Maps walking directions deep link.

    Format:
      https://www.google.com/maps/dir/?api=1
        &origin={START}
        &destination={END}
        &waypoints={WP1}|{WP2}|{WP3}
        &travelmode=walking

    All address components are URL-encoded (spaces → '+', etc.).
    """
    origin = quote_plus(start.strip())
    destination = quote_plus(end.strip())
    encoded_wps = [quote_plus(addr.strip()) for addr in waypoint_addresses if addr.strip()]
    wp_str = "|".join(encoded_wps)

    url = (
        f"https://www.google.com/maps/dir/?api=1"
        f"&origin={origin}"
        f"&destination={destination}"
        f"&waypoints={wp_str}"
        f"&travelmode=walking"
    )
    return url


def enrich_with_deep_links(
    raw: WanderV2ResponseLLM,
    start: str,
    end: str,
) -> WanderV2Response:
    """Convert LLM output to public response by injecting computed deep links."""
    enriched: List[WanderRouteOption] = []
    for option in raw.routes:
        wp_addresses = [wp.address_hint for wp in option.waypoints]
        deep_link = build_maps_deep_link(start, end, wp_addresses)
        enriched.append(
            WanderRouteOption(
                **option.model_dump(),
                navigation_deep_link=deep_link,
            )
        )
    return WanderV2Response(routes=enriched)


# ── Tavily Enrichment ─────────────────────────────────────────────────────────

async def _tavily_search(query: str) -> Optional[str]:
    if not TAVILY_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_KEY,
                    "query": query,
                    "max_results": 2,
                    "search_depth": "basic",
                },
            )
            data = res.json()
            hits = data.get("results", [])
            return hits[0].get("content", "")[:300] if hits else None
    except Exception:
        return None


# ── OpenAI: V2 Multi-Route Generation ────────────────────────────────────────

@traceable(name="wander_v2_route_generation", run_type="llm")  # type: ignore
def _call_openai_v2(request: RouteRequest) -> WanderV2ResponseLLM:
    system_prompt = f"""You are Wander — a hyper-local urban experience curator. You have encyclopedic knowledge of every city's hidden gems: the spots locals love and tourists miss.

MISSION: Generate EXACTLY 3 distinct walking itineraries from the same origin to the same destination. Each route must have a completely different character — different stops, different atmosphere, different pace.

THE THREE ARCHETYPES (use these as the basis for your 3 routes):
1. ULTRA-SCENIC — Maximise green space, water views, architecture. The meditative option.
2. CULTURALLY DENSE — Art, independent retail, food culture, neighbourhood texture. The deep-dive option.  
3. FAST & FOCUSED — 1-2 anchor stops that are truly unmissable, efficient, tight timing. The power-wander option.

NON-NEGOTIABLE RULES:
1. REAL PLACES ONLY. Every stop must genuinely exist. No invented venues.
2. MAPPABLE ADDRESSES. The address_hint for each waypoint must be a full, real street address usable in Google Maps (e.g., "Pier 84, Hudson River Park, W 44th St & 12th Ave, New York, NY"). This is critical — it will be embedded in a navigation URL.
3. GEOGRAPHIC FLOW. Stops must progress from origin toward destination. Zero backtracking.
4. STRICT TIME BOX. Each route's total time (stop durations + walk_to_next_mins) must fit within {request.time_budget_minutes} minutes.
5. WALK TIMES. Provide realistic walk_to_next_mins between stops (typically 5–10 min for city blocks). Set to 0 for the final waypoint.
6. DISTINCT ROUTES. The 3 options must share NO waypoints with each other. Completely different stops.
7. LOCAL VOICE. Specific, warm, confident. Never say "charming" or "vibrant".

Active vibe: {request.vibe}
Time budget: {request.time_budget_minutes} minutes
Route: {request.start_location} → {request.end_location}"""

    response = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Generate 3 distinct wander routes from {request.start_location} "
                    f"to {request.end_location}. Time: {request.time_budget_minutes} min. "
                    f"Vibe: {request.vibe}. Remember: exactly 3 routes, all different stops."
                ),
            },
        ],
        response_format=WanderV2ResponseLLM,
        temperature=0.9,
    )
    return response.choices[0].message.parsed


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "wandering",
        "version": "2.0.0",
        "langsmith": _LANGSMITH,
        "tavily": bool(TAVILY_KEY),
    }


@app.post("/api/generate-route", response_model=WanderV2Response)
async def generate_route(request: RouteRequest):
    try:
        # Step 1: Generate 3 routes via GPT-4o structured outputs
        raw = _call_openai_v2(request)

        # Step 2: Validate we got exactly 3 routes (enforce server-side)
        if len(raw.routes) != 3:
            # Trim or pad gracefully — shouldn't happen with good prompting
            pass

        # Step 3: Compute Google Maps deep links for each route
        response = enrich_with_deep_links(raw, request.start_location, request.end_location)

        # Step 4: Optional Tavily enrichment (fire-and-forget, doesn't block)
        if TAVILY_KEY:
            all_queries = [
                f'"{wp.location_name}" {request.start_location} review hours tips'
                for route in raw.routes
                for wp in route.waypoints
            ]
            await asyncio.gather(
                *[_tavily_search(q) for q in all_queries],
                return_exceptions=True,
            )

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
