# wander: Business Plan & Unit Economics Strategy

This document details the financial model, operational cost containment, and revenue streams for the `wander` walking route planner.

---

## 1. Operational Cost Analysis (The Cost Center)

The core operational costs for `wander` are driven by external API calls required for each route generation lifecycle.

### API Cost Breakdown (Estimated Per 100 Runs)

| API Service | Endpoint / Model | Cost Per Call | Calls Per Run | Cost Per 100 Runs | Description |
|---|---|---|---|---|---|
| **Google Geocoding** | Address to Lat/Lng | $0.005 | 2 (Start, End) | $1.00 | Geolocates coordinates. |
| **Google Places (New)** | TextSearch (Vibe queries) | $0.032 | 3-5 queries | $12.80 | Corridor venue sweep. |
| **Google Directions** | Routes / Walking legs | $0.005 | 4-5 legs | $2.25 | Deterministic walking durations. |
| **OpenWeatherMap** | Weather context | $0.001 | 1 | $0.10 | Weather-aware venue selection. |
| **OpenAI GPT-4o-mini** | Query Extractor | $0.00015 | 1 | $0.015 | Vibe to search term parsing. |
| **OpenAI GPT-4o** | Route Curator / Generator | $0.015 | 3 (SSE stream) | $4.50 | Curation and tipping. |
| **Total Raw Variable Cost** | | | | **$20.665** | **~$0.21 per generation** |

---

## 2. Margin Protection & Infrastructure Optimization

To scale without infinite variable cost scaling, we implement three core optimization layers in the codebase.

### Layer A: Strategic Route Caching
* **Mechanism**: Persist generated itineraries in the SQLite database mapped by start/end coordinate hashes (rounded to 4 decimal places, representing ~11 meters resolution) and vibe category.
* **Impact**: Duplicate searches for common urban corridors (e.g. "SoHo to West Village") bypass geocoding, Places, and LLM calls entirely.
* **Cost reduction**: Reduces average API cost for high-traffic corridors to $0.00.

### Layer B: Corridor Radar Sweep Consolidation
* **Mechanism**: Group multiple vibe query terms into a single consolidated Google Places TextSearch call when searching along route bounding boxes, rather than running multiple parallel searches.
* **Cost reduction**: Reduces TextSearch billing from 5 calls down to 2-3 per run (saving ~40% on Places API costs).

### Layer C: Hybrid LLM Curation
* **Mechanism**: Route generation uses GPT-4o-mini for simple short runs and reserves GPT-4o for complex, highly custom prompts.
* **Cost reduction**: Cuts LLM cost per run from $0.045 to $0.015.

---

## 3. Revenue Models (The Profit Center)

To transition from a costing utility to a profitable business, `wander` operates a multi-layered monetization engine.

### Stream 1: Premium Subscriptions (Freemium)
* **Pricing**: $4.99 / month or $29.99 / year.
* **Free Tier Limits**: 3 route generations per day, default vibes only, standard Apple/Google Maps handoff.
* **Premium Features**:
  * Unlimited custom vibe prompt descriptions.
  * Unlimited stop-swapping with natural language refinement.
  * Wearable export (syncing route maps directly to Apple Watch, Garmin, and Fitbit).
  * Offline GPX/FIT format downloads.

### Stream 2: Promoted Waypoints (Local Merchant Advertising)
* **Mechanism**: Local businesses (cafes, boutique retail, independent bookstores) bid to be included in the candidate venue pool for matching corridors.
* **Curation Rule**: The engine continues to geocode and verify the merchant via Google Places. If the user's vibe matches the merchant's category (e.g. "record store"), the candidate is prioritised in the RAG context feed.
* **Pricing**: Pay-Per-Generation ($0.15 per route appearance) or Pay-Per-Walk-Through ($1.50 check-in fee verified via GPS proximity in Walk Mode).

### Stream 3: Booking Affiliate Commissions
* **Mechanism**: When a generated route includes a restaurant, bar, or event venue, embed deep-link booking triggers (e.g., OpenTable, Resy, Eventbrite, Fever).
* **Pricing**: 5% to 12% affiliate commission on reservations completed through the app's timeline interface.

---

## 4. Projected Unit Economics & Break-Even Analysis

Assuming a blended user base (90% Free, 10% Premium) and optimized API layers:

### Blended Revenue Per Generation (RPG)
* **Premium Subscription Allocation**: $0.05 per run (based on average premium usage of 100 runs/month).
* **Ad Revenue (Promoted Waypoints)**: $0.06 per run (assuming 1 promoted spot per 2 runs).
* **Affiliate Booking Conversion**: $0.15 per run (blended 2% reservation rate with $7.50 average payout).
* **Total Blended RPG**: **$0.26**

### Financial Margin Summary
* **Revenue Per Run**: $0.26
* **API Cost Per Run (Optimized)**: $0.12
* **Gross Profit Margin**: **53.8% ($0.14 profit per run)**

### Break-Even Scenario
To cover fixed server hosting and maintenance costs ($150 / month):
* **Required generations**: ~1,071 runs per month (approx. 36 per day).
* **Premium user break-even**: ~30 active monthly subscribers cover all fixed operational costs.
