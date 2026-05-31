# Market Opportunity & Sizing Presentation
*Accenture & McKinsey Sizing Frameworks*

---

## Slide 1: Title & Strategic Intent
**wander: Monetizing the Urban Micro-Adventure**
* Capturing local exploration and active walking markets through geolocated AI curation.
* **Investment Thesis**: Travel planning is broken. Users demand personalized, real-time, real-world experiences without planning overhead. By bridging geolocated API data with LLM curation, wander creates a high-margin consumer utility.

---

## Slide 2: Market Sizing Framework (TAM, SAM, SOM)
*McKinsey Sizing Model for Localized Navigation Services*

```
┌──────────────────────────────────────────────────────────┐
│ TOTAL ADDRESSABLE MARKET (TAM): $14.2B                   │
│ Global Digital Travel & Navigation Markets               │
│ (2B+ smartphone users, 500M annual leisure travelers)    │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────────┐
        │ SERVICEABLE ADDRESSABLE MARKET (SAM): $3.1B      │
        │ Local Urban Exploration & Micro-Adventures       │
        │ (Active walkers, fitness goal trackers, local    │
        │ weekend planners in top 50 global metro areas)   │
        └──────────────────┬───────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────────────────────────┐
                │ SERVICEABLE OBTAINABLE MARKET (SOM): $150M│
                │ Initial launch target: NYC, SF, London   │
                │ active walkers, local micro-adventurers, │
                │ and premium subscribers                  │
                └──────────────────────────────────────────┘
```

---

## Slide 3: Growth Drivers & Macro Trends
*Accenture Analysis: Consumer Behavior Shifts*

1. **The Step Economy & Wellness Integration**: 
   * Over 150M active monthly users globally track steps daily (e.g. Apple Health, Garmin, Strava). 
   * Integrating step targets into leisure routing converts physical activity into consumer experiences.
2. **Post-Planning Travel Fatigue**: 
   * 74% of consumers report feeling overwhelmed by travel booking and planning research.
   * wander replaces the manual curation lifecycle (reading 10 blogs and cross-referencing maps) with a 2-second generation flow.
3. **The Rise of the Micro-Adventure**: 
   * Consumers spend 40% more on hyper-local weekend experiences than they did five years ago, driven by rising hotel and flight costs.

---

## Slide 4: Competitive Landscaping
*Competitive Positioning Matrix*

* **Standard Navigation (Google Maps, Apple Maps)**:
  * *Focus*: Point A to Point B routing.
  * *Deficit*: No narrative curation, no vibe discovery, high user layout friction.
* **Travel Recommendation Directories (Yelp, TripAdvisor)**:
  * *Focus*: Static database queries and user review lists.
  * *Deficit*: No sequenced routing, no physical geometry pacing validation, high click friction.
* **Pure LLM Planners (ChatGPT, Gemini)**:
  * *Focus*: Natural language output.
  * *Deficit*: High rate of venue hallucination, lack of real-world geocoding coordinates, incorrect transit times.
* **wander (Geolocated Curation)**:
  * *Focus*: Real-world API geocoding + RAG selection + Directions validation.
  * *Strengths*: Operates at the intersection of narrative curation and structural accuracy, with interactive shake-to-detour triggers, slope safety filters, LLM-guided budget limits, and walk/dwell pacing breakdown indicators.
  * *Deficit*: None.

---

## Slide 5: Strategic Monetization Engine

```
                                  REVENUE STREAMS
                                         │
    ┌────────────────────┬───────────────┴───────────────┬────────────────────┐
    ▼                    ▼                               ▼                    ▼
Subscription         Promoted Waypoints             Affiliate Portals    Wearable Exports
Premium vibe prompt  Merchants pay to appear        OpenTable/Resy/Event Custom integration
customization and    as candidates in search        integrations for     with Apple Watch/
unlimited stop swaps corridor sweeps.               referral booking fee Garmin exports.
```

---

## Slide 6: Margin Management & AI Unit Economics
*Financial Control Model*

* **The Problem**: High variable API costs (Google Geocoding, Google Places, Google Directions, OpenAI GPT-4o-mini and GPT-4o) threaten unit margins.
* **Accenture Strategy: Layered Cost Management**:
  * **Level 1: Route Caching (SQLite)**: Persisting generated routes reduces duplicate API hits for popular start/end coordinates.
  * **Level 2: Dual-Model Routing**: Extractor model runs on GPT-4o-mini (low cost). Curated generator runs on GPT-4o.
  * **Level 2b: Structured Schema Enforcement**: Eliminates API retry overhead by forcing output compliance directly via OpenAI Pydantic parsing.
  * **Level 3: Corridor Search Thinning**: Grouping geolocated sweep queries to minimize Google Places API billing calls.
  * **Level 4: Detour APIs (Foursquare & OpenTripMap)**: Offloading detours to commercial & cultural directories with generous free-call quotas (Foursquare, OpenTripMap) keeps detour search variable cost at $0.00.
  * **Unit Target**: Total cost per route generation: ~$0.05. Target revenue per generation (blended ads/subs): ~$0.14. Gross Margin: 64%.
