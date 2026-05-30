"use client";

import { useEffect, useRef } from "react";

interface WaypointData {
  order: number;
  location_name: string;
  address_hint?: string;
  lat?: number | null;
  lng?: number | null;
  google_rating?: number | null;
  photo_url?: string | null;
  action_description?: string;
  duration_mins?: number;
  walk_to_next_mins?: number;
  vibe_tag?: string;
  insider_tip?: string;
  place_id?: string | null;
}

interface RouteData {
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  start_location?: string;
  end_location?: string;
  waypoints: WaypointData[];
}

interface WanderMapProps {
  route: RouteData;
}

// Build a rich place-card popup for a waypoint
function buildStopPopup(wp: WaypointData): string {
  const mapsUrl = wp.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${wp.place_id}`
    : wp.lat != null && wp.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${wp.lat},${wp.lng}`
    : null;

  const streetViewUrl =
    wp.lat != null && wp.lng != null
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${wp.lat},${wp.lng}`
      : null;

  // Rating bar — filled dots
  const ratingHtml =
    wp.google_rating != null
      ? (() => {
          const full = Math.floor(wp.google_rating);
          const half = wp.google_rating - full >= 0.5;
          const stars = Array.from({ length: 5 }, (_, i) => {
            if (i < full) return `<span style="color:#e5d3b3">★</span>`;
            if (i === full && half) return `<span style="color:#e5d3b3;opacity:0.5">★</span>`;
            return `<span style="color:#e5d3b3;opacity:0.2">★</span>`;
          }).join("");
          return `<div style="display:flex;align-items:center;gap:5px;margin-bottom:8px">
            <span style="font-size:12px;line-height:1">${stars}</span>
            <span style="font-size:11px;color:#e5d3b3;font-weight:600">${wp.google_rating}</span>
          </div>`;
        })()
      : "";

  const photoHtml = wp.photo_url
    ? `<div style="width:100%;height:130px;overflow:hidden;border-radius:10px 10px 0 0;position:relative;background:#1a1a1e">
         <img src="${wp.photo_url}" alt="${wp.location_name}"
           style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.92"
           onerror="this.parentElement.style.display='none'"
         />
         <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(19,19,22,0.85))"></div>
         ${wp.vibe_tag ? `<span style="position:absolute;top:8px;left:8px;background:rgba(19,19,22,0.75);backdrop-filter:blur(6px);border:1px solid rgba(139,168,142,0.3);color:#8ba88e;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:3px 8px;border-radius:20px">${wp.vibe_tag}</span>` : ""}
       </div>`
    : wp.vibe_tag
    ? `<div style="padding:12px 14px 0"><span style="background:rgba(139,168,142,0.12);border:1px solid rgba(139,168,142,0.25);color:#8ba88e;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:3px 8px;border-radius:20px">${wp.vibe_tag}</span></div>`
    : "";

  const dwellHtml =
    wp.duration_mins != null
      ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:rgba(244,244,245,0.4);background:rgba(244,244,245,0.05);border:1px solid rgba(244,244,245,0.08);border-radius:20px;padding:2px 7px">${wp.duration_mins} min</span>`
      : "";

  const descHtml = wp.action_description
    ? `<p style="font-size:12px;line-height:1.55;color:rgba(244,244,245,0.65);margin:0 0 10px">${wp.action_description}</p>`
    : "";

  const tipHtml = wp.insider_tip
    ? `<div style="background:rgba(139,168,142,0.06);border-left:2px solid rgba(139,168,142,0.4);padding:7px 10px;border-radius:0 6px 6px 0;margin-bottom:12px">
         <p style="font-size:11px;line-height:1.5;color:rgba(244,244,245,0.5);margin:0"><span style="color:#8ba88e;font-weight:600">tip · </span>${wp.insider_tip}</p>
       </div>`
    : "";

  const addrHtml = wp.address_hint
    ? `<p style="font-size:11px;color:rgba(244,244,245,0.3);margin:0 0 10px;line-height:1.4">${wp.address_hint}</p>`
    : "";

  const linksHtml = `<div style="display:flex;gap:6px;flex-wrap:wrap">
    ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:6px 11px;background:#8ba88e;color:#131316;font-size:11px;font-weight:700;border-radius:20px;text-decoration:none;letter-spacing:0.02em">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
      Open in Maps
    </a>` : ""}
    ${streetViewUrl ? `<a href="${streetViewUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:6px 11px;background:rgba(244,244,245,0.06);border:1px solid rgba(244,244,245,0.12);color:rgba(244,244,245,0.6);font-size:11px;font-weight:600;border-radius:20px;text-decoration:none">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      Street View
    </a>` : ""}
  </div>`;

  return `<div style="font-family:-apple-system,'Inter',sans-serif;width:240px;background:#17171a;border-radius:12px;overflow:hidden;border:1px solid rgba(139,168,142,0.2);box-shadow:0 8px 32px rgba(0,0,0,0.7)">
    ${photoHtml}
    <div style="padding:${wp.photo_url ? "12px" : "14px"} 14px 14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">
        <h3 style="font-size:14px;font-weight:700;color:#f4f4f5;margin:0;line-height:1.3;flex:1">${wp.location_name}</h3>
        ${dwellHtml}
      </div>
      ${addrHtml}
      ${ratingHtml}
      ${descHtml}
      ${tipHtml}
      ${linksHtml}
    </div>
  </div>`;
}

export function WanderMap({ route }: WanderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof window === "undefined") return;

    import("leaflet").then((L) => {
      if (!containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const coords: [number, number][] = [];

      if (route.start_lat != null && route.start_lng != null) {
        coords.push([Number(route.start_lat), Number(route.start_lng)]);
      }
      for (const wp of route.waypoints) {
        if (wp.lat != null && wp.lng != null) {
          coords.push([Number(wp.lat), Number(wp.lng)]);
        }
      }
      if (route.end_lat != null && route.end_lng != null) {
        coords.push([Number(route.end_lat), Number(route.end_lng)]);
      }

      const center: [number, number] =
        coords.length > 0 ? coords[Math.floor(coords.length / 2)] : [40.758, -73.985];

      const map = L.map(containerRef.current, {
        center,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19, subdomains: "abcd" }
      ).addTo(map);

      // ── Route polyline — matcha glow ──
      if (coords.length >= 2) {
        L.polyline(coords, { color: "#8ba88e", weight: 10, opacity: 0.10 }).addTo(map);
        L.polyline(coords, {
          color: "#8ba88e", weight: 3, opacity: 0.85,
          dashArray: "6 10", lineCap: "round", lineJoin: "round",
        }).addTo(map);
      }

      // ── Icon builder ──
      const makeIcon = (label: string, bg: string, text: string, size: number) =>
        L.divIcon({
          className: "",
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${bg};color:${text};
            display:flex;align-items:center;justify-content:center;
            font-family:-apple-system,sans-serif;font-size:${size * 0.42}px;font-weight:700;
            border:2px solid rgba(244,244,245,0.15);
            box-shadow:0 0 0 3px ${bg}33,0 2px 12px rgba(0,0,0,0.6);
            cursor:pointer;user-select:none;
          ">${label}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2 - 8],
        });

      // ── Start marker — simple label pill ──
      if (route.start_lat != null && route.start_lng != null) {
        const icon = makeIcon("S", "#131316", "#8ba88e", 28);
        const marker = L.marker([Number(route.start_lat), Number(route.start_lng)], { icon }).addTo(map);
        if (route.start_location) {
          marker.bindPopup(
            `<div style="font-family:-apple-system,sans-serif;background:#17171a;padding:10px 14px;border-radius:10px;border:1px solid rgba(244,244,245,0.1);min-width:160px">
              <div style="font-size:10px;font-weight:600;color:#8ba88e;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Start</div>
              <div style="font-size:13px;color:#f4f4f5;font-weight:500">${route.start_location}</div>
            </div>`,
            { className: "wander-popup", maxWidth: 280 }
          );
        }
      }

      // ── Waypoint markers — rich place cards ──
      for (const wp of route.waypoints) {
        if (wp.lat == null || wp.lng == null) continue;
        const icon = makeIcon(String(wp.order), "#8ba88e", "#131316", 32);
        const marker = L.marker([Number(wp.lat), Number(wp.lng)], { icon }).addTo(map);
        marker.bindPopup(buildStopPopup(wp), {
          className: "wander-popup",
          maxWidth: 260,
          minWidth: 240,
        });
      }

      // ── End marker ──
      if (
        route.end_lat != null && route.end_lng != null &&
        !(route.end_lat === route.start_lat && route.end_lng === route.start_lng)
      ) {
        const icon = makeIcon("D", "#e5d3b3", "#131316", 28);
        const marker = L.marker([Number(route.end_lat), Number(route.end_lng)], { icon }).addTo(map);
        if (route.end_location) {
          marker.bindPopup(
            `<div style="font-family:-apple-system,sans-serif;background:#17171a;padding:10px 14px;border-radius:10px;border:1px solid rgba(244,244,245,0.1);min-width:160px">
              <div style="font-size:10px;font-weight:600;color:#e5d3b3;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Destination</div>
              <div style="font-size:13px;color:#f4f4f5;font-weight:500">${route.end_location}</div>
            </div>`,
            { className: "wander-popup", maxWidth: 280 }
          );
        }
      }

      if (coords.length >= 2) {
        map.fitBounds(L.latLngBounds(coords), { padding: [48, 48] });
      }

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ position: "bottomleft", prefix: false })
        .addAttribution('© <a href="https://carto.com" style="color:#8ba88e">CARTO</a>')
        .addTo(map);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  return (
    <>
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");

        .leaflet-container {
          background: #131316 !important;
          font-family: -apple-system, sans-serif;
        }
        .leaflet-tile-pane { filter: brightness(0.85) contrast(1.06); }

        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.5) !important;
        }
        .leaflet-control-zoom a {
          background: #1e1e22 !important;
          color: #8ba88e !important;
          border: 1px solid rgba(244,244,245,0.1) !important;
          font-weight: 600 !important;
          line-height: 26px !important;
          width: 26px !important;
          height: 26px !important;
        }
        .leaflet-control-zoom a:hover { background: #8ba88e22 !important; }

        .leaflet-control-attribution {
          background: rgba(19,19,22,0.7) !important;
          color: rgba(244,244,245,0.3) !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a { color: #8ba88e !important; }

        /* Strip ALL default popup chrome */
        .wander-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .wander-popup .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
        }
        .wander-popup .leaflet-popup-tip-container { display: none !important; }
        .wander-popup .leaflet-popup-close-button {
          color: rgba(244,244,245,0.4) !important;
          font-size: 16px !important;
          top: 6px !important;
          right: 8px !important;
          width: 20px !important;
          height: 20px !important;
          line-height: 20px !important;
          z-index: 10;
        }
        .wander-popup .leaflet-popup-close-button:hover {
          color: #f4f4f5 !important;
          background: none !important;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
}
