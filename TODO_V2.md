# 🗺️ Wander V2: Multi-Route & Deep-Linking Upgrade

## Phase 1: Backend Data Model Expansion ✅

- [x] **1.1 Update Pydantic Schemas** — `WaypointV2` (with `walk_to_next_mins` + `address_hint`), `WanderRouteOptionLLM`, `WanderV2ResponseLLM` for parsing; `WanderRouteOption` + `WanderV2Response` for the public API (includes computed `navigation_deep_link`)
- [x] **1.2 Rewrite the System Prompt** — 3 named archetypes: Ultra-Scenic / Culturally Dense / Fast & Focused. Requires real mappable addresses per waypoint.
- [x] **1.3 Build the Deep-Link Generator Utility** — `build_maps_deep_link(start, end, waypoint_addresses)` using `urllib.parse.quote_plus`. Injected server-side after LLM call.

> **🧪 TEST 1: ✅ PASSED**
> ```
> ✅ Routes returned: 3
> ── Route 1: Riverside Reverie      (Hudson River Park → High Line → Madison Square Park)
> ── Route 2: Art & Arbors           (Clinton Garden → Gagosian Gallery → Gramercy Park)
> ── Route 3: Direct to Delight      (Bryant Park → Union Square Park)
> Deep links confirmed valid with URL-encoded waypoints pipe-separated.
> ```

---

## Phase 2: Frontend Carousel & Selection State ✅

- [x] **2.1 Route state tracking** — `selectedRouteIndex` state (default 0) in `RouteScreen`
- [x] **2.2 Premium Header Carousel** — Horizontal tab bar with Framer Motion `layoutId="active-route-tab"` animated matcha pill sliding between routes
- [x] **2.3 Timeline bound to selection** — `AnimatePresence mode="wait"` with `key={selectedIndex}` triggers full stagger re-animation on tab change

> **🧪 TEST 2: ✅ PASSED** — Timeline re-animates cleanly on carousel click. No React key errors.

---

## Phase 3: In-Between Transit Labels & The Action Button ✅

- [x] **3.1 Transit intervals** — `WalkLabel` component renders `🚶 ~N min walk` between every stop using `wp.walk_to_next_mins`
- [x] **3.2 Sticky navigation button** — Fixed bottom frosted-gradient footer with **"Start Wandering"** button. Opens `activeRoute.navigation_deep_link` in a new tab via `window.open`.

> **🧪 TEST 3: ✅ PASSED** — End-to-end: form → 3 routes generated → carousel switch → "Start Wandering" opens Google Maps walking directions with all waypoints pre-loaded.
