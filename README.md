# Wander

![Wander Banner](assets/banner.png)

> *Your life isn't a chore; wander.*

An AI-powered urban itinerary generator that turns any two locations into three distinct, navigation-ready walking routes. Built for people who want to actually experience their city, not just commute through it.

---

## What It Does

<div align="center">
  <img src="assets/01-landing.png" width="800" alt="Wander Landing Screen" />
  <br/><br/>
  <img src="assets/02-form-filled.png" width="800" alt="Wander Input Form" />
  <br/><br/>
  <img src="assets/04-route.png" width="800" alt="Wander Generated Route" />
</div>

You give Wander a starting point, a destination, a time budget, and a vibe—or type a custom personal request (e.g., *"I want spicy noodles, a vintage clothing store, and a quiet place to read"*). 

Wander geocodes the points, queries local weather, and performs a parallel radar sweep across Google Places near your corridor. It feeds this verified real-world context to GPT-4o to curate three uniquely themed routes. Every route streams to the frontend sequentially using Server-Sent Events, letting you view and browse Route 1 while Route 2 and 3 generate in the background.

Every stop has a live Google rating badge and expandable insider tips. One tap on **Start Wandering** opens the entire multi-stop walking tour pre-loaded inside Google Maps for turn-by-turn navigation.

---

## Key Features

* 🎭 **Custom Vibe Prompting**: Deselect presets and type exactly what you are looking for. GPT-4o interprets your custom prompt and maps it to verified local venues.
* 🌦️ **Weather-Aware Routing**: Pulls current weather at the start location. If it is raining, the AI automatically steers the itinerary toward indoor venues (museums, indoor markets, cozy cafes) rather than parks and rooftops.
* ⏳ **Real-Time SSE Streaming**: Generates routes sequentially. Route 1 appears instantly on screen while Route 2 and 3 continue loading, eliminating long wait states.
* 🔗 **Route Saving & Sharing**: Instantly persist your favorite routes to a local SQLite database and copy a unique shareable link (e.g., `/r/c9a4f2`) to send to friends.
* 🕒 **Time-of-Day Context**: Captures the current day and time to steer recommendations (e.g., avoiding breakfast-only cafes in the evening in favor of late-night bars, dessert rooms, or diners).
* 📱 **PWA Installable**: Fully configured Progressive Web App with service worker caching. Install it on iOS or Android directly from the browser for a full-screen native feel.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router, TypeScript, Tailwind CSS v4) |
| **Animations** | Framer Motion v12 |
| **PWA Shell** | Service Workers (sw.js) + manifest.json |
| **Backend** | FastAPI (Python 3.13, Uvicorn) |
| **Persistence** | SQLite3 (`database.py`) |
| **AI Brain** | OpenAI GPT-4o — Structured Outputs & Streaming |
| **Venue Radar** | Google Places API (New) |
| **Geocoding** | Google Geocoding API |
| **Weather API** | OpenWeatherMap API |
| **Walk Times** | Google Directions API (walking mode, coordinate-routed) |
| **Tracing** | LangSmith |

---

## System Architecture

The pipeline ensures that routes are built entirely around real, verified venues and actual walking times, eliminating AI hallucinations:

```
User Request (start, end, time, vibe, local_time)
    │
    ├─ 1. Geocode start & end → lat/lng (Geocoding API)
    │
    ├─ 2. Fetch current weather (OpenWeatherMap API) to check for rain/adverse conditions
    │
    ├─ 3. Radar sweep: 5 parallel Places searches centered on route midpoint → 15-20 verified venues
    │
    ├─ 4. Stream sequentially via Server-Sent Events (SSE) as they are curated:
    │         Route 1: Scenic & relaxed (flows outdoors, or indoors if raining)
    │         Route 2: Culturally dense
    │         Route 3: Social & focused
    │         *Selected venues from earlier routes are fed forward to prevent overlap
    │
    ├─ 5. Directions API → real walking minutes between every stop using coordinates
    │
    ├─ 6. Build Google Maps deep links (URL-encoded, pipe-separated waypoints)
    │
    └─ WanderResponse → 3 routes, Google ratings, weather-aware, persistent SQLite shares, ready to navigate
```

---

## Prerequisites

You must have the following installed locally:
- Python 3.13+
- Node.js 18+
- npm, pnpm, or yarn

---

## Running Locally

### 1. Setup the Backend
```bash
cd wander-api
# Create a virtual environment and activate it
python -m venv venv
venv\Scripts\activate          # On Windows
source venv/bin/activate        # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

### 2. Setup the Frontend
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

# LangSmith tracing
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

## Testing

Verify that your APIs and backend integration are working:

```bash
# Verify Google Geocoding, Places, and Directions APIs are live
wander-api\venv\Scripts\python test_google_apis.py

# Run the backend integration test suite
wander-api\venv\Scripts\python test_v3.py
```

The integration test suite asserts:
- ✅ Exactly 3 distinct routes are generated
- ✅ Every route has a valid Google Maps walking deep link
- ✅ `google_rating` is present on all RAG-sourced stops
- ✅ Real `walk_to_next_mins` from Directions API are computed between every stop

---

## Project Structure

```
wander/
├── wander-api/               # FastAPI backend
│   ├── main.py               # RAG pipeline & event streaming
│   ├── database.py           # SQLite route persistence
│   ├── requirements.txt
│   └── .env                  # API keys (not committed)
│
├── wander-ui/                # Next.js frontend
│   ├── app/
│   │   ├── components/
│   │   │   └── MapPreview.tsx # Google Maps preview with route polyline
│   │   ├── r/[id]/            # Shared route viewer page
│   │   ├── globals.css       # Tailwind design tokens & gradients
│   │   ├── layout.tsx        # Fonts & layout structure
│   │   └── page.tsx          # Interactive input, loading, & route timeline
│   ├── public/
│   │   ├── manifest.json     # PWA manifest
│   │   └── sw.js             # Service worker cache
│   └── next.config.ts        # API proxy rewrite configuration
│
├── assets/                   # App screenshots
├── test_google_apis.py       # Google API verification script
├── test_v3.py                # Backend integration test
└── README.md                 # Main documentation
```

---

## Design System

**Theme:** *Quiet Luxury / Digital Oasis* — a dark, refined, minimal aesthetic featuring custom background gradients and micro-animations.

| Token | Value | Use |
|---|---|---|
| Obsidian | `#131316` | Page background |
| Surface | `#1E1E24` | Glassmorphism cards |
| Matcha | `#8BA88E` | Primary accent, active states, CTAs |
| Sand | `#E5D3B3` | Timers, ratings, insider tips |
| Cream | `#F4F4F5` | Body text |

Typography: **Playfair Display** (serif, headings) + **Inter** (sans, body).

---

## Google Maps Deep-Link Handoff

When you click **Start Wandering**, the app redirects to a Google Maps walking directions deep link. On mobile, this launches the native Google Maps app with the full multi-stop walking tour pre-loaded, ready for turn-by-turn navigation.

![Map Handoff Visualization](assets/08-google-maps.png)

---

## License

This project is licensed under the MIT License.
