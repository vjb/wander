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
  route_polyline?: number[][] | null;
  route_steps?: {
    instruction: string;
    distance_m: number;
    duration_secs: number;
    maneuver: string;
  }[] | null;
  elevation_profile?: { elevation: number; index: number }[] | null;
}

interface WanderMapProps {
  route: RouteData;
  userLat?: number | null;
  userLng?: number | null;
}

// Build a rich place-card popup with Street View thumbnail
function buildStopPopup(wp: WaypointData): string {
  const mapsUrl =
    wp.place_id && !wp.place_id.startsWith("otm:") && !wp.place_id.startsWith("fsq:")
      ? `https://www.google.com/maps/place/?q=place_id:${wp.place_id}`
      : wp.lat != null && wp.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          wp.location_name + ", " + (wp.address_hint || "")
        )}`
      : null;

  const streetViewUrl =
    wp.lat != null && wp.lng != null
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${wp.lat},${wp.lng}`
      : null;

  // Street View Static thumbnail via our server-side proxy (keeps API key hidden)
  const svThumb =
    wp.lat != null && wp.lng != null
      ? `/api/streetview?lat=${wp.lat}&lng=${wp.lng}`
      : null;

  const vibeHtml = wp.vibe_tag
    ? `<span style="font-size:10px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:#8ba88e;opacity:0.8">${wp.vibe_tag}</span>`
    : "";

  const ratingHtml =
    wp.google_rating != null
      ? `<span style="font-size:11px;color:#e5d3b3;font-weight:600">★ ${wp.google_rating}</span>`
      : "";

  const dwellHtml =
    wp.duration_mins != null
      ? `<span style="font-size:11px;color:rgba(244,244,245,0.35)">· ${wp.duration_mins} min</span>`
      : "";

  const metaRow = [ratingHtml, dwellHtml].filter(Boolean).join(" ");

  const addrHtml = wp.address_hint
    ? `<div style="font-size:11px;color:rgba(244,244,245,0.35);margin-top:2px;line-height:1.4">${wp.address_hint}</div>`
    : "";

  const svThumbHtml = svThumb
    ? `<div style="margin:0 -14px 10px;overflow:hidden;border-radius:8px 8px 0 0;height:88px;background:#0e0e10">
        <img src="${svThumb}" alt="${wp.location_name}" 
          style="width:100%;height:88px;object-fit:cover;display:block;filter:brightness(0.9)"
          onerror="this.parentElement.style.display='none'"/>
      </div>`
    : "";

  const linksHtml =
    mapsUrl || streetViewUrl
      ? `<div style="display:flex;gap:6px;margin-top:10px">
          ${
            mapsUrl
              ? `<a href="${mapsUrl}" target="_blank" rel="noopener"
              style="flex:1;text-align:center;padding:5px 10px;background:#8ba88e;color:#131316;font-size:11px;font-weight:700;border-radius:20px;text-decoration:none;white-space:nowrap">
              Open in Maps
            </a>`
              : ""
          }
          ${
            streetViewUrl
              ? `<a href="${streetViewUrl}" target="_blank" rel="noopener"
              style="flex:1;text-align:center;padding:5px 10px;background:rgba(244,244,245,0.07);border:1px solid rgba(244,244,245,0.12);color:rgba(244,244,245,0.55);font-size:11px;font-weight:600;border-radius:20px;text-decoration:none;white-space:nowrap">
              Street View
            </a>`
              : ""
          }
        </div>`
      : "";

  return `<div style="font-family:-apple-system,sans-serif;width:210px;background:#18181b;border-radius:10px;padding:${svThumb ? "0" : "12px"} 14px 12px;border:1px solid rgba(139,168,142,0.2);box-shadow:0 6px 24px rgba(0,0,0,0.6);overflow:hidden">
    ${svThumbHtml}
    <div style="padding:${svThumb ? "10px 0 0" : "0"}">
      ${vibeHtml}
      <div style="font-size:13px;font-weight:700;color:#f4f4f5;line-height:1.3;margin-top:${wp.vibe_tag ? "4px" : "0"}">${wp.location_name}</div>
      ${addrHtml}
      ${metaRow ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px">${metaRow}</div>` : ""}
      ${linksHtml}
    </div>
  </div>`;
}

export function WanderMap({ route, userLat, userLng }: WanderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const boundsRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const handleRefocus = () => {
    if (mapRef.current && boundsRef.current) {
      mapRef.current.fitBounds(boundsRef.current, { padding: [48, 48], animate: true });
    }
  };

  // Update user location marker without re-mounting the map
  useEffect(() => {
    if (!mapRef.current || userLat == null || userLng == null) return;
    import("leaflet").then((L) => {
      if (!mapRef.current) return;
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLat, userLng]);
      } else {
        const userIcon = L.divIcon({
          className: "",
          html: `<div style="
            width:14px;height:14px;border-radius:50%;
            background:#8ba88e;
            border:2px solid rgba(244,244,245,0.9);
            box-shadow:0 0 0 6px rgba(139,168,142,0.25),0 0 16px rgba(139,168,142,0.5);
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        userMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
      }
    });
  }, [userLat, userLng]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof window === "undefined") return;

    import("leaflet").then((L) => {
      if (!containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        userMarkerRef.current = null;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Collect all key coords for bounds
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

      // Stadia Alidade Smooth Dark — premium minimal tiles
      const stadiaKey = process.env.NEXT_PUBLIC_STADIA_API_KEY || "";
      const stadiaKeyParam = stadiaKey ? `?api_key=${stadiaKey}` : "";
      L.tileLayer(
        `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png${stadiaKeyParam}`,
        {
          maxZoom: 20,
          attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a>',
        }
      ).addTo(map);

      // ── Animated Route Polyline ──────────────────────────────────────────────
      const addAnimatedPolyline = (
        pathCoords: [number, number][],
        dashed: boolean
      ) => {
        const total = pathCoords.length;
        if (total < 2) return;

        // 3 color segments: green → sage → amber
        const segments: { coords: [number, number][]; color: string }[] = [
          { coords: pathCoords.slice(0, Math.ceil(total * 0.4)), color: "#8ba88e" },
          { coords: pathCoords.slice(Math.floor(total * 0.35), Math.ceil(total * 0.7)), color: "#a8c5ab" },
          { coords: pathCoords.slice(Math.floor(total * 0.65)), color: "#e5d3b3" },
        ];

        // Glow halo — full route, fat + translucent
        const glowLine = L.polyline(pathCoords, {
          color: "#8ba88e",
          weight: 16,
          opacity: 0.07,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        // Coloured segments
        segments.forEach(({ coords: segCoords, color }, i) => {
          if (segCoords.length < 2) return;
          const line = L.polyline(segCoords, {
            color,
            weight: dashed ? 2.5 : 3,
            opacity: dashed ? 0.75 : 0.92,
            dashArray: dashed ? "6 10" : undefined,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);

          // Apply flow animation after DOM render
          setTimeout(() => {
            const path = (line as any)._path as SVGPathElement | undefined;
            const glowPath = (glowLine as any)._path as SVGPathElement | undefined;
            if (path) {
              path.classList.add("wander-flow-seg");
              path.style.animationDelay = `${i * 0.18}s`;
            }
            if (i === 0 && glowPath) {
              glowPath.classList.add("wander-glow-pulse");
            }
          }, 50);
        });
      };

      if (route.route_polyline && route.route_polyline.length >= 2) {
        const pathCoords: [number, number][] = route.route_polyline.map(
          (pt) => [pt[0], pt[1]] as [number, number]
        );
        addAnimatedPolyline(pathCoords, false);
      } else if (coords.length >= 2) {
        addAnimatedPolyline(coords, true);
      }

      // ── Icon builder ──────────────────────────────────────────────────────────
      const makeIcon = (label: string, bg: string, text: string, size: number, pulse = false) =>
        L.divIcon({
          className: "",
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${bg};color:${text};
            display:flex;align-items:center;justify-content:center;
            font-family:-apple-system,sans-serif;font-size:${size * 0.42}px;font-weight:700;
            border:2px solid rgba(244,244,245,0.18);
            box-shadow:0 0 0 3px ${bg}33,0 2px 12px rgba(0,0,0,0.6);
            cursor:pointer;user-select:none;
            ${pulse ? `animation:wanderMarkerPulse 2.4s ease-in-out infinite;` : ""}
          ">${label}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2 - 8],
        });

      // ── Start marker ──────────────────────────────────────────────────────────
      if (route.start_lat != null && route.start_lng != null) {
        const icon = makeIcon("S", "#131316", "#8ba88e", 28);
        const marker = L.marker(
          [Number(route.start_lat), Number(route.start_lng)],
          { icon }
        ).addTo(map);
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

      // ── Waypoint markers + pulse zones ──────────────────────────────────────
      for (const wp of route.waypoints) {
        if (wp.lat == null || wp.lng == null) continue;
        const lat = Number(wp.lat);
        const lng = Number(wp.lng);

        // 100m pulse zone — matches the auto check-in radius in walk mode
        L.circle([lat, lng], {
          radius: 100,
          color: "#8ba88e",
          fillColor: "#8ba88e",
          fillOpacity: 0.06,
          weight: 1,
          opacity: 0.22,
          dashArray: "4 8",
        } as any).addTo(map);

        const icon = makeIcon(String(wp.order), "#8ba88e", "#131316", 32);
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindPopup(buildStopPopup(wp), {
          className: "wander-popup",
          maxWidth: 230,
          minWidth: 210,
          closeButton: true,
        });
      }

      // ── End / Destination marker ──────────────────────────────────────────────
      if (
        route.end_lat != null &&
        route.end_lng != null &&
        !(route.end_lat === route.start_lat && route.end_lng === route.start_lng)
      ) {
        const lat = Number(route.end_lat);
        const lng = Number(route.end_lng);

        // Pulsing destination zone
        L.circle([lat, lng], {
          radius: 80,
          color: "#e5d3b3",
          fillColor: "#e5d3b3",
          fillOpacity: 0.07,
          weight: 1,
          opacity: 0.3,
          dashArray: "4 8",
        } as any).addTo(map);

        const icon = makeIcon("D", "#e5d3b3", "#131316", 28, true);
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        if (route.end_location) {
          marker.bindPopup(
            `<div style="font-family:-apple-system,sans-serif;background:#17171a;padding:10px 14px;border-radius:10px;border:1px solid rgba(229,211,179,0.2);min-width:160px">
              <div style="font-size:10px;font-weight:600;color:#e5d3b3;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Destination</div>
              <div style="font-size:13px;color:#f4f4f5;font-weight:500">${route.end_location}</div>
            </div>`,
            { className: "wander-popup", maxWidth: 280 }
          );
        }
      }

      // ── Fit bounds ───────────────────────────────────────────────────────────
      if (coords.length >= 2) {
        const bounds = L.latLngBounds(coords);
        boundsRef.current = bounds;
        map.fitBounds(bounds, { padding: [48, 48] });
      }

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control
        .attribution({ position: "bottomleft", prefix: false })
        .addAttribution('© <a href="https://stadiamaps.com/" style="color:#8ba88e">Stadia</a>')
        .addTo(map);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        userMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  return (
    <>
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");

        .leaflet-container {
          background: #0d0d10 !important;
          font-family: -apple-system, sans-serif;
        }
        .leaflet-tile-pane { filter: brightness(0.88) contrast(1.08) saturate(0.9); }

        /* ── Route animation ── */
        @keyframes wanderFlow {
          from { stroke-dashoffset: 800; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes wanderGlowPulse {
          0%, 100% { opacity: 0.06; }
          50%       { opacity: 0.14; }
        }
        @keyframes wanderMarkerPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(229,211,179,0.2), 0 2px 12px rgba(0,0,0,0.6); }
          50%       { box-shadow: 0 0 0 7px rgba(229,211,179,0.12), 0 2px 20px rgba(229,211,179,0.3); }
        }

        .wander-flow-seg {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          animation: wanderFlow 1.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .wander-glow-pulse {
          animation: wanderGlowPulse 3s ease-in-out infinite;
        }

        /* ── Zoom controls ── */
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
        .leaflet-control-zoom a:hover { background: rgba(139,168,142,0.15) !important; }

        /* ── Attribution ── */
        .leaflet-control-attribution {
          background: rgba(13,13,16,0.7) !important;
          color: rgba(244,244,245,0.25) !important;
          font-size: 9px !important;
          border-radius: 4px 0 0 0 !important;
          padding: 2px 6px !important;
        }
        .leaflet-control-attribution a { color: #8ba88e !important; }

        /* ── Popup chrome ── */
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
          color: rgba(244,244,245,0.5) !important;
          font-size: 18px !important;
          top: 4px !important;
          right: 6px !important;
          width: 22px !important;
          height: 22px !important;
          line-height: 22px !important;
          border-radius: 50% !important;
          background: rgba(19,19,22,0.7) !important;
          z-index: 10;
        }
        .wander-popup .leaflet-popup-close-button:hover {
          color: #f4f4f5 !important;
          background: rgba(139,168,142,0.2) !important;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {/* Re-center button */}
      <button
        onClick={handleRefocus}
        title="Re-center map"
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 1000,
          background: "rgba(18,18,21,0.90)",
          border: "1px solid rgba(139,168,142,0.3)",
          color: "#8ba88e",
          borderRadius: "8px",
          padding: "5px 10px",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          lineHeight: 1,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        </svg>
        re-center
      </button>
    </>
  );
}
