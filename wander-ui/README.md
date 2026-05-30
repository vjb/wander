# Wander UI

> *Your life isn't a chore; wander.*

The Next.js 16 frontend for **Wander** — generates three distinct, Google-verified walking routes per request, each one tap away from live GPS navigation in Google Maps.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion v12 |
| Fonts | Playfair Display (headings) + Inter (body) |
| API | FastAPI backend via `/api/*` proxy rewrite |

---

## Design System — *Quiet Luxury / Digital Oasis*

A dark, premium, and minimal palette with elegant typography:

| Token | Value | Use |
|---|---|---|
| Obsidian | `#131316` | Page background |
| Surface | `#1E1E24` | Glassmorphism cards |
| Matcha | `#8BA88E` | Accent, CTAs, active states |
| Sand | `#E5D3B3` | Ratings, timers, insider tips |
| Cream | `#F4F4F5` | Body text |

Typography: **Playfair Display** (serif, headings) + **Inter** (sans, body).

---

## Running Locally

Requires the FastAPI backend running on `localhost:8000`.

```bash
npm install
npm run dev
# → http://localhost:3000
```

All `/api/*` requests are proxied to `http://localhost:8000/api/*` via Next.js rewrites in `next.config.ts`.

---

## End-to-End Walkthrough

An interactive walkthrough session: *Hell's Kitchen ➔ Flatiron District, 90 min, Green & Scenic.*

---

### Screen 1 — Landing

Open [http://localhost:3000](http://localhost:3000). The input form appears over a dark obsidian background with ambient gradient orbs and a subtle dot-grid texture.

![Landing screen — dark background, Playfair Display headline, glassmorphism card](../assets/01-landing.png)

**Design details:**
- Serif headline: *"Your city has **secrets** to share."* — Playfair Display
- Glassmorphism card with `backdrop-blur` + `border-white/7`
- Navigation icon + `WANDER` wordmark in Matcha
- Vibe selector buttons (Caffeinated & Cultured / Green & Scenic / Spontaneous & Social) + a custom text prompt input
- Floating "Install App" button in header (available when installable as a PWA)

---

### Screen 2 — Form Filled

Enter your start and end points. Select a vibe or type a custom vibe. The button activates.

![Form filled — Hell's Kitchen to Flatiron, Green & Scenic selected, CTA active](../assets/02-form-filled.png)

**Interaction details:**
- `Starting from…` / `Ending up at…` — transparent text inputs, no border clutter
- Time budget slider: 30 min ➔ 4 hours in 15-minute steps, Sand-colored value display
- Vibe card spring-scales on select, glows with vibe-matched color
- `Generate three routes →` button activates in Soft Matcha green

---

### Screen 3 — Loading

Click **Generate three routes**. The app crossfades to the loading state while the RAG pipeline runs (geocode ➔ Places radar ➔ GPT-4o ➔ Directions API).

![Loading screen — map emoji, italic cycling serif text, breathing dots](../assets/03-loading.png)

**What's happening:**
- 🗺️ emoji drifts on a slow vertical loop
- Italic Playfair Display text cycles every 2 seconds:
  *Reading the streets… ➔ Curating three paths… ➔ Consulting the locals…*
- Pulsing dots with staggered opacity + scale animation
- Response time: Sequential stream starts loading Route 1 in ~4 seconds.

---

### Screen 4 — Three Routes

Routes arrive. The page crossfades to the itinerary view with a staggered card animation.

![Route screen — 3-tab carousel, numbered stops, walk labels, sticky Start Wandering button](../assets/04-route.png)

**Core features visible:**
- **Route carousel** at the top — Framer Motion `layoutId` pill slides between Route 1 / 2 / 3
- Each tab shows the route name; active tab highlighted in Matcha
- **Numbered stop cards** — vibe tag pill, location name, rating badge, address, action description, duration
- **Walk labels** between stops: *🚶 ~12 min walk* (computed by Google Directions API)
- **Map Preview** component showing start, stops, end location pins, and a polyline path with directional flow arrows
- **Sticky "Start Wandering"** button pinned to the bottom with frosted gradient

---

### Screen 5 — Carousel Switch

Click Route 2. The Matcha pill slides over, the old timeline fades out, and Route 2's stops stagger in fresh.

![Carousel switched to Route 2 — Cultural Link stops visible](../assets/05-carousel.png)

**Animation:** `AnimatePresence mode="wait"` with `key={selectedIndex}` — full stagger re-runs on every tab change without layout shift.

---

### Screen 6 — Insider Tip

Each stop card has a hidden **Insider tip**. Click to expand.

![Insider tip expanded — italic Playfair quote in Sand color](../assets/06-insider-tip.png)

The tip panel expands with an `AnimatePresence` height animation, separated by a Sand-tinted divider.

---

### Screen 7 — Start Wandering

Tap **Start Wandering**. The app opens your multi-stop walking tour pre-loaded inside Google Maps.

![Sticky Start Wandering button — frosted gradient footer, Matcha green CTA](../assets/07-sticky-button.png)

The deep link format:
```
https://www.google.com/maps/dir/?api=1
  &origin=Hell%27s+Kitchen%2C+NYC
  &destination=Flatiron+District%2C+NYC
  &waypoints=750+11th+Ave...%7C540+W+26th+St...
  &travelmode=walking
```

---

### Screen 8 — Google Maps Navigation

Google Maps opens with the full walking route rendered — blue dotted line, all stops pinned, total time and distance calculated.

![Google Maps walking route — blue dotted line, 4 stops, 1 hr 9 min / 3.0 miles](../assets/08-google-maps.png)

- Blue walking route tracing from start to end location
- All waypoints pinned on the map
- Tap the blue **Start** button in Google Maps for turn-by-turn GPS navigation

---

## API Response Shape

The frontend consumes the following JSON structure from the backend:

```json
{
  "routes": [
    {
      "route_name": "The Parkway Stroll",
      "theme_summary": "Ultra-scenic waterfront arc with maximum green space.",
      "total_walking_time_mins": 112,
      "navigation_deep_link": "https://www.google.com/maps/dir/?api=1&...",
      "start_location": "Hell's Kitchen, NYC",
      "end_location": "Flatiron District, NYC",
      "start_lat": 40.7637,
      "start_lng": -73.9918,
      "end_lat": 40.7400,
      "end_lng": -73.9903,
      "waypoints": [
        {
          "order": 1,
          "location_name": "Hudson River Park",
          "address_hint": "Pier 84, New York, NY",
          "google_rating": 4.6,
          "action_description": "Start your journey at the edge of Manhattan...",
          "duration_mins": 20,
          "walk_to_next_mins": 12,
          "vibe_tag": "Waterfront Walk",
          "insider_tip": "Grab a seat at the end of the pier..."
        }
      ]
    }
  ]
}
```

---

## File Structure

```
wander-ui/
├── app/
│   ├── components/
│   │   └── MapPreview.tsx   # Google Maps component using @vis.gl/react-google-maps
│   ├── r/[id]/
│   │   └── page.tsx         # Shared route viewer
│   ├── globals.css          # Tailwind gradients & custom animations
│   ├── layout.tsx           # Playfair Display & Inter font configurations
│   └── page.tsx             # Interactive application layout
├── public/
│   ├── manifest.json        # PWA configuration
│   └── sw.js                # PWA Service Worker caching
├── next.config.ts           # API rewrite proxy
└── package.json
```

---

## Screen Reference

| File | Screen | Key Feature |
|---|---|---|
| `assets/01-landing.png` | Input form | Glassmorphism card, ambient orbs |
| `assets/02-form-filled.png` | Form filled | Vibe selection spring animation |
| `assets/03-loading.png` | Loading state | Cycling serif text, breathing dots |
| `assets/04-route.png` | Route result | 3-tab carousel, map polyline, stop cards |
| `assets/05-carousel.png` | Tab switched | Timeline re-animations on tab click |
| `assets/06-insider-tip.png` | Tip expanded | Smooth height expansion, italic text |
| `assets/07-sticky-button.png` | Start Wandering | Sticky frosted footer, Google Maps deep-link |
| `assets/08-google-maps.png` | Google Maps open | Walking path loaded in native maps |
