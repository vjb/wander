import asyncio
import os
from dotenv import load_dotenv
from openai import OpenAI
import httpx
import json

load_dotenv("wander-api/.env")
GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

openai_client = OpenAI(api_key=OPENAI_KEY)

# Mock candidate venues
venues = [
    {"name": f"Venue {i}", "address": f"Address {i}", "rating": 4.5 + (i % 5)/10, "types": ["park", "garden"]}
    for i in range(1, 21)
]

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
    waypoints: List[SelectedWaypointLLM] = Field(..., min_length=3, max_length=4)

class V3ResponseLLM(BaseModel):
    routes: List[RouteOptionLLM] = Field(..., min_length=3, max_length=3, description="Exactly 3 distinct routes")

def test_llm(time_budget):
    venue_lines = [
        f"[{i+1}] {v['name']} | {v['address']} | ⭐ {v['rating']} | {', '.join(v['types'])}"
        for i, v in enumerate(venues)
    ]
    venues_context = "\n".join(venue_lines)
    
    _stops = 3
    _walk_per_leg_mins = 12
    _walk_allowance = _walk_per_leg_mins * _stops
    _per_stop_mins = max(15, (time_budget - _walk_allowance) // _stops)
    
    system_prompt = f"""You are Wander — an urban experience curator.
VERIFIED VENUES:
{venues_context}

MISSION: Build exactly 3 distinct walking routes from Hell's Kitchen to Flatiron.
Each route uses 3–4 stops chosen ONLY from the numbered list above.

TIME BUDGET: {time_budget} minutes TOTAL per route.
→ TARGET: Each route should USE approximately {time_budget} minutes — not just fit within it.
→ Each stop should have duration_mins of approximately {_per_stop_mins} minutes.
→ DO NOT generate short 45-minute routes when given a 4-hour budget. Fill the time richly.

STRICT RULES:
1. Use ONLY venues from the list. Reference each by its [number] in venue_index. No invented stops.
2. Each route must use a DIFFERENT set of venues. No shared stops between routes.
3. Stops must flow geographically. No backtracking.
4. Hard cap: total time (duration_mins + walk_to_next_mins for all stops) <= {time_budget} min.
5. The 3 routes must be: Route 1 = ultra-scenic/relaxed, Route 2 = culturally dense, Route 3 = fast & focused.
"""

    res = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Generate 3 routes. Vibe: Green & Scenic. Select ONLY from the provided venue list."
            }
        ],
        response_format=V3ResponseLLM,
        temperature=0.85,
    )
    parsed = res.choices[0].message.parsed
    print(f"Budget: {time_budget}m -> Returned route count: {len(parsed.routes)}")
    for i, r in enumerate(parsed.routes):
        tot_duration = sum(w.duration_mins for w in r.waypoints)
        print(f"  Route {i+1}: {r.route_name} | {len(r.waypoints)} stops | Sum of stop durations: {tot_duration}m")

def main():
    for b in [90, 120, 240]:
        test_llm(b)

if __name__ == "__main__":
    main()
