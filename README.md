# wander

![wander banner](assets/banner.png)

> *stop commuting. start wandering*

an ai-powered urban experience curator that turns a walk between any two points into three distinct, navigation-ready walking routes. wander is built for both out-of-town travelers landing in a new destination and locals looking to discover the hidden layers of their own streets. it transforms standard a-to-b transit into curated, slow-paced exploration.

---

## what it does

wander accepts a starting location, an ending location, a time budget, and a desired vibe (using presets or custom natural language). 

<div align="center">
  <img src="assets/01-landing.png" width="800" alt="wander landing screen" />
  <br/><br/>
  <img src="assets/02-form-filled.png" width="800" alt="wander input form" />
  <br/><br/>
  <img src="assets/04-route.png" width="800" alt="wander generated route" />
</div>

### how it works:
1. **curate the vibe**: select one of four vibe presets (including the loop-optimized *mental break ⏱️*) or type a completely custom request (e.g., *"spicy noodles, vintage clothing stores, and a quiet park"*).
2. **loop option**: toggle the round-trip button `🔁` to automatically sync the start and end coordinates, converting the main cta into `"generate three round-trip loops"`.
3. **sequential streaming**: wander geocodes the inputs, checks local weather, and performs a parallel radar search using the google places api. it streams three unique routes to the frontend in real time using server-sent events (sse). route 1 displays instantly, while route 2 and route 3 continue loading in the background.
4. **feasibility validation**: the backend queries the google directions api to verify that the walking path is actually possible within the user's time budget (allocating a mandatory 15-minute buffer per venue).
5. **ready to navigate**: expand venues to read curated "insider tips", check live google rating badges, download a custom `.ics` calendar file pre-loaded with stop durations and details, or tap **start wandering** to open the entire multi-stop walking tour inside google maps for turn-by-turn navigation.

---

## key features

* 🔁 **loop & round-trip sync**: perfect for short breaks or round-trips from a hotel or office. click the loop icon `🔁` to lock the end destination to the starting point.
* ⏱️ **mental break preset**: a preset card specifically optimized for brief loop routes (e.g. coffee, quick fresh air, short loop) utilizing an adaptive search radius in the backend.
* 🎭 **zero-hallucination rag**: venues are queried directly from the google places api (new) along the route corridor. the ai is strictly forbidden from inventing stops, ensuring every recommendation is a real, operational business with current ratings.
* 🌦️ **weather-aware curation**: pulls current weather at the starting location. if it is raining, snowing, or storming, the backend automatically instructs the llm to skip parks or rooftop venues in favor of indoor stops (museums, indoor markets, cozy cafes, libraries).
* 🕒 **daypart transitioning**: automatically adapts recommendations to the time of day (e.g. no breakfast spots at 8 pm; sunset transitions are scheduled logically if the route spans from afternoon to night).
* 📅 **add to calendar (ics)**: download fully-formed calendar events (`.ics`) preloaded with address details, ratings, stop durations, and direct google maps deep links.
* 📱 **pwa installable**: fully configured progressive web app with service worker caching. install it on ios or android directly from the browser for a full-screen native feel.

---

## Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | Next.js 16 (App Router, TypeScript) | Premium, Obsidian black (`#131316`) and Matcha green (`#8BA88E`) digital oasis interface. |
| **Styling & Animations** | Tailwind CSS v4, Framer Motion v12 | Fluid transitions, focus states, glassmorphism cards, and staggered timeline loading. |
| **Backend** | FastAPI (Python 3.13, Uvicorn) | High-performance Python backend serving SSE streams. |
| **Persistence** | SQLite3 | Local storage for persistable route sharing (`/r/[id]`). |
| **AI Brain** | OpenAI GPT-4o & GPT-4o-mini | Structured JSON outputs for route selection and search term extraction. |
| **Geocoding** | Google Geocoding API | Converts natural language addresses to lat/lng coordinates. |
| **Venue Search** | Google Places API (New) | Parallel Radar queries centered along the route corridor. |
| **Walking Feasibility** | Google Directions API | Verifies network walking durations between stops. |
| **Weather** | OpenWeatherMap API | Live weather retrieval for weather-aware routing. |

---

## System Architecture

Wander enforces a strict, multi-stage RAG pipeline to generate structured, hallucination-free walking tours:

```
User Request (start, end, time_budget, vibe, local_time)
    │
    ├─ 1. Geocode Start & End coordinates (Geocoding API)
    │
    ├─ 2. Fetch current weather conditions (OpenWeatherMap API)
    │
    ├─ 3. Keyword Extraction (gpt-4o-mini)
    │      Extracts Maps search queries from user's custom vibe text.
    │
    ├─ 4. Corridor Radar Sweep (Places API New)
    │      Runs 5 parallel search sweeps centered along the route path
    │      to retrieve 15-20 verified venue candidates.
    │
    ├─ 5. Sequential Route Generation (gpt-4o)
    │      Streams 3 distinct themed routes sequentially via SSE.
    │      Selected venues are excluded from subsequent options.
    │
    ├─ 6. Walking Validation (Directions API)
    │      Validates walking time via actual road-network walking minutes.
    │      Ensures time budget accommodates both walking and stop buffers.
    │
    ├─ 7. Persistence (SQLite3)
    │      Stores generated configurations for permanent route sharing.
    │
    └─ Response Streamed to User → Route Timeline, Ratings, Map Polyline, Handoff Link, & ICS Download
```

---

## AI & LLM Prompts

Wander uses two specialized prompts in the backend pipeline:

### 1. Search Query Extractor Prompt (GPT-4o-mini)
Sourced in [main.py:L227-250](file:///c:/Users/vjbel/hacks/wander/wander-api/main.py#L227-L250). 

This prompt parses the user's natural language vibe (especially custom descriptions) and extracts clean search queries to seed the Google Places API radar sweep.

```
System Prompt:
You are an assistant that extracts specific Google Maps Places search terms from a descriptive vibe. 
Extract 3 to 5 distinct, concrete, search queries (e.g. 'bookstore', 'ramen', 'rooftop bar') matching the user's desires. 
Return ONLY a JSON object containing a 'queries' array of strings. Example: {'queries': ['query1', 'query2']}.
```

---

### 2. Route Generator Prompt (GPT-4o)
Sourced in [main.py:L532-558](file:///c:/Users/vjbel/hacks/wander/wander-api/main.py#L532-L558).

This is the core prompt that feeds GPT-4o a strictly verified list of Google Places, weather details, daypart context, budget limitations, and custom vibes. It forces the model to select real venues in a geographical sequence.

```
System Prompt:
You are Wander — an urban experience curator with encyclopedic local knowledge.
Your life isn't a chore; wander. Help the user feel that.

VERIFIED VENUES (sourced from Google Places — these are real, confirmed businesses, sorted in order of geographical progression from Start (0%) to End (100%)):
{venues_context}

MISSION: Build exactly ONE walking route from {start_location} to {end_location} matching this theme: {route_type_desc}.
The route must use 3–4 stops chosen ONLY from the numbered list above.

TIME BUDGET: {time_budget_minutes} minutes TOTAL.
→ TARGET: The route should USE approximately {time_budget_minutes} minutes.
→ Each stop should have duration_mins of approximately {per_stop_mins} minutes (scale up for longer budgets).

{weather_prompt_chunk}
{time_prompt_chunk}
{exclude_prompt_chunk}

STRICT RULES:
1. Use ONLY venues from the list. Reference each by its [number] in venue_index. No invented stops.
2. Stops must progress geographically from {start_location} to {end_location}. Because the list above is sorted in increasing order of geographical progression, you MUST select your stops in strictly increasing index order (e.g., if your first stop is [3], your next stop must be [5] or higher, and the next even higher). Select stops that are distributed along the progression of the route (e.g., one from the early part of the list, one from the middle, and one from the later part of the list). Do NOT cluster all stops at the start or the end. Zero backtracking.
3. Hard cap: total time (duration_mins + walk_to_next_mins for all stops) ≤ {time_budget_minutes} min.
4. Write like a local who has lived here 10 years. Specific, warm. Never say "charming" or "vibrant."
5. Insider tips must be genuinely useful and specific to this exact venue.
6. Culinary Targeting: If the user's custom vibe explicitly mentions specific cuisines, high-end dining, or specific food items, you MUST heavily weight your selection toward venues in the verified list that match this, ignoring generic stops.
7. Accessibility: If the user requests wheelchair accessibility or 'no stairs', you must explicitly select venues that are accessible and plan routes that avoid known steep inclines or stairways based on your geographic knowledge.

Active vibe / custom request: {vibe}
```

#### Dynamic Prompt Chunks:
* **Weather Chunk** ([main.py:L500-514](file:///c:/Users/vjbel/hacks/wander/wander-api/main.py#L500-L514)): Automatically appended based on real-time weather alerts:
  * *Adverse Weather:* `"IMPORTANT: It is currently raining/snowing/storming at the starting location. You MUST prioritize indoor stops (museums, indoor markets, cozy cafes, bookstores) and covered areas. Avoid suggesting parks, open plazas, or un-sheltered outdoor walks."`
  * *Clear Weather:* `"The weather is clear/good. You may prioritize scenic outdoor stops if appropriate for the vibe."`
* **Time & Daypart Chunk** ([main.py:L516-524](file:///c:/Users/vjbel/hacks/wander/wander-api/main.py#L516-L524)): Automatically guides recommendations to avoid closed venues and construct logical daypart transitions:
  * `"IMPORTANT: Tailor the recommended stops to the time of day. For example, if it is late night (e.g. after 8 PM), do not recommend coffee shops or bookstores that close early; instead suggest bars, evening diners, or late-night dessert spots. If it is morning, suggest coffee shops and breakfast spots. DAYPART TRANSITIONING RULE: If the time budget spans across major dayparts (e.g., starting at 4:00 PM for 3 hours), logically sequence the stops to transition with the day (e.g., afternoon activity -> sunset view -> dinner/evening drinks). Do not suggest coffee shops at 7 PM."`
* **Exclusion Chunk** ([main.py:L526-530](file:///c:/Users/vjbel/hacks/wander/wander-api/main.py#L526-L530)): Prevents venues selected in Route 1 from overlapping into Route 2 or Route 3:
  * `"EXCLUDED VENUES: Do NOT use any of these venues as they have been used in previous routes: {previously_selected}."`

---

## Running Locally

### 1. Prerequisites
You must have the following installed locally:
* Node.js 18+ & npm
* Python 3.13+

### 2. Setup the Backend
```bash
cd wander-api

# Create a virtual environment
python -m venv venv
venv\Scripts\activate          # On Windows
source venv/bin/activate       # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

### 3. Setup the Frontend
```bash
cd wander-ui
npm install
npm run dev
```

Visit **http://localhost:3000** in your browser. The Next.js dev server will proxy `/api/*` requests directly to the FastAPI server at `localhost:8000`.

---

## Environment Variables

Create `wander-api/.env` with the following configuration:

```env
OPENAI_API_KEY="sk-..."

# LangSmith tracing (optional)
LANGCHAIN_TRACING_V2="true"
LANGCHAIN_API_KEY="lsv2_..."

# Google Maps Platform (Enable: Places API (New), Geocoding API, Directions API)
GOOGLE_MAPS_API_KEY="AIza..."

# OpenWeather API
OPENWEATHER_API_KEY="..."

# Tavily live web enrichment (Optional)
TAVILY_API_KEY="tvly-..."
```

---

## Verification & Testing

wander comes equipped with a comprehensive validation suite:

```bash
# Verify Google Geocoding, Places (New), and Directions APIs are active & keys are valid
wander-api\venv\Scripts\python test_google_apis.py

# Run the backend integration and RAG test suite
wander-api\venv\Scripts\python test_v3.py
```

The test suite asserts:
* ✅ Exactly 3 distinct routes are generated.
* ✅ Every route has a valid Google Maps walking deep link.
* ✅ `google_rating` is present on all RAG-sourced stops.
* ✅ Real `walk_to_next_mins` from Directions API are computed between every stop.
* ✅ Time budgets match walking durations with stop allowances.

---

## Project Layout

```
wander/
├── wander-api/               # FastAPI backend
│   ├── main.py               # RAG pipeline, route constraints, and SSE streaming
│   ├── database.py           # SQLite persistence for shared routes
│   ├── requirements.txt
│   └── .env                  # API keys (never committed)
│
├── wander-ui/                # Next.js frontend
│   ├── app/
│   │   ├── components/
│   │   │   └── MapPreview.tsx # Google Maps Embed API with route polyline
│   │   ├── r/[id]/            # Shareable static route renderer
│   │   ├── globals.css       # Custom range slider style and design tokens
│   │   ├── layout.tsx        # Outfit and Playfair Display fonts
│   │   └── page.tsx          # Dynamic inputs, route selector, timeline, and calendar export
│   ├── public/
│   │   ├── manifest.json     # PWA manifest
│   │   └── sw.js             # Service worker cache
│   └── next.config.ts        # Rewrites to proxy /api/* to localhost:8000
│
├── assets/                   # App screenshots & assets
├── test_google_apis.py       # Geocode/Places/Directions sanity checker
└── README.md                 # Project documentation
```

---

## Google Maps Deep-Link Handoff

When clicking **Start Wandering**, the app opens a deep-link format configured with pipe-separated coordinates. On mobile devices, this launches the native Google Maps app pre-loaded with the entire walking itinerary, bypassing standard manual navigation steps.

![Map Handoff Handoff](assets/map-handoff.png)

---

## License

This project is licensed under the MIT License.
