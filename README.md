# 🗺️ Wander

> **An AI-powered urban wandering companion that turns a start point, an end point, and a vibe into a curated, time-boxed itinerary — no planning required.**

---

## What is Wander?

Most travel apps optimize for efficiency. Wander optimizes for *experience*.

You tell it where you're starting, where you need to end up, how much time you have, and what kind of energy you're bringing — and an LLM-powered agentic backend crafts a bespoke walking itinerary: the hidden coffee shop, the free gallery opening, the park bench with the best view. The kind of afternoon you'd stumble into by accident, delivered on demand.

---

## Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| **Animations** | Framer Motion |
| **Backend** | FastAPI (Python 3.13) |
| **AI Brain** | OpenAI — GPT-4o with Structured Outputs |
| **Mapping** | Mapbox GL JS |
| **Places & Venues** | Google Places API + Yelp Fusion |
| **Events** | Ticketmaster + Eventbrite |
| **Live Web Search** | Tavily |
| **Tracing** | LangSmith |

---

## Architecture

```
wander/
├── wander-api/        # FastAPI backend — the agentic brain
│   ├── main.py        # Route engine, Pydantic models, OpenAI structured outputs
│   ├── .env           # API keys (gitignored)
│   ├── requirements.txt
│   └── venv/          # Python 3.13 virtual env (gitignored)
│
└── wander-ui/         # Next.js frontend — the experience layer
    ├── app/
    │   └── page.tsx   # Main UI: Input → Loading → Itinerary timeline
    ├── public/
    └── package.json
```

---

## Getting Started

### Prerequisites
- Python 3.13+
- Node.js 18+
- API keys in `wander-api/.env` (see `.env` in project root for template)

### Backend

```bash
cd wander-api
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at **http://localhost:8000** — Swagger docs at **http://localhost:8000/docs**

### Frontend

```bash
cd wander-ui
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## API

### `POST /api/generate-route`

**Request:**
```json
{
  "start_location": "Hell's Kitchen, NYC",
  "end_location": "Flatiron, NYC",
  "time_budget_minutes": 120,
  "vibe": "Caffeinated & Cultured"
}
```

**Response:**
```json
{
  "route_title": "The Creative Drift",
  "total_duration_mins": 115,
  "waypoints": [
    {
      "order": 1,
      "location_name": "Ninth Avenue Espresso",
      "action_description": "Start with a single-origin pour-over at this Hell's Kitchen institution.",
      "duration_mins": 20,
      "vibe_tag": "Caffeinated"
    }
  ]
}
```

---

## Vibes

Three starting personalities, infinitely combinable:

- ☕ **Caffeinated & Cultured** — coffee shops, bookstores, galleries, jazz bars
- 🌿 **Green & Scenic** — parks, waterfronts, hidden gardens, architecture
- ⚡ **Spontaneous & Social** — pop-ups, live events, street food, rooftops

---

## Roadmap

- [x] Core agentic route generation (OpenAI Structured Outputs)
- [x] Input UI + animated itinerary timeline
- [ ] Mapbox interactive route map
- [ ] Real-time Yelp/Google Places enrichment per waypoint
- [ ] Live event injection (Ticketmaster / Eventbrite)
- [ ] Tavily fallback for niche/unmapped spots
- [ ] Save & share routes
- [ ] Mobile-first PWA

---

*Built with the philosophy that the best city experiences are unplanned — just give them a little structure.*
