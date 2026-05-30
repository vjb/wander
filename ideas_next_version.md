# Future Ideas & Integrations — Wander Next Version

This document captures features and integration ideas brainstormed for future releases of Wander.

## 1. Calendar Integration ("Add to Calendar")
- **Concept:** Allow users to schedule their walking route in their calendar.
- **How it works:**
  - Generate an `.ics` calendar file or a direct "Add to Google Calendar" template URL.
  - Compute the start time (based on a user-chosen time of day or current time).
  - Add each waypoint as a calendar event with:
    - **Title:** `Wander Stop: [Venue Name]`
    - **Time:** Start to Start + `duration_mins`
    - **Description:** Curated description and insider tips.
    - **Location:** Street address hint.
  - Add walking segments as calendar events:
    - **Title:** `Walk to next stop`
    - **Time:** Stop end to Stop end + `walk_to_next_mins`

## 2. Local Weather Overlay
- **Concept:** Check weather conditions before heading out.
- **How it works:**
  - Retrieve current temperature and precipitation forecasts for the route midpoint.
  - Warn users if rain, snow, or extreme heat is expected during their scheduled walk time.

## 3. Native Navigation Share (SMS / WhatsApp)
- **Concept:** Share the route to a mobile phone with one click.
- **How it works:**
  - Add a "Share Route" button that copies the Google Maps multi-stop deep link or generates an SMS/WhatsApp template message so the user can easily open the route on their phone.

## 4. Yelp / Foursquare Cross-Referencing
- **Concept:** Enrich rating data.
- **How it works:**
  - Pull ratings and review counts from Yelp or Foursquare to show comparison ratings side-by-side with Google ratings.
