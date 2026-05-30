# 🗺️ Wander V3: RAG-Powered, Hallucination-Free Backend

## The Architecture Shift
V3 eliminates AI hallucination entirely. Instead of asking GPT-4o to *invent* places,
we use Google Places API as a real-world **radar sweep**, then feed those verified venues
as RAG context to the LLM. GPT-4o becomes a curator, not an inventor.

```
User Request
    ↓
1. Geocode start → real lat/lng (Google Geocoding API)
2. Places API (New) → 15-20 real verified venues near the route
3. GPT-4o (RAG) → selects from verified list, writes descriptions
4. Directions API → real walking minutes between every stop
5. Build deep links + inject google_rating on every waypoint
    ↓
WanderV3Response — hallucination-free, navigation-ready
```

---

## Phase 1: Backend API & Data Pipeline ✅

- [x] `GOOGLE_MAPS_API_KEY` added to `wander-api/.env`
- [x] Google APIs verified: Geocoding ✅ Directions ✅ Places (New) ✅
- [x] Rewrote `main.py` — V3 RAG pipeline
  - `geocode_location()` — converts address → lat/lng
  - `search_places()` — Places API (New) searchText per vibe query
  - `fetch_candidate_venues()` — runs 5 parallel searches, deduplicates by place_id
  - `get_walking_times_for_route()` — Directions API for each consecutive stop pair
  - `_call_openai_v3_rag()` — GPT-4o selects from verified venue list via venue_index
  - `build_maps_deep_link()` — URL-encoded Google Maps walking URL
- [x] `WaypointV3` model with `google_rating: float | None`
- [x] Graceful fallback to V2-style generation when Places returns 0 results

> **🧪 TEST 1:** Run `python test_v3.py`
> Pass: 200 OK, 3 routes, every waypoint has google_rating, deep links valid.

---

## Phase 2: Frontend Data & State Upgrade ✅

- [x] Updated TypeScript interfaces: `WaypointV3` (adds `google_rating`)
- [x] `WanderV3Response` / `WanderRouteOptionV3` types in `page.tsx`
- [x] `selectedRouteIndex` state (already from V2 carousel)
- [x] Fetch parses new nested JSON structure (same shape as V2)

---

## Phase 3: Frontend UI — Trust Badges ✅

- [x] `google_rating` badge on every waypoint card: `★ 4.6` in sand color
- [x] Walk times now show real Google Directions minutes (not GPT-4o estimates)
- [x] Sticky "Start Wandering" button opens deep link (unchanged from V2)

---

## Testing Protocol

### 1. Scripted Backend Test
```bash
wander-api\venv\Scripts\python test_v3.py
```
Pass criteria: 3 routes, all waypoints have `google_rating`, valid deep links.

### 2. Browser UX Tests
- **Carousel Snap:** Click rapidly between routes — no flash, no React key errors
- **Trust Check:** Every stop shows a ★ rating badge (proves Places API sourcing)
- **Handoff:** Tap "Start Wandering" on mobile → native Google Maps opens walking mode
