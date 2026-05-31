# wander

> *Stop commuting. Start wandering.*

An AI-powered urban experience curator that turns a walk between any two points into three distinct, navigation-ready walking routes. wander is built for both out-of-town travelers landing in a new destination and locals looking to discover the hidden layers of their own streets. It transforms standard A-to-B transit into curated, slow-paced exploration.

<div align="center">
  <img src="assets/crop-01-landing.png" width="720" alt="wander landing — the shortest path isn't the point" />
</div>

---

## How It Works

wander accepts a starting location, an ending location, a time budget, and a desired vibe.

**1. Type your start location** — wander immediately surfaces AI-generated suggested wanders: 3 personalized route ideas based on the time of day, your neighborhood, and current weather. One tap applies the vibe, time budget, stop count, and companion type.

<div align="center">
  <img src="assets/crop-02-presets.png" width="660" alt="AI suggested wanders carousel appears on typing a start location" />
</div>

<br/>

**2. Add your destination & set your vibe** — choose from four curated vibe presets or describe your own in plain language (e.g. *"spicy noodles, vintage clothing, a quiet park"*). The AI pacing advisor reads your route and time budget and gives an instant green light or a heads-up.

<div align="center">
  <img src="assets/crop-03-form-filled.png" width="660" alt="Both locations filled, AI pacing advisor showing 3 stops is just right" />
</div>

<br/>

**3. Get three routes, instantly** — wander geocodes your inputs, checks live weather, sweeps the Google Places API along your corridor, and streams three distinct themed walking routes via SSE. Route 1 appears first; Routes 2 and 3 load in the background.

**4. Pick a route and explore** — each stop has real Google ratings, venue photos, curated insider tips, a Street View link, and accurate walk times between stops. Tap **swap stop** to swap any waypoint on the fly, or tap **Start Wandering** to open the full itinerary in Google Maps for turn-by-turn navigation.

<div align="center">
  <img src="assets/crop-04-route.png" width="660" alt="Three routes found — espresso & art stroll selected with stop timeline" />
</div>

<br/>

The stop timeline shows real venue photos, ratings, dwell times, and walk legs between every stop — plus a live Google Maps embed of the full route.

<div align="center">
  <img src="assets/crop-05-stops.png" width="660" alt="Full stop timeline with Afficionado Coffee, Meredith Rosen Gallery, Kinokuniya, and map" />
</div>

---

## Key Features

* ✨ **AI-Suggested wanders** — time-of-day-aware preset wanders generated from your start location. One tap applies vibe, time budget, stops, and companion.
* 🧭 **Live Walk Mode** — real-time GPS proximity tracking. Stops glow when you're within 150m. Dwell 5+ minutes and the next stop auto-advances. Shows accurate remaining time including walking legs.
* 🪄 **Stop Customization & Swapping** — don't like a stop? Tap **swap stop** to trigger a "Surprise Me" quick-swap (based on the current vibe) or enter a custom prompt (e.g. *"bookstore"* or *"bakery"*) to swap that specific stop. wander automatically finds candidates, queries GPT-4o to select and curate the details, and recomputes walking legs and navigation links.
* 🗺️ **Neighborhood Passport** — a personal stamp book of every neighborhood, vibe, and stop you've explored. Works even on shared route links.
* 🔁 **Loop & Round-Trip Sync** — tap `🔁` to lock end = start. Perfect for hotel/office loops.
* 🎭 **Zero-Hallucination RAG** — every stop is sourced from the Google Places API. The AI cannot invent venues.
* 🌦️ **Weather-Aware Curation** — rainy day? wander automatically pivots to indoor stops: museums, bookstores, covered markets.
* 🕒 **Daypart Transitioning** — no coffee shops at 8 PM. Routes sequence logically across morning → afternoon → evening.
* 📅 **Add to Calendar (ICS)** — download calendar events preloaded with stop addresses, ratings, durations, and Google Maps deep links.
* 🔗 **Shareable Routes** — every route gets a permanent short link (`/r/abc123`). Recipients can check in to stops and earn passport stamps.
* 📱 **PWA Installable** — install on iOS or Android directly from the browser for a full-screen native feel.

---

## Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | Next.js 16 (App Router, TypeScript) | Obsidian black (`#131316`) and matcha green (`#8BA88E`) interface. |
| **Styling & Animations** | Tailwind CSS v4, Framer Motion v12 | Glassmorphism cards, fluid transitions, staggered timeline loading. |
| **Backend** | FastAPI (Python 3.13, Uvicorn) | High-performance Python backend serving SSE streams. |
| **Persistence** | SQLite3 | Shareable route links (`/r/[id]`). |
| **AI Brain** | OpenAI GPT-4o & GPT-4o-mini | Structured JSON outputs for route curation and keyword extraction. |
| **Geocoding** | Google Geocoding API | Converts natural language addresses to lat/lng coordinates. |
| **Venue Search** | Google Places API (New) | Parallel radar queries centered along the route corridor. |
| **Walking Feasibility** | Google Directions API | Real road-network walking durations between every stop. |
| **Weather** | OpenWeatherMap API | Live weather retrieval for weather-aware routing. |

---

## System Architecture

wander enforces a strict, multi-stage RAG pipeline to generate hallucination-free walking tours:

```
User Request (start, end, time_budget, vibe, local_time)
    │
    ├─ 1. Geocode Start & End coordinates (Geocoding API)
    │
    ├─ 2. Fetch current weather conditions (OpenWeatherMap API)
    │
    ├─ 3. Keyword Extraction (GPT-4o-mini)
    │      Extracts Maps search queries from the user's custom vibe text.
    │
    ├─ 4. Corridor Radar Sweep (Places API New)
    │      5 parallel searches centered along the route path →
    │      15-20 verified venue candidates.
    │
    ├─ 5. Sequential Route Generation (GPT-4o)
    │      Streams 3 distinct themed routes via SSE.
    │      Venues used in Route 1 are excluded from Routes 2 & 3.
    │
    ├─ 6. Walking Validation (Directions API)
    │      Validates real road-network walking time between every stop.
    │
    ├─ 7. Persistence (SQLite3)
    │      Stores route data for permanent shareable links.
    │
    └─ Response streamed → Timeline, Ratings, Map Polyline, Deep Link, ICS
```

---

## AI & LLM Prompts

wander uses two specialized prompts in its backend pipeline:

### 1. Search Query Extractor (GPT-4o-mini)

Parses the user's natural language vibe into clean Google Places search queries.

```
You are an assistant that extracts specific Google Maps Places search terms from a descriptive vibe.
Extract 3 to 5 distinct, concrete search queries (e.g. 'bookstore', 'ramen', 'rooftop bar') matching the user's desires.
Return ONLY a JSON object: {'queries': ['query1', 'query2']}.
```

### 2. Route Generator (GPT-4o)

The core prompt — fed a verified list of real Places results, weather context, daypart, and time budget. Forces geographically-sequenced selection of real venues only.

```
You are wander — an urban experience curator with encyclopedic local knowledge.
Your life isn't a chore; wander. Help the user feel that.

VERIFIED VENUES (sourced from Google Places, sorted Start → End):
{venues_context}

MISSION: Build ONE walking route from {start_location} to {end_location} matching: {route_type_desc}.
Use 3–4 stops ONLY from the numbered list above.

TIME BUDGET: {time_budget_minutes} minutes TOTAL.
→ Each stop: ~{per_stop_mins} min dwell.

STRICT RULES:
1. Use ONLY listed venues — no invented stops.
2. Stops must progress in strictly increasing index order (no backtracking).
3. Hard cap: Σ(duration_mins + walk_to_next_mins) ≤ {time_budget_minutes}.
4. Write like a local who's lived here 10 years. Never say "charming" or "vibrant."
5. Insider tips must be specific to this exact venue.
```

Dynamic chunks automatically appended: **Weather** (indoor pivot on rain/snow), **Daypart** (no coffee at 8 PM), **Exclusion** (deduplicates across the 3 routes).

---

## Running Locally

### Prerequisites
* Node.js 18+ & npm
* Python 3.13+

### Backend
```bash
cd wander-api
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd wander-ui
npm install
npm run dev
```

Visit **http://localhost:3000**. The Next.js dev server proxies `/api/*` to FastAPI at `localhost:8000`.

---

## Environment Variables

Create `wander-api/.env`:

```env
OPENAI_API_KEY="sk-..."

# LangSmith tracing (optional)
LANGCHAIN_TRACING_V2="true"
LANGCHAIN_API_KEY="lsv2_..."

# Google Maps Platform (enable: Places API New, Geocoding API, Directions API)
GOOGLE_MAPS_API_KEY="AIza..."

# OpenWeather
OPENWEATHER_API_KEY="..."

# Tavily (optional)
TAVILY_API_KEY="tvly-..."
```

---

## Verification & Testing

```bash
# Sanity-check all Google API keys
wander-api\venv\Scripts\python test_google_apis.py

# Full backend integration & RAG test suite
wander-api\venv\Scripts\python test_v3.py
```

Asserts:
* ✅ Exactly 3 distinct routes generated.
* ✅ Every route has a valid Google Maps walking deep link.
* ✅ `google_rating` present on all RAG-sourced stops.
* ✅ Real `walk_to_next_mins` from Directions API between every stop.
* ✅ Time budgets respect walking + dwell constraints.

---

## Project Layout

```
wander/
├── wander-api/
│   ├── main.py               # RAG pipeline, route constraints, SSE streaming
│   ├── database.py           # SQLite persistence for shared routes
│   ├── requirements.txt
│   └── .env                  # API keys (never committed)
│
├── wander-ui/
│   ├── app/
│   │   ├── components/
│   │   │   └── MapPreview.tsx      # Google Maps embed with route polyline
│   │   ├── hooks/
│   │   │   ├── useWalkMode.ts      # Live GPS walk mode, proximity detection
│   │   │   └── usePassport.ts      # Neighborhood passport (localStorage)
│   │   ├── r/[id]/page.tsx         # Shareable route renderer
│   │   ├── globals.css             # Design tokens, animation utilities
│   │   ├── layout.tsx              # Inter + Playfair Display fonts
│   │   └── page.tsx                # Main app — inputs, routes, timeline, calendar
│   ├── public/
│   │   ├── manifest.json           # PWA manifest
│   │   └── sw.js                   # Service worker cache
│   └── next.config.ts              # /api/* proxy → localhost:8000
│
├── assets/                         # App screenshots
└── README.md
```

---

## License

MIT
