"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps";

function MapPath({ route }: { route: any }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Collect all coordinates in order: Start -> Waypoints -> End
    const pathCoordinates: google.maps.LatLngLiteral[] = [];

    if (route.start_lat != null && route.start_lng != null) {
      pathCoordinates.push({ lat: Number(route.start_lat), lng: Number(route.start_lng) });
    }

    const waypoints = route.waypoints || [];
    waypoints.forEach((wp: any) => {
      if (wp.lat != null && wp.lng != null) {
        pathCoordinates.push({ lat: Number(wp.lat), lng: Number(wp.lng) });
      }
    });

    if (route.end_lat != null && route.end_lng != null) {
      pathCoordinates.push({ lat: Number(route.end_lat), lng: Number(route.end_lng) });
    }

    if (pathCoordinates.length < 2) return;

    // Draw the polyline with direction arrows (using green color)
    const lineSymbol = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 2.5,
      strokeColor: "#8ba88e",
      fillColor: "#8ba88e",
      fillOpacity: 1,
    };

    const polyline = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: "#8ba88e",
      strokeOpacity: 0.7,
      strokeWeight: 4,
      icons: [
        {
          icon: lineSymbol,
          offset: "60px",
          repeat: "100px",
        },
      ],
    });

    polyline.setMap(map);

    // Auto-fit bounds so start, end, and waypoints are all perfectly visible!
    const bounds = new google.maps.LatLngBounds();
    pathCoordinates.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });

    return () => {
      polyline.setMap(null);
    };
  }, [map, route]);

  return null;
}

export function MapPreview({ route }: { route: any }) {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    setApiKey(key);
  }, []);

  if (!apiKey) return null;

  const waypoints = route.waypoints || [];

  return (
    <div className="w-full h-full relative">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultZoom={12}
          defaultCenter={{ lat: 40.7580, lng: -73.9855 }} // Manhattan center fallback
          mapId="wander_v3_map_id"
          gestureHandling="cooperative"
          disableDefaultUI={true}
          style={{ width: "100%", height: "100%" }}
        >
          <MapPath route={route} />
          
          {/* Start Marker */}
          {route.start_lat != null && route.start_lng != null && (
             <AdvancedMarker position={{ lat: Number(route.start_lat), lng: Number(route.start_lng) }}>
               <Pin background={"#131316"} borderColor={"#8ba88e"} glyphColor={"#8ba88e"} scale={0.9} glyph="S" />
             </AdvancedMarker>
          )}

          {/* Waypoint Markers */}
          {waypoints.map((wp: any) => {
            if (wp.lat == null || wp.lng == null) return null;
            return (
              <AdvancedMarker key={wp.order} position={{ lat: Number(wp.lat), lng: Number(wp.lng) }}>
                 <Pin background={"#8ba88e"} borderColor={"#131316"} glyphColor={"#131316"} scale={1.0} glyph={wp.order.toString()} />
              </AdvancedMarker>
            );
          })}

          {/* End Marker */}
          {route.end_lat != null && route.end_lng != null && (
             <AdvancedMarker position={{ lat: Number(route.end_lat), lng: Number(route.end_lng) }}>
               <Pin background={"#e5d3b3"} borderColor={"#131316"} glyphColor={"#131316"} scale={0.9} glyph="D" />
             </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
