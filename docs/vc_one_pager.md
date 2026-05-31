# Executive Summary: wander

wander is a context-aware walking route planner that generates curated, multi-stop itineraries between starting and ending coordinates. The application integrates geocoding, parallel venue radar sweeps, and real road-network walking time calculations to construct hallucination-free local exploration paths.

---

## 1. The Opportunity

### The Problem
Urban exploration and micro-adventures suffer from high cognitive overhead and decision fatigue. While services like Yelp or Google Maps catalog individual venues, they do not synthesize them into sequenced journeys. Conversely, traditional travel guides are static and non-customizable, while standard LLM trip-planners frequently hallucinate non-existent venues.

### The Solution
wander is a lightweight, high-performance web and mobile application that dynamically generates themed walking routes. The system operates on a verified retrieval-augmented generation (RAG) pipeline:
1. **Physical Validation**: Converts addresses to coordinates and retrieves local weather and time metrics.
2. **Corridor Sweep**: Queries real-world candidates from the Google Places API along the walking corridor.
3. **LLM Curation**: Uses GPT-4o to select candidate venues, write local insider tips, and sequence stops without backtracking.
4. **Transit Accuracy**: Queries the Google Directions API to calculate exact road-network walking minutes between stops.

---

## 2. Market Dynamics

* **Target Audience**: Urban residents, micro-adventurers, health-focused walkers tracking daily step goals, and travelers seeking off-the-beaten-path itineraries.
* **Core Drivers**: The rise of local tourism, wellness trends (daily step goals), and the demand for curated, offline, real-world experiences.
* **TAM (Total Addressable Market)**: The global tourism and navigation application market, driven by over 1.5 billion travelers annually and 200 million monthly active users on fitness and wellness walking apps.

---

## 3. Product Differentiation

* **Zero Hallucination Guarantee**: All waypoints are sourced from the live Google Places API. If a venue does not exist in the database, it cannot appear on a wander route.
* **Pacing Feasibility**: Includes a client-side pacing advisor that analyzes route geometry to flag impossible itineraries before execution.
* **Accessibility & Incline Check**: Evaluates walking leg polylines using the Google Elevation API, automatically skipping routes with steep slopes (>8% grade) when slope avoidance is enabled.
* **Budget Control**: Restricts waypoint selections and estimates individual stop spend to strictly adhere to the user's defined maximum budget cap.
* **Dynamic Swapping & Spontaneous Detours**: Users can swap stops inline or trigger spontaneous "Vibe Detours" on the fly using a glowing detour button or an interactive device shake gesture while walking in Live Walk Mode.
* **Native Navigation Handoff**: Exports multi-stop walking directions directly to Google Maps or Apple Maps with geocoded coordinates, avoiding in-app navigation complexity while safely handling third-party landmarks.

---

## 4. Business Model & Financial Strategy

* **Freemium Subscriptions**: Free tier covers standard routes. Premium subscription unlocks custom vibe generation, unlimited stop swaps, group sync, and export to wearables.
* **Affiliate Bookings**: Integration with restaurant reservation systems (OpenTable, Resy) and local ticketing portals (Eventbrite) to capture referral fees.
* **Sponsored Waypoints**: Local merchants pay a premium to appear as candidate stops in the corridor search pool, selected dynamically based on user vibes.
* **Negative Margin Mitigation**: AI and Google Maps API usage costs are offset by user-facing premium fees, route caching layers, and token-efficient prompt formats.
