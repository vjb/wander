"use client";

import { useEffect, useRef } from "react";

interface WaypointData {
  order: number;
  location_name: string;
  lat?: number | null;
  lng?: number | null;
  google_rating?: number | null;
  duration_mins?: number;
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

export function WanderMap({ route }: WanderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Leaflet must only run on the client
    if (typeof window === "undefined") return;

    // Lazy-import to avoid SSR issues
    import("leaflet").then((L) => {
      if (!containerRef.current) return;

      // Destroy previous instance if any
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Fix Leaflet default icon path (broken in bundlers)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Build coordinate list
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

      // Fallback center if no coords
      const center: [number, number] =
        coords.length > 0 ? coords[Math.floor(coords.length / 2)] : [40.758, -73.985];

      const map = L.map(containerRef.current, {
        center,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;

      // ── Dark CartoDB Positron Dark Matter tiles (no API key needed) ──
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        }
      ).addTo(map);

      // ── Route polyline — matcha glow ──
      if (coords.length >= 2) {
        // Glow layer (thick, transparent)
        L.polyline(coords, {
          color: "#8ba88e",
          weight: 10,
          opacity: 0.12,
        }).addTo(map);

        // Main line
        L.polyline(coords, {
          color: "#8ba88e",
          weight: 3,
          opacity: 0.85,
          dashArray: "6 10",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }

      // ── Helper: make a custom DivIcon ──
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
            user-select:none;
          ">${label}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2 - 4],
        });

      // ── Start marker ──
      if (route.start_lat != null && route.start_lng != null) {
        const icon = makeIcon("S", "#131316", "#8ba88e", 28);
        const marker = L.marker(
          [Number(route.start_lat), Number(route.start_lng)],
          { icon }
        ).addTo(map);
        if (route.start_location) {
          marker.bindPopup(
            `<div style="font-family:-apple-system,sans-serif;font-size:12px;color:#f4f4f5;background:#1e1e22;padding:6px 10px;border-radius:8px;border:1px solid rgba(244,244,245,0.1)"><strong style="color:#8ba88e">Start</strong><br/>${route.start_location}</div>`,
            { className: "wander-popup" }
          );
        }
      }

      // ── Waypoint markers ──
      for (const wp of route.waypoints) {
        if (wp.lat == null || wp.lng == null) continue;
        const icon = makeIcon(String(wp.order), "#8ba88e", "#131316", 30);
        const marker = L.marker([Number(wp.lat), Number(wp.lng)], { icon }).addTo(map);
        const ratingStr =
          wp.google_rating != null ? `<br/><span style="color:#e5d3b3">★ ${wp.google_rating}</span>` : "";
        const dwellStr =
          wp.duration_mins != null ? ` · ${wp.duration_mins} min` : "";
        marker.bindPopup(
          `<div style="font-family:-apple-system,sans-serif;font-size:12px;color:#f4f4f5;background:#1e1e22;padding:8px 12px;border-radius:8px;border:1px solid rgba(139,168,142,0.25);min-width:140px"><strong style="color:#f4f4f5;font-size:13px">${wp.location_name}</strong>${ratingStr}<br/><span style="color:#f4f4f5;opacity:0.45;font-size:11px">${dwellStr.trim()}</span></div>`,
          { className: "wander-popup" }
        );
      }

      // ── End marker ──
      if (
        route.end_lat != null &&
        route.end_lng != null &&
        !(route.end_lat === route.start_lat && route.end_lng === route.start_lng)
      ) {
        const icon = makeIcon("D", "#e5d3b3", "#131316", 28);
        const marker = L.marker(
          [Number(route.end_lat), Number(route.end_lng)],
          { icon }
        ).addTo(map);
        if (route.end_location) {
          marker.bindPopup(
            `<div style="font-family:-apple-system,sans-serif;font-size:12px;color:#f4f4f5;background:#1e1e22;padding:6px 10px;border-radius:8px;border:1px solid rgba(244,244,245,0.1)"><strong style="color:#e5d3b3">Destination</strong><br/>${route.end_location}</div>`,
            { className: "wander-popup" }
          );
        }
      }

      // ── Fit bounds ──
      if (coords.length >= 2) {
        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
      }

      // ── Tiny zoom control, bottom-right ──
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // ── Minimal attribution ──
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
      {/* Inject Leaflet CSS + custom popup styles */}
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");

        .leaflet-container {
          background: #131316 !important;
          font-family: -apple-system, sans-serif;
        }
        .leaflet-tile-pane { filter: brightness(0.88) contrast(1.05); }
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
        .leaflet-control-zoom a:hover {
          background: #8ba88e22 !important;
        }
        .leaflet-control-attribution {
          background: rgba(19,19,22,0.7) !important;
          color: rgba(244,244,245,0.3) !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a { color: #8ba88e !important; }
        .wander-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .wander-popup .leaflet-popup-content { margin: 0 !important; }
        .wander-popup .leaflet-popup-tip-container { display: none !important; }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
}
