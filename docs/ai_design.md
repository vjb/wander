# AI Design: How Wander Uses Language Models

> Every LLM call in this project — model choice, prompt text, temperature, output schema, and rationale.

Wander is a **RAG (Retrieval-Augmented Generation) application** at its core. Real venue data is retrieved from Google Places, Foursquare, and OpenTripMap and fed to GPT-4o as grounded context. The model never invents places — it curates from a verified list. The mini-model (`gpt-4o-mini`) handles all lightweight classification and generation tasks where speed matters more than depth.

---

## Model Allocation Summary

| Call | Model | Temp | Output Format | Where |
|---|---|---|---|---|
| Route generation (×3 parallel) | `gpt-4o` | 0.35 | Structured JSON (Pydantic) | [`_call_openai_single_route_sync`](../wander-api/main.py#L1092) |
| Stop swap | `gpt-4o` | 0.7 | Structured JSON (Pydantic) | [`_call_openai_single_venue_swap_sync`](../wander-api/main.py#L2010) |
| Spontaneous detour | `gpt-4o` | 0.7 | Structured JSON (Pydantic) | [`_call_openai_single_venue_detour_sync`](../wander-api/main.py#L2061) |
| Pacing advisor | `gpt-4o-mini` | 0.2 | Structured JSON (Pydantic) | [`/api/pacing-advisor`](../wander-api/main.py#L1851) |
| Custom vibe → search queries | `gpt-4o-mini` | 0.0 | JSON object | [`_extract_custom_queries`](../wander-api/main.py#L350) |
| Feeling Lucky → surprise theme | `gpt-4o-mini` | 1.0 | JSON object | [`_extract_lucky_queries`](../wander-api/main.py#L385) |
| Location trivia (loading screen) | `gpt-4o-mini` | 0.8 | JSON object | [`_fetch_location_trivia`](../wander-api/main.py#L425) |

**Why two models?**
- `gpt-4o` is used for anything that requires creative judgment, local knowledge depth, or multi-constraint reasoning (route curation, stop swaps, detours).
- `gpt-4o-mini` is used for fast, structured tasks where the output is narrow (classifying a vibe into queries, generating a pacing assessment, generating trivia). It's ~10× cheaper and ~3× faster.

---

## 1. Route Generation — The Core LLM Call

**Function:** [`_call_openai_single_route_sync`](../wander-api/main.py#L971)  
**Model:** `gpt-4o`  
**Temperature:** `0.35`  
**Output format:** `openai_client.beta.chat.completions.parse()` with a Pydantic `DynamicRouteOptionLLM` schema  
**Called:** 3× in parallel via `asyncio.create_task` inside [`event_generator()`](../wander-api/main.py#L1607)

### What it receives

The system prompt is assembled dynamically from up to 7 contextual chunks:

#### Venues context (RAG payload)
```
VERIFIED VENUES (sourced from Google Places — these are real, confirmed businesses,
sorted in order of geographical progression from Start (0%) to End (100%)):
[1] 787 Coffee | 245 W 46th St | ⭐ 4.9 | café, coffee shop | $5 est.
[2] Bryant Park Grill | 25 W 40th St | ⭐ 4.2 | restaurant, park | $35 est.
...up to 25 venues
```

The venues list is fetched from **Google Places Text Search** and **Foursquare** in parallel across multiple query strings (derived from the selected vibe), deduplicated, sorted by `progression` (0.0 = near start, 1.0 = near end), and trimmed to the top 25 by rating. The LLM is instructed to pick stops in **strictly increasing index order** — this is the primary mechanism for preventing geographic backtracking.

#### Weather chunk ([`main.py#L990`](../wander-api/main.py#L990))
Only injected when `_get_weather()` succeeds:
```
CURRENT WEATHER CONDITION: Rain (light rain), Temperature: 14°C.
IMPORTANT: It is currently raining/snowing/storming at the starting location.
You MUST prioritize indoor stops (museums, indoor markets, cozy cafes, bookstores)
and covered areas. Avoid suggesting parks, open plazas, or un-sheltered outdoor walks.
```

#### Time-of-day chunk ([`main.py#L1006`](../wander-api/main.py#L1006))
```
CURRENT LOCAL TIME: Saturday, 07:30 PM.
IMPORTANT: Tailor the recommended stops to the time of day.
For example, if it is late night (e.g. after 8 PM), do not recommend coffee shops or
bookstores that close early; instead suggest bars, evening diners, or late-night dessert spots.
DAYPART TRANSITIONING RULE: If the time budget spans across major dayparts (e.g., starting at
4:00 PM for 3 hours), logically sequence the stops to transition with the day...
```

#### Companion chunk ([`main.py#L1016`](../wander-api/main.py#L1016))
One of five profiles is injected, each with different priority instructions:

- **Solo** — quiet, contemplative spaces, independent bookstores, garden benches
- **Date** — intimate and romantic, dimly lit bars, scenic overlooks, shared desserts
- **Friends** — social and group-friendly, food halls, breweries, interactive galleries
- **Pet** — strictly dog-friendly, outdoor only, pet boutiques, open-air patios
- **Business** — time-boxed, professional attire assumed, espresso bars, iconic landmarks, polished concierge tone, 15–20 min per stop max, back by 2pm

#### Duration reference table ([`main.py#L1105`](../wander-api/main.py#L1105))
The model is given a venue-type → duration table to prevent uniform stop durations:
```
• coffee shop / café             → 15–25 min
• cocktail bar / wine bar        → 25–45 min
• art gallery / museum           → 30–60 min
• bookstore / record shop        → 20–40 min
• park / garden / waterfront     → 15–35 min
• market / food hall             → 25–45 min
• rooftop / scenic viewpoint     → 15–25 min
```

#### Free-only and budget chunks ([`main.py#L1064`](../wander-api/main.py#L1064), [`main.py#L1076`](../wander-api/main.py#L1076))
If `free_only=true`:
```
IMPORTANT: The user requested FREE stops only. You MUST prioritize public parks,
free museums, public libraries, landmarks, open plazas, or public sights.
Do NOT select any commercial restaurants, bars, cafes, or retail stores...
```

If `max_budget_usd < 150`:
```
BUDGET CONSTRAINT: The user has set a MAXIMUM budget of $30 USD per person for the entire route.
You MUST select stops such that the sum of estimated_cost_usd for all stops does NOT exceed $30 USD.
```

### The full system prompt preamble ([`main.py#L1092`](../wander-api/main.py#L1092))
```
You are wander — an urban experience curator with encyclopedic local knowledge.
Your life isn't a chore; wander. Help the user feel that.

VERIFIED VENUES (sourced from Google Places — these are real, confirmed businesses,
sorted in order of geographical progression from Start (0%) to End (100%)):
{venues_context}

MISSION: Build exactly ONE walking route from {start} to {end} matching this theme: {route_type_desc}.
The route must use exactly {N} stops chosen ONLY from the numbered list above.
```

### The 7 strict rules ([`main.py#L1132`](../wander-api/main.py#L1132))
```
1. Use ONLY venues from the list. Reference each by its [number] in venue_index. No invented stops.
2. Stops must progress geographically... select in strictly increasing index order. Zero backtracking.
3. Hard cap: total time ≤ {time_budget_minutes} min.
4. Write like a local who has lived here 10 years. Specific, warm. Never say "charming" or "vibrant."
5. Insider tips must be genuinely useful and specific to this exact venue.
6. Culinary Targeting: If the user's custom vibe explicitly mentions specific cuisines...
7. Accessibility: If the user requests wheelchair accessibility or 'no stairs'...
```

### The user message ([`main.py#L1165`](../wander-api/main.py#L1165))
```
Generate ONE route matching theme '{route_type_desc}' from {start} to {end}. Vibe: {vibe}.
```

Each of the 3 parallel calls receives a **different `route_type_desc`** (the archetype label + description) determined by [`VIBE_ROUTE_ARCHETYPES`](../wander-api/main.py#L1568). For example, the `Mental Break` vibe generates:
- `"Serene Sunday Stroll"` — slow coffee, contemplative parks, zero noise
- `"Serenity Stroll"` — mindfulness walk, gardens, quiet nooks
- `"Urban Zen Stroll"` — finding stillness in urban texture

### Output schema
```python
class DynamicRouteOptionLLM(BaseModel):
    route_name: str          # e.g. "The Slow Burn Drift"
    theme_summary: str       # one sentence distinguishing this route
    waypoints: List[SelectedWaypointLLM]  # exactly N stops
    estimated_total_cost_usd: int

class SelectedWaypointLLM(BaseModel):
    venue_index: int            # 1-based index into the verified venues list
    action_description: str     # local, warm, lowercase narrative
    duration_mins: int          # realistic per venue type
    walk_to_next_mins: int      # LLM estimate (overridden by Directions API post-hoc)
    vibe_tag: str               # 1-2 word micro-label e.g. "Coffee Fix"
    insider_tip: str            # specific to this exact venue
    estimated_cost_usd: int
```

**Why `temperature=0.35`?** Route generation needs to be creative (different route names, different stop selections across the 3 archetypes) but also reliable (must follow strict index ordering and budget rules). 0.35 strikes the balance — lower than typical creative tasks, higher than pure classification.

**Why structured output?** `beta.chat.completions.parse()` enforces the Pydantic schema at the API level. If the model produces a `venue_index` out of range or omits a field, the call fails fast rather than producing a silently broken route.

---

## 2. Stop Swap

**Function:** [`_call_openai_single_venue_swap_sync`](../wander-api/main.py#L1971)  
**Endpoint:** [`POST /api/swap-waypoint`](../wander-api/main.py#L2088)  
**Model:** `gpt-4o`  
**Temperature:** `0.7`  
**Output format:** `SwappedWaypointLLM` Pydantic schema

Triggered when the user taps **swap stop** on any waypoint card. The frontend sends the full current route plus the index of the stop to replace and an optional `custom_refinement` string (e.g. "something with a rooftop").

### What it receives

A fresh venue search is run centered at the **coordinates of the stop being replaced** (radius 1200m), using either:
- Custom refinement queries (parsed by `_extract_custom_queries` if text was provided)
- The current vibe's standard query set (for "surprise me")

The system prompt:
```
You are wander — an urban experience curator.
We need to replace exactly one stop in an existing itinerary.

CURRENT ROUTE SUMMARY:
- Route Name: Serene Sunday Stroll
- Current Stops: 787 Coffee, Bryant Park, The Morgan Library
- Swap Target Stop: 'Bryant Park' at index 1 (between '787 Coffee' and 'The Morgan Library')

REPLACEMENT REQUEST:
The user rejected the stop 'Bryant Park' and wants a replacement stop instead.
Specifically, they want: 'something with a rooftop'.

BUDGET CONSTRAINT: The other stops already cost $5. This replacement stop MUST have
an estimated_cost_usd of at most $25 so the overall route stays within budget.

CANDIDATE VENUES:
[1] 230 Fifth Rooftop Bar | 230 5th Ave | ⭐ 4.1 | bar, rooftop
[2] ...

MISSION:
Choose exactly ONE venue from the candidate list that is the best replacement for the target stop.
It must fit between 'previous stop' and 'next stop' logistically and thematically.
Return the index (1-based) of your choice and write a local, warm, lowercased action description.
Do not use capital letters or end sentences with periods. Write like a local who has lived here 10 years.
```

**Why `temperature=0.7`?** Swaps are one-off creative decisions — the model should feel empowered to pick the most interesting option from the candidate list rather than always defaulting to the highest-rated one.

---

## 3. Spontaneous Detour

**Function:** [`_call_openai_single_venue_detour_sync`](../wander-api/main.py#L2042)  
**Endpoint:** [`POST /api/vibe-detour`](../wander-api/main.py#L2324)  
**Model:** `gpt-4o`  
**Temperature:** `0.7`  
**Output format:** `DetourWaypointLLM` Pydantic schema

Triggered mid-walk when the user taps **detour me**. The app sends the user's current GPS coordinates, their active vibe, and a list of place IDs already in their itinerary (to avoid repeats). A tight 500m radius search runs across Foursquare and OpenTripMap. Candidates are scored by `(rating - distance_m / 200)` and the top 10 are fed to the LLM.

### System prompt ([`main.py#L2061`](../wander-api/main.py#L2061))
```
You are wander — an urban experience curator.
We need to select exactly ONE spontaneous detour waypoint for a user currently walking.

DETOUR REQUEST:
- The active vibe is 'Mental Break'.
BUDGET CONSTRAINT: This detour stop MUST have an estimated_cost_usd of at most $50 USD.

CANDIDATE VENUES:
[1] Morosco Theatre | 7th Avenue, Manhattan | ⭐ 4.8 | theatre, landmark
[2] ...

MISSION:
Choose exactly ONE venue from the candidate list that makes the absolute best spontaneous,
trending, or highly interesting detour.
Prefer Foursquare places if they have a hot-and-new or popular vibe, or OpenTripMap places
if they are a gorgeous scenic overlook, public sculpture, or historic landmark nearby.
Return the index (1-based) of your choice...
Do not use capital letters or end sentences with periods. Write like a local who has lived here 10 years.
```

The detour response is then used in **`POST /api/pivot-route`** ([`main.py#L2509`](../wander-api/main.py#L2509)) — a pure computation endpoint (no LLM) that splices the detour stop into the route and recomputes all walking times via the Directions API.

---

## 4. Pacing Advisor

**Function:** Inline in [`POST /api/pacing-advisor`](../wander-api/main.py#L1785)  
**Model:** `gpt-4o-mini`  
**Temperature:** `0.2`  
**Output format:** `AdvisorResponse` Pydantic schema via `beta.chat.completions.parse()`

This runs **before** the user hits generate, as soon as both location fields are filled. It's a pre-flight feasibility check. Several hard-coded rules run first (e.g. base walk time > budget → immediately return `"impossible"` without hitting the LLM). The LLM only fires for the nuanced middle cases.

### System prompt ([`main.py#L1851`](../wander-api/main.py#L1851))
```
you are a smart walking pacing advisor for the 'wander' app.
your goal is to evaluate if a walking itinerary is feasible and provide a warm, all-lowercase advice message.

guidelines:
1. never use any capital letters (e.g. use 'chelsea', not 'Chelsea').
2. never end any sentences with a period. use playful, relaxed punctuation.
3. assess the walking distance (in meters), budget (in minutes), stop count, weather, companion, and local time.
4. assign a feasibility_status:
   - 'optimal' if there is plenty of time (at least 15-20 minutes per stop + walk time).
   - 'tight' if they are cutting it close (under 15 min per stop but physically possible).
   - 'impossible' if the base walk time alone exceeds the budget, or budget < 12 min per stop.
5. detect the neighborhood based on the start/end location.
6. detect density: 'high' for Manhattan/downtowns, 'medium', or 'low'.
7. recommend an optimal stop count between 2 and 5.
8. provide a pacing_message in lowercase.
9. write a density_badge_message like: 'density-optimized: 3 stops suggested for greenwich village'.
10. write a weather_advice string if weather is rainy/cold.
```

### User message
```
Start Location: Times Square, New York
End Location: Bryant Park, New York
Distance: 850.3 meters (direct line), base walk time: 11 minutes
Time Budget: 180 minutes
Requested Stops: 3
Companion: business
Local Time: Saturday, 02:00 PM
Current Weather: Clouds (overcast clouds), 24°C
```

### Output schema
```python
class AdvisorResponse(BaseModel):
    detected_neighborhood: str
    density_level: str           # "high" | "medium" | "low"
    recommended_stops: int
    pacing_message: str          # e.g. "3 stops is perfect for a breezy midtown dash"
    feasibility_status: str      # "optimal" | "tight" | "impossible"
    density_badge_message: str
    weather_advice: Optional[str]
```

**Why `temperature=0.2`?** The advisor needs to be consistent and factual. The same input should give the same assessment. Near-zero temperature ensures deterministic feasibility classification.

---

## 5. Custom Vibe → Search Query Extraction

**Function:** [`_extract_custom_queries`](../wander-api/main.py#L350)  
**Model:** `gpt-4o-mini`  
**Temperature:** `0.0`  
**Output format:** `{"queries": [...]}` JSON object

When the user types a free-form vibe description (e.g. *"spicy noodles, vintage clothes, and a quiet place to read"*), this function converts it to Google Places search terms before venue fetching begins.

### System prompt
```
You are an assistant that extracts specific Google Maps Places search terms from a descriptive vibe.
Extract 3 to 5 distinct, concrete, search queries (e.g. 'bookstore', 'ramen', 'rooftop bar')
matching the user's desires.
Return ONLY a JSON object containing a 'queries' array of strings.
Example: {'queries': ['query1', 'query2']}.
```

**User message:** The raw vibe text the user typed.

**Why `temperature=0.0`?** This is pure extraction/classification. The output needs to be deterministic and grounded in the exact words the user provided.

---

## 6. Feeling Lucky → Surprise Theme Generator

**Function:** [`_extract_lucky_queries`](../wander-api/main.py#L385)  
**Model:** `gpt-4o-mini`  
**Temperature:** `1.0`  
**Output format:** `{"queries": [...]}` JSON object

When the user selects "Feeling Lucky", instead of using a fixed query list the model is given creative freedom to invent an entire themed walk concept and translate it into search terms.

### System prompt
```
You are an urban exploration planner. The user clicked 'I'm Feeling Lucky'.
Create a cohesive but completely unexpected, quirky, and themed set of 3 to 5 Google Maps search queries.
Think of strange but delightful themes: a retro neon crawl, a botanical & vintage book drift,
a speakeasy & historic mystery walk, or a vinyl record & coffee alleyway stroll.
Be creative and specific with the search queries (e.g. 'independent bookstore', 'retro arcade bar',
'historic fountain overlook').
Return ONLY a JSON object containing a 'queries' array of strings.
```

**User message:** `"Generate a completely unique and surprising walk vibe theme and queries."`

**Why `temperature=1.0`?** Maximum creativity is the entire point. Each "Feeling Lucky" tap should produce a genuinely different theme. High temperature here is not a bug — it's the product.

---

## 7. Location Trivia (Loading Screen)

**Function:** [`_fetch_location_trivia`](../wander-api/main.py#L425)  
**Model:** `gpt-4o-mini`  
**Temperature:** `0.8`  
**`max_tokens`: `120`**  
**Output format:** `{"facts": [...]}` JSON object

Fired as an `asyncio.Task` **immediately when the request arrives** ([`main.py#L1390`](../wander-api/main.py#L1390)), concurrent with geocoding and venue search. By the time venue search completes and weather resolves, the trivia is already waiting. The three facts are then streamed as `{"type": "status", "message": "did you know: ..."}` SSE events ([`main.py#L1462`](../wander-api/main.py#L1462)), each separated by a 2.8-second pause.

### System prompt
```
You generate exactly 3 extremely short, slightly witty, and obscure local facts about a city or place.
Each fact must be under 12 words.
Avoid generic tourism facts. Prefer genuinely surprising or little-known details.
Return ONLY a JSON object: {"facts": ["fact1", "fact2", "fact3"]}.
```

**User message:** `"Give me 3 obscure facts about: Times Square"`

**Why `temperature=0.8`?** Facts should feel fresh and surprising each time, but not hallucinatory. 0.8 adds variety to the selection while keeping the model grounded enough to produce real historical/geographical facts.

**Why `max_tokens=120`?** Each fact must be under 12 words. 120 tokens is more than enough for 3 short facts in JSON format, and the tight cap ensures the call returns fast (this is on the critical path to the first SSE event).

**Why fire it concurrently?** Geocoding two locations takes ~200–400ms. The trivia call takes ~800–1200ms. By firing both in parallel, the trivia is effectively free from a latency perspective. If trivia takes longer than 4 seconds, it's abandoned with `asyncio.wait_for(trivia_task, timeout=4.0)` — it never delays route generation.

---

## Structured Output: Why `beta.chat.completions.parse()`

Three of the seven calls use OpenAI's **Structured Outputs** API (`beta.chat.completions.parse()` with a Pydantic model). This enforces that the JSON response conforms to the schema at the API level — the model is constrained to only produce valid field names and types. This means:

- No post-hoc JSON parsing with `try/except`
- No silent missing fields
- `venue_index` will always be an `int`, `duration_mins` will always be present
- The parsed Pydantic object is returned directly

The other four calls use `chat.completions.create()` with `response_format={"type": "json_object"}` — which guarantees valid JSON but not schema conformance. These are used for simpler outputs (arrays of strings) where the schema enforcement overhead isn't worth it.

---

## Data Flow: Full Route Generation Pipeline

```
POST /api/generate-route
        │
        ├── asyncio.create_task(_fetch_location_trivia(start_location))   ← gpt-4o-mini, concurrent
        │
        ├── geocode_location(start) + geocode_location(end)               ← Google Geocoding API
        │
        ├── Directions API feasibility check (base walk time)             ← Google Directions API
        │
        ├── _get_weather(lat, lng)                                        ← OpenWeatherMap API
        │
        ├── await trivia_task → yield "did you know: ..." × 3            ← SSE status events
        │
        ├── if vibe == "Feeling Lucky":  _extract_lucky_queries()         ← gpt-4o-mini
        │   elif vibe not in VIBE_QUERIES: _extract_custom_queries()      ← gpt-4o-mini
        │   else: VIBE_QUERIES[vibe]                                      ← static list
        │
        ├── Parallel Places API search (Google + Foursquare + OTM)        ← 3 external APIs
        │   Sort by rating → top 25 → sort by progression
        │
        ├── asyncio.create_task(_generate_one(0, archetype_0)) ─┐
        ├── asyncio.create_task(_generate_one(1, archetype_1)) ─┤ gpt-4o × 3, parallel
        └── asyncio.create_task(_generate_one(2, archetype_2)) ─┘
                │
                ├── _call_openai_single_route_sync()  ← gpt-4o, structured output
                │
                └── _enrich_route()
                        ├── Foursquare Details API (tips, photos)
                        ├── OpenTripMap Details API (Wikipedia extract)
                        └── Directions API (real walking times per leg)
                        
        As each task completes → yield {"type": "route", "index": N, "route": ...}  ← SSE
        All 3 done → yield {"type": "done"}  ← triggers confetti on frontend
```

---

## Prompt Engineering Principles Used

| Principle | Where Applied |
|---|---|
| **Persona assignment** | All prompts open with "You are wander — an urban experience curator" |
| **Negative constraints** | "Never say 'charming' or 'vibrant'", "Never use capital letters", "Never end with a period" |
| **Hard numeric caps** | Duration hard caps, budget sums, index ordering rules — all stated as STRICT RULES |
| **Few-shot examples** | Venue duration table acts as implicit few-shot for calibration |
| **Context stuffing (RAG)** | Up to 25 real venues injected into every route generation call |
| **Conditional injection** | Weather, companion, budget, time-of-day chunks only appear when relevant |
| **Structured output** | Pydantic schemas enforce all route/swap/detour responses at API level |
| **Temperature as a dial** | 0.0 for extraction, 0.2 for classification, 0.35 for constrained creativity, 0.7–0.8 for open-ended generation, 1.0 for maximum surprise |

---

## Approximate Cost Per Route Generation

| Call | Model | Est. input tokens | Est. output tokens | Est. cost |
|---|---|---|---|---|
| Route × 3 (parallel) | gpt-4o | ~1,800 each | ~400 each | ~$0.20 |
| Trivia | gpt-4o-mini | ~120 | ~80 | ~$0.002 |
| Custom vibe (if used) | gpt-4o-mini | ~200 | ~60 | ~$0.001 |
| Pacing advisor | gpt-4o-mini | ~350 | ~120 | ~$0.002 |
| **Total (typical)** | | | | **~$0.21–$0.23** |

Swap and detour are on-demand (~$0.03 each) and not included in the base cost.
